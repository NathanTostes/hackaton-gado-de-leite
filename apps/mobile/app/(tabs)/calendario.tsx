import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  ICONE_EVENTO,
  ROTULO_EVENTO,
  concluirEvento,
  listarEventos,
  type EventoComAnimal,
} from '@drmoo/db';
import { formatarBR, hoje, somarDias } from '@drmoo/domain';
import {
  Alerta,
  Botao,
  CabecalhoPagina,
  Cartao,
  Carregando,
  Chip,
  Espaco,
  Linha,
  MaterialIcons,
  Tela,
  TituloSecao,
  Txt,
  Vazio,
  type NomeIcone,
} from '../../src/componentes/base';
import { useDados } from '../../src/hooks';
import { useTema } from '../../src/tema';

/** Calendário sanitário anual no formato da cartilha (linhas × meses). */
const CALENDARIO_SANITARIO = [
  { controle: 'Aftosa', meses: [5, 11] },
  { controle: 'Raiva', meses: [4] },
  { controle: 'Brucelose', meses: [3, 7, 11] },
  { controle: 'Carrapato', meses: [1, 3, 5, 7, 9, 11] },
  { controle: 'Verminose', meses: [2, 5, 8, 11] },
];

const MESES = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export default function Calendario() {
  const { c, espaco } = useTema();
  const [janela, setJanela] = useState<7 | 30 | 90>(30);

  const { dados, carregando, recarregar } = useDados(
    () => listarEventos(somarDias(hoje(), -30), somarDias(hoje(), janela)),
    [janela],
  );

  if (carregando || !dados) return <Carregando />;

  const hj = hoje();
  const atrasados = dados.filter((e) => e.data < hj && e.status === 'pendente');
  const deHoje = dados.filter((e) => e.data === hj && e.status === 'pendente');
  const futuros = dados.filter((e) => e.data > hj && e.status === 'pendente');
  const feitos = dados.filter((e) => e.status === 'feito');

  const marcar = async (id: string) => {
    await concluirEvento(id);
    recarregar();
  };

  return (
    <Tela>
      <CabecalhoPagina
        titulo="Calendário"
        subtitulo="Vacinação, medicação, exames e manejo sanitário"
      />
      <Linha gap={espaco.sm}>
        <Txt v="caption" cor={c.textoSecundario}>
          Próximos:
        </Txt>
        {([7, 30, 90] as const).map((d) => (
          <Chip key={d} texto={`${d} dias`} ativo={janela === d} aoTocar={() => setJanela(d)} />
        ))}
      </Linha>

      {atrasados.length > 0 && (
        <>
          <TituloSecao icone="event-busy">Atrasados</TituloSecao>
          <View style={{ gap: espaco.sm }}>
            {atrasados.map((e) => (
              <ItemEvento key={e.id} evento={e} atrasado aoConcluir={() => marcar(e.id)} />
            ))}
          </View>
        </>
      )}

      <TituloSecao icone="today">Hoje</TituloSecao>
      {deHoje.length === 0 ? (
        <Alerta tipo="ok" titulo="Nada marcado para hoje" />
      ) : (
        <View style={{ gap: espaco.sm }}>
          {deHoje.map((e) => (
            <ItemEvento key={e.id} evento={e} aoConcluir={() => marcar(e.id)} />
          ))}
        </View>
      )}

      <TituloSecao icone="event">A fazer</TituloSecao>
      {futuros.length === 0 ? (
        <Vazio icone="event-available" titulo="Nenhum evento nesta janela" />
      ) : (
        <View style={{ gap: espaco.sm }}>
          {futuros.map((e) => (
            <ItemEvento key={e.id} evento={e} aoConcluir={() => marcar(e.id)} />
          ))}
        </View>
      )}

      {/* Calendário sanitário anual, no formato da ficha da Embrapa */}
      <TituloSecao icone="grid-on">Calendário sanitário anual</TituloSecao>
      <Cartao>
        <Linha gap={0}>
          <View style={{ width: 92 }} />
          {MESES.map((m, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Txt v="caption" cor={c.textoSecundario}>
                {m}
              </Txt>
            </View>
          ))}
        </Linha>
        {CALENDARIO_SANITARIO.map((linha) => (
          <Linha key={linha.controle} gap={0} style={{ minHeight: 34 }}>
            <Txt v="label" style={{ width: 92 }} numberOfLines={1}>
              {linha.controle}
            </Txt>
            {MESES.map((_, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                {linha.meses.includes(i) ? (
                  <MaterialIcons name="close" size={16} color={c.primaria} />
                ) : (
                  <Txt v="caption" cor={c.borda}>
                    ·
                  </Txt>
                )}
              </View>
            ))}
          </Linha>
        ))}
        <Espaco h={espaco.sm} />
        <Txt v="caption" cor={c.textoSecundario}>
          Modelo da ficha de controle sanitário (Embrapa, Administrando a propriedade
          leiteira, p. 25). Ajuste com o médico-veterinário conforme as doenças da sua região.
        </Txt>
      </Cartao>

      {feitos.length > 0 && (
        <>
          <TituloSecao icone="check-circle">Concluídos</TituloSecao>
          <Txt v="caption" cor={c.textoSecundario}>
            {feitos.length} evento(s) concluído(s) nos últimos 30 dias.
          </Txt>
        </>
      )}

      <Espaco h={espaco.lg} />
      <Botao
        titulo="Nova anamnese"
        icone="medical-services"
        variante="secundario"
        aoTocar={() => router.push('/anamnese')}
      />
    </Tela>
  );
}

function ItemEvento({
  evento,
  atrasado,
  aoConcluir,
}: {
  evento: EventoComAnimal;
  atrasado?: boolean;
  aoConcluir: () => void;
}) {
  const { c, espaco } = useTema();
  return (
    <Cartao destaque={atrasado ? c.alerta : undefined}>
      <Linha entre centro={false}>
        <Linha gap={espaco.md} centro={false} style={{ flex: 1 }}>
          <MaterialIcons
            name={(ICONE_EVENTO[evento.tipo] ?? 'event') as NomeIcone}
            size={24}
            color={atrasado ? c.alerta : c.primaria}
          />
          <View style={{ flex: 1 }}>
            <Txt v="corpoForte">{evento.titulo}</Txt>
            <Txt v="caption" cor={c.textoSecundario}>
              {ROTULO_EVENTO[evento.tipo]} · {formatarBR(evento.data)}
              {evento.brinco ? ` · brinco ${evento.brinco}` : ''}
            </Txt>
            {evento.descricao && (
              <Txt v="caption" cor={c.textoSecundario} style={{ marginTop: 2 }}>
                {evento.descricao}
              </Txt>
            )}
          </View>
        </Linha>
        <Pressable onPress={aoConcluir} style={{ padding: 4 }}>
          <MaterialIcons name="check-box-outline-blank" size={26} color={c.textoSecundario} />
        </Pressable>
      </Linha>
    </Cartao>
  );
}
