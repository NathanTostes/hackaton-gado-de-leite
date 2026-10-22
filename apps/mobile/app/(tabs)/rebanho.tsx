/**
 * Rebanho — busca e filtros.
 *
 * A busca livre é por palavras: cada termo precisa aparecer em algum campo do
 * animal (brinco, nome, tatuagem, raça, pelagem, lote, procedência, GTA, pais,
 * observações), sem distinguir acento nem caixa. Quem está no curral digita o
 * que lembra — "holandesa lactacao", "mimosa 3" — e não a consulta exata.
 *
 * Os filtros finos ficam num painel que começa fechado: a tela precisa abrir
 * útil no celular, e quem quer recorte fino vai atrás dele.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import {
  ROTULO_STATUS,
  listarLotes,
  listarRebanho,
  type AnimalComResumo,
  type FiltrosRebanho,
  type StatusAnimal,
} from '@drmoo/db';
import { ROTULO_CATEGORIA, numero, type CategoriaAnimal } from '@drmoo/domain';
import {
  FILTROS_VAZIOS,
  alternarNaLista,
  contarAtivos,
  idadeLegivel,
  montarFiltros,
  resumirLista,
  type EstadoFiltros,
} from '../../src/telas/filtrosRebanho';
import { corCMT, siglaCMT } from '@drmoo/ui';
import {
  Botao,
  CabecalhoPagina,
  Carregando,
  Chip,
  Linha,
  MaterialIcons,
  Tela,
  Txt,
  Vazio,
} from '../../src/componentes/base';
import { useDados } from '../../src/hooks';
import { useLayout } from '../../src/responsivo';
import { useTema } from '../../src/tema';

const CATEGORIAS: CategoriaAnimal[] = [
  'vaca_lactacao',
  'vaca_seca',
  'novilha',
  'bezerra_1_2_anos',
  'bezerro_desmamado',
  'bezerro_mamando',
  'touro',
  'novilho',
  'boi_carro',
];

// Falecidos, vendidos e descartados ficam fora da lista ativa.
// Os botões de histórico mantêm suas fichas e prontuários acessíveis.
const STATUS: StatusAnimal[] = ['saudavel', 'suspeito', 'em_tratamento', 'em_carencia', 'mastite_cronica', 'quarentena'];

const ORDENS: { chave: NonNullable<FiltrosRebanho['ordenarPor']>; rotulo: string }[] = [
  { chave: 'brinco', rotulo: 'Brinco' },
  { chave: 'nome', rotulo: 'Nome' },
  { chave: 'producao', rotulo: 'Produção' },
  { chave: 'del', rotulo: 'DEL' },
  { chave: 'idade', rotulo: 'Idade' },
  { chave: 'cmt', rotulo: 'CMT' },
  { chave: 'lote', rotulo: 'Lote' },
  { chave: 'parto', rotulo: 'Parto previsto' },
  { chave: 'alerta', rotulo: 'Alertas' },
];

const CMT_MINIMO: { chave: '1' | '2' | '3'; rotulo: string }[] = [
  { chave: '1', rotulo: 'CMT ≥ 1' },
  { chave: '2', rotulo: 'CMT ≥ 2' },
  { chave: '3', rotulo: 'CMT 3' },
];

export default function Rebanho() {
  const { c, espaco } = useTema();
  const { amplo, largura } = useLayout();
  const params = useLocalSearchParams<{ carencia?: string; cmt?: string }>();

  // No computador a lista vira grade: 90 animais numa coluna só desperdiçam a tela.
  const colunas = amplo ? (largura >= 1500 ? 3 : 2) : 1;

  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [painelAberto, setPainelAberto] = useState(false);
  const [ordem, setOrdem] = useState<NonNullable<FiltrosRebanho['ordenarPor']>>('brinco');
  const [decrescente, setDecrescente] = useState(false);
  const [f, setF] = useState<EstadoFiltros>({
    ...FILTROS_VAZIOS,
    emCarencia: params.carencia === '1',
    cmtMinimo: params.cmt === '1' ? '1' : null,
  });

  // Uma consulta por tecla digitada trava o aparelho fraco; 250 ms é o bastante
  // para a lista parecer instantânea sem refazer a query letra a letra.
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca), 250);
    return () => clearTimeout(t);
  }, [busca]);

  const { dados: lotes } = useDados(() => listarLotes(), []);

  const filtros = useMemo<FiltrosRebanho>(
    () => montarFiltros(f, buscaAplicada, ordem, decrescente),
    [buscaAplicada, f, ordem, decrescente],
  );

  const { dados, carregando } = useDados(() => listarRebanho(filtros), [filtros]);

  const ativos = contarAtivos(f);
  const alternar = <K extends keyof EstadoFiltros>(chave: K, valor: EstadoFiltros[K]) =>
    setF((atual) => ({ ...atual, [chave]: valor }));

  const limpar = () => {
    setF(FILTROS_VAZIOS);
    setBusca('');
    setOrdem('brinco');
    setDecrescente(false);
  };

  const resumo = useMemo(() => resumirLista(dados ?? []), [dados]);

  const cabecalho = (
      <View style={{ paddingTop: espaco.lg, paddingBottom: espaco.sm, gap: espaco.md }}>
        <CabecalhoPagina titulo="Rebanho" subtitulo="Busque e filtre os animais da propriedade" />
        <Linha style={{ flexWrap: 'wrap', marginBottom: espaco.md }}>
          <Botao titulo="Gado falecido" icone="history" variante="secundario" aoTocar={() => router.push('/falecidos')} />
          <Botao titulo="Gado vendido" icone="sell" variante="secundario" aoTocar={() => router.push('/vendidos')} />
        </Linha>

        <Linha
          style={{
            borderWidth: 1,
            borderColor: c.borda,
            borderRadius: 8,
            paddingHorizontal: espaco.md,
            backgroundColor: c.superficieAlt,
          }}
        >
          <MaterialIcons name="search" size={22} color={c.textoSecundario} />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Buscar animais"
            placeholder="Brinco, nome, tatuagem, raça, pelagem, lote, procedência, GTA…"
            placeholderTextColor={c.textoSecundario}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 48,
              color: c.texto,
              fontFamily: 'Inter_400Regular',
              fontSize: 16,
            }}
          />
          {busca.length > 0 && (
            <MaterialIcons
              name="close"
              size={22}
              color={c.textoSecundario}
              onPress={() => setBusca('')}
            />
          )}
        </Linha>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm }}>
          {CATEGORIAS.map((item) => (
            <Chip key={item} texto={ROTULO_CATEGORIA[item]}
              ativo={f.categorias.includes(item)}
              aoTocar={() => alternar('categorias', alternarNaLista(f.categorias, item))} />
          ))}
        </View>

        <Linha gap={espaco.sm} style={{ flexWrap: 'wrap' }}>
          <Chip
            texto="Em carência"
            icone="block"
            cor={c.alerta}
            ativo={f.emCarencia}
            aoTocar={() => alternar('emCarencia', !f.emCarencia)}
          />
          <Chip
            texto="CMT positivo"
            icone="science"
            cor={c.atencao}
            ativo={f.cmtMinimo === '1'}
            aoTocar={() => alternar('cmtMinimo', f.cmtMinimo === '1' ? null : '1')}
          />
          <Chip
            texto={ativos ? `Filtros (${ativos})` : 'Filtros'}
            icone={painelAberto ? 'expand-less' : 'tune'}
            ativo={painelAberto}
            aoTocar={() => setPainelAberto((v) => !v)}
          />
          {(ativos > 0 || busca.length > 0) && (
            <Chip texto="Limpar" icone="backspace" cor={c.textoSecundario} aoTocar={limpar} />
          )}
        </Linha>

        {painelAberto && (
          <View
            style={{
              borderWidth: 1,
              borderColor: c.borda,
              borderRadius: 10,
              backgroundColor: c.superficie,
              padding: espaco.md,
              gap: espaco.md,
            }}
          >
            <Grupo titulo="Situação">
              {STATUS.map((s) => (
                <Chip
                  key={s}
                  texto={ROTULO_STATUS[s]}
                  ativo={f.status.includes(s)}
                  aoTocar={() => alternar('status', alternarNaLista(f.status, s))}
                />
              ))}
            </Grupo>

            <Grupo titulo="Sexo">
              <Chip texto="Fêmeas" ativo={f.sexo === 'F'} aoTocar={() => alternar('sexo', f.sexo === 'F' ? null : 'F')} />
              <Chip texto="Machos" ativo={f.sexo === 'M'} aoTocar={() => alternar('sexo', f.sexo === 'M' ? null : 'M')} />
            </Grupo>

            {!!lotes?.length && (
              <Grupo titulo="Lote">
                {lotes.map((l) => (
                  <Chip
                    key={l.id}
                    texto={`${l.nome} (${l.animais})`}
                    ativo={f.loteId === l.id}
                    aoTocar={() =>
                      setF((atual) => ({ ...atual, loteId: atual.loteId === l.id ? null : l.id, semLote: false }))
                    }
                  />
                ))}
                <Chip
                  texto="Sem lote"
                  cor={c.textoSecundario}
                  ativo={f.semLote}
                  aoTocar={() => setF((atual) => ({ ...atual, semLote: !atual.semLote, loteId: null }))}
                />
              </Grupo>
            )}

            <Grupo titulo="Saúde do úbere">
              {CMT_MINIMO.map((o) => (
                <Chip
                  key={o.chave}
                  texto={o.rotulo}
                  cor={c.atencao}
                  ativo={f.cmtMinimo === o.chave}
                  aoTocar={() => alternar('cmtMinimo', f.cmtMinimo === o.chave ? null : o.chave)}
                />
              ))}
              <Chip
                texto="Peito perdido"
                cor={c.alerta}
                ativo={f.peitoPerdido}
                aoTocar={() => alternar('peitoPerdido', !f.peitoPerdido)}
              />
            </Grupo>

            <Grupo titulo="Reprodução">
              <Chip texto="Prenhes" icone="pregnant-woman" ativo={f.prenhe} aoTocar={() => alternar('prenhe', !f.prenhe)} />
              <Chip
                texto="Parto em 60 dias"
                icone="event"
                ativo={f.partoEm60}
                aoTocar={() => alternar('partoEm60', !f.partoEm60)}
              />
            </Grupo>

            <Grupo titulo="Faixas">
              <Faixa
                rotulo="DEL (dias)"
                de={f.delMin}
                ate={f.delMax}
                aoMudarDe={(v) => alternar('delMin', v)}
                aoMudarAte={(v) => alternar('delMax', v)}
              />
              <Faixa
                rotulo="Idade (meses)"
                de={f.idadeMin}
                ate={f.idadeMax}
                aoMudarDe={(v) => alternar('idadeMin', v)}
                aoMudarAte={(v) => alternar('idadeMax', v)}
              />
              <Faixa
                rotulo="Produção (L/dia)"
                de={f.producaoMin}
                ate={f.producaoMax}
                aoMudarDe={(v) => alternar('producaoMin', v)}
                aoMudarAte={(v) => alternar('producaoMax', v)}
              />
            </Grupo>

            <Grupo titulo="Ordenar por">
              {ORDENS.map((o) => (
                <Chip key={o.chave} texto={o.rotulo} ativo={ordem === o.chave} aoTocar={() => setOrdem(o.chave)} />
              ))}
              <Chip
                texto={decrescente ? 'Decrescente' : 'Crescente'}
                icone={decrescente ? 'arrow-downward' : 'arrow-upward'}
                cor={c.textoSecundario}
                ativo
                aoTocar={() => setDecrescente((v) => !v)}
              />
            </Grupo>

            <Botao titulo="Limpar filtros" icone="backspace" variante="secundario" aoTocar={limpar} />
          </View>
        )}
      </View>

  );

  return (
    <Tela scroll={false}>
      <FlatList
        // Uma única rolagem mantém o fim dos filtros acessível em qualquer altura.
        key={`colunas-${colunas}`}
        style={{ flex: 1 }}
        data={dados ?? []}
        keyExtractor={(animal) => animal.id}
        numColumns={colunas}
        columnWrapperStyle={colunas > 1 ? { gap: espaco.sm } : undefined}
        contentContainerStyle={{ paddingHorizontal: espaco.lg, paddingBottom: espaco.xxl, gap: espaco.sm }}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<>
          {cabecalho}
          {!!dados?.length && <Txt v="caption" cor={c.textoSecundario} style={{ marginBottom: espaco.sm }}>
            {`${dados.length} animal(is)`}
            {resumo?.litros ? ` · ${numero(resumo.litros)} L/dia no recorte` : ''}
            {resumo?.comAlerta ? ` · ${resumo.comAlerta} com alerta` : ''}
          </Txt>}
        </>}
        ListEmptyComponent={carregando ? <Carregando /> : <Vazio
          icone="search-off" titulo="Nenhum animal encontrado"
          texto={ativos || busca
            ? 'Nenhum animal atende a todos os critérios. Tire um filtro ou simplifique a busca.'
            : 'Cadastre o primeiro animal da propriedade.'} />}
        renderItem={({ item }) => <View style={{ ...(colunas > 1 ? { flex: 1 / colunas } : {}), minWidth: 0 }}>
          <ItemRebanho animal={item} />
        </View>}
      />
    </Tela>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const { c, espaco } = useTema();
  return (
    <View style={{ gap: espaco.sm }}>
      <Txt v="caption" cor={c.textoSecundario}>
        {titulo}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm }}>{children}</View>
    </View>
  );
}

function Faixa({
  rotulo,
  de,
  ate,
  aoMudarDe,
  aoMudarAte,
}: {
  rotulo: string;
  de: string;
  ate: string;
  aoMudarDe: (v: string) => void;
  aoMudarAte: (v: string) => void;
}) {
  const { c, espaco } = useTema();
  return (
    <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 0, maxWidth: '100%', gap: espaco.sm }}>
      <Txt v="caption">{rotulo}</Txt>
      <Linha gap={espaco.sm}>
        <CampoNumero valor={de} aoMudar={aoMudarDe} rotulo={`${rotulo} — mínimo`} placeholder="de" />
        <Txt v="caption" cor={c.textoSecundario}>até</Txt>
        <CampoNumero valor={ate} aoMudar={aoMudarAte} rotulo={`${rotulo} — máximo`} placeholder="até" />
      </Linha>
    </View>
  );
}

function CampoNumero({
  valor,
  aoMudar,
  rotulo,
  placeholder,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  rotulo: string;
  placeholder: string;
}) {
  const { c, raio } = useTema();
  return (
    <TextInput
      value={valor}
      onChangeText={(v) => aoMudar(v.replace(/[^0-9.,]/g, ''))}
      keyboardType="numeric"
      accessibilityLabel={rotulo}
      placeholder={placeholder}
      placeholderTextColor={c.textoSecundario}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 40,
        borderWidth: 1,
        borderColor: c.borda,
        borderRadius: raio.input,
        paddingHorizontal: 10,
        backgroundColor: c.superficieAlt,
        color: c.texto,
        fontFamily: 'Inter_400Regular',
        fontSize: 15,
      }}
    />
  );
}

function ItemRebanho({ animal }: { animal: AnimalComResumo }) {
  const { c, espaco, raio } = useTema();
  const cmt = animal.ultimo_cmt;
  const alerta =
    animal.status === 'suspeito'
      ? { cor: c.alerta, icone: 'warning' as const }
      : animal.status === 'em_carencia'
        ? { cor: c.alerta, icone: 'block' as const }
        : animal.status === 'em_tratamento'
          ? { cor: c.atencao, icone: 'medication' as const }
          : animal.status === 'mastite_cronica'
            ? { cor: c.alerta, icone: 'coronavirus' as const }
            : animal.status === 'quarentena'
              ? { cor: c.atencao, icone: 'shield' as const }
              : null;

  const idade = idadeLegivel(animal.idade_meses);
  const detalhes = [
    ROTULO_CATEGORIA[animal.categoria],
    animal.raca,
    idade,
    animal.lote_nome,
    animal.del !== null ? `${animal.del} DEL` : null,
    animal.producao_media_dia ? `${numero(animal.producao_media_dia)} L/dia` : null,
  ].filter(Boolean);

  return (
    <Pressable
      onPress={() => router.push(`/animal/${animal.id}`)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espaco.md,
        backgroundColor: c.superficie,
        borderWidth: 1,
        borderColor: alerta ? alerta.cor : c.borda,
        borderLeftWidth: alerta ? 4 : 1,
        borderRadius: raio.card,
        padding: espaco.md,
        minHeight: 72,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: c.superficieAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt v="corpoForte" cor={c.primaria}>
          {animal.brinco}
        </Txt>
      </View>

      <View style={{ flex: 1 }}>
        <Txt v="corpoForte" numberOfLines={1}>
          {animal.nome ?? `Brinco ${animal.brinco}`}
        </Txt>
        <Txt v="caption" cor={c.textoSecundario} numberOfLines={2}>
          {detalhes.join(' · ')}
        </Txt>
        <Linha gap={6} style={{ marginTop: 4, flexWrap: 'wrap' }}>
          {alerta && (
            <Chip texto={ROTULO_STATUS[animal.status]} cor={alerta.cor} icone={alerta.icone} />
          )}
          {cmt && cmt !== 'N' && (
            <Chip texto={`CMT ${siglaCMT[cmt] ?? cmt}`} cor={corCMT[cmt] ?? c.borda} />
          )}
          {animal.tem_peito_perdido && <Chip texto="PP" cor={c.textoSecundario} />}
          {animal.data_provavel_parto && (
            <Chip
              texto={`Parto ${new Date(animal.data_provavel_parto).toLocaleDateString('pt-BR')}`}
              cor={c.primaria}
              icone="event"
            />
          )}
        </Linha>
      </View>

      <MaterialIcons name="chevron-right" size={24} color={c.textoSecundario} />
    </Pressable>
  );
}
