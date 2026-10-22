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
  const [janela, setJanela] = useState<7 | 30 | 90 | 365 | 'todos'>(30);

  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const { dados, carregando, recarregar, erro } = useDados(
    () => listarEventos(somarDias(hoje(), -30), janela === 'todos' ? '9999-12-31' : somarDias(hoje(), janela)),
    [janela],
  );

  if (erro) return <Tela><Alerta tipo="alerta" titulo="Não foi possível carregar o calendário" texto={erro} /><Botao titulo="Tentar novamente" aoTocar={recarregar} /></Tela>;
  if (carregando || !dados) return <Carregando />;

  const hj = hoje();
  const atrasados = dados.filter((e) => e.data < hj && (e.status === 'pendente' || e.status === 'atrasado'));
  const deHoje = dados.filter((e) => e.data === hj && (e.status === 'pendente' || e.status === 'atrasado'));
  const futuros = dados.filter((e) => e.data > hj && (e.status === 'pendente' || e.status === 'atrasado'));
  const feitos = dados.filter((e) => e.status === 'feito');

  const marcar = async (id: string) => {
    setErroAcao(null);
    try { await concluirEvento(id); recarregar(); }
    catch (e) { setErroAcao(e instanceof Error ? e.message : 'Não foi possível concluir o compromisso.'); }
  };

  return (
    <Tela>
      <CabecalhoPagina
        titulo="Calendário"
        subtitulo="Vacinação, medicação, exames e manejo sanitário"
      />
      <Linha gap={espaco.sm} style={{ flexWrap: 'wrap' }}>
        <Txt v="caption" cor={c.textoSecundario}>
          Próximos:
        </Txt>
        {([7, 30, 90, 365, 'todos'] as const).map((d) => (
          <Chip key={d} texto={d === 'todos' ? 'Todos' : `${d} dias`} ativo={janela === d} aoTocar={() => setJanela(d)} />
        ))}
      </Linha>

      {!!erroAcao && <Alerta tipo="alerta" titulo="Não foi possível atualizar o compromisso" texto={erroAcao} />}

      {atrasados.length > 0 && (
        <>
          <TituloSecao icone="event-busy">Atrasados</TituloSecao>
          <ListaEventos eventos={atrasados} atrasado aoConcluir={marcar} />
        </>
      )}

      <TituloSecao icone="today">Hoje</TituloSecao>
      {deHoje.length === 0 ? (
        <Alerta tipo="ok" titulo="Nada marcado para hoje" />
      ) : (
        <ListaEventos eventos={deHoje} aoConcluir={marcar} />
      )}

      <TituloSecao icone="event">A fazer</TituloSecao>
      {futuros.length === 0 ? (
        <Vazio icone="event-available" titulo="Nenhum evento nesta janela" />
      ) : (
        <ListaEventos eventos={futuros} aoConcluir={marcar} />
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
                {linha.meses.includes(i + 1) ? (
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
            {feitos.length} evento(s) concluído(s) na janela exibida.
          </Txt>
          <ListaEventos eventos={feitos} />
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
  aoConcluir?: () => void;
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
        {aoConcluir && <Pressable accessibilityRole="button" accessibilityLabel={`Concluir ${evento.titulo}`} onPress={aoConcluir} style={{ padding: 4 }}>
          <MaterialIcons name="check-box-outline-blank" size={26} color={c.textoSecundario} />
        </Pressable>}
      </Linha>
      {evento.atendimento_id && <Botao titulo="Ver prontuário" variante="texto" aoTocar={() => router.push(`/prontuario/${evento.atendimento_id}`)} />}
    </Cartao>
  );
}

/** Expande apenas a lista escolhida; os compromissos permanecem no banco. */
export function ListaEventos({ eventos, atrasado, aoConcluir }: {
  eventos: EventoComAnimal[]; atrasado?: boolean; aoConcluir?: (id: string) => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const { espaco } = useTema();
  return <View style={{ gap: espaco.sm }}>
    {(expandido ? eventos : eventos.slice(0, 5)).map((evento) => <ItemEvento key={evento.id} evento={evento} atrasado={atrasado}
      aoConcluir={aoConcluir ? () => aoConcluir(evento.id) : undefined} />)}
    {eventos.length > 5 && <Botao titulo={expandido ? 'Ver menos' : `Ver mais (${eventos.length - 5})`}
      variante="secundario" aoTocar={() => setExpandido((v) => !v)} />}
  </View>;
}
