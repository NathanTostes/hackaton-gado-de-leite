import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { ROTULO_STATUS, listarRebanho, type AnimalComResumo, type FiltrosRebanho } from '@drmoo/db';
import { ROTULO_CATEGORIA, numero, type CategoriaAnimal } from '@drmoo/domain';
import { corCMT, siglaCMT } from '@drmoo/ui';
import {
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
];

const ORDENS: { chave: NonNullable<FiltrosRebanho['ordenarPor']>; rotulo: string }[] = [
  { chave: 'brinco', rotulo: 'Brinco' },
  { chave: 'producao', rotulo: 'Produção' },
  { chave: 'del', rotulo: 'DEL' },
  { chave: 'alerta', rotulo: 'Alertas' },
];

export default function Rebanho() {
  const { c, espaco } = useTema();
  const { amplo, largura } = useLayout();
  const params = useLocalSearchParams<{ carencia?: string; cmt?: string }>();

  // No computador a lista vira grade: 90 animais numa coluna só desperdiçam a tela.
  const colunas = amplo ? (largura >= 1500 ? 3 : 2) : 1;

  const [busca, setBusca] = useState('');
  const [categorias, setCategorias] = useState<CategoriaAnimal[]>([]);
  const [soCarencia, setSoCarencia] = useState(params.carencia === '1');
  const [soCmtPositivo, setSoCmtPositivo] = useState(params.cmt === '1');
  const [ordem, setOrdem] = useState<NonNullable<FiltrosRebanho['ordenarPor']>>('brinco');

  const filtros = useMemo<FiltrosRebanho>(
    () => ({
      busca,
      categorias: categorias.length ? categorias : undefined,
      emCarencia: soCarencia || undefined,
      cmtPositivo: soCmtPositivo || undefined,
      ordenarPor: ordem,
    }),
    [busca, categorias, soCarencia, soCmtPositivo, ordem],
  );

  const { dados, carregando } = useDados(() => listarRebanho(filtros), [filtros]);

  const alternarCategoria = (cat: CategoriaAnimal) =>
    setCategorias((atual) =>
      atual.includes(cat) ? atual.filter((x) => x !== cat) : [...atual, cat],
    );

  return (
    <Tela scroll={false}>
      <View style={{ padding: espaco.lg, paddingBottom: espaco.sm, gap: espaco.md }}>
        <CabecalhoPagina
          titulo="Rebanho"
          subtitulo="Busque e filtre os animais da propriedade"
        />
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
            placeholder="Buscar por brinco, nome ou tatuagem"
            placeholderTextColor={c.textoSecundario}
            style={{
              flex: 1,
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

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIAS}
          keyExtractor={(x) => x}
          contentContainerStyle={{ gap: espaco.sm }}
          renderItem={({ item }) => (
            <Chip
              texto={ROTULO_CATEGORIA[item]}
              ativo={categorias.includes(item)}
              aoTocar={() => alternarCategoria(item)}
            />
          )}
        />

        <Linha gap={espaco.sm}>
          <Chip
            texto="Em carência"
            icone="block"
            cor={c.alerta}
            ativo={soCarencia}
            aoTocar={() => setSoCarencia((v) => !v)}
          />
          <Chip
            texto="CMT positivo"
            icone="science"
            cor={c.atencao}
            ativo={soCmtPositivo}
            aoTocar={() => setSoCmtPositivo((v) => !v)}
          />
        </Linha>

        <Linha gap={espaco.sm}>
          <Txt v="caption" cor={c.textoSecundario}>
            Ordenar:
          </Txt>
          {ORDENS.map((o) => (
            <Chip
              key={o.chave}
              texto={o.rotulo}
              ativo={ordem === o.chave}
              aoTocar={() => setOrdem(o.chave)}
            />
          ))}
        </Linha>
      </View>

      {carregando && !dados ? (
        <Carregando />
      ) : !dados || dados.length === 0 ? (
        <Vazio
          icone="search-off"
          titulo="Nenhum animal encontrado"
          texto="Ajuste a busca ou os filtros."
        />
      ) : (
        <FlatList
          // numColumns não pode mudar sem remontar a lista.
          key={`colunas-${colunas}`}
          data={dados}
          keyExtractor={(a) => a.id}
          numColumns={colunas}
          columnWrapperStyle={colunas > 1 ? { gap: espaco.sm } : undefined}
          contentContainerStyle={{ padding: espaco.lg, paddingTop: 0, gap: espaco.sm }}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          ListHeaderComponent={
            <Txt v="caption" cor={c.textoSecundario} style={{ marginBottom: espaco.sm }}>
              {dados.length} animal(is)
            </Txt>
          }
          renderItem={({ item }) => (
            <View style={colunas > 1 ? { flex: 1 / colunas } : undefined}>
              <ItemRebanho animal={item} />
            </View>
          )}
        />
      )}
    </Tela>
  );
}

function ItemRebanho({ animal }: { animal: AnimalComResumo }) {
  const { c, espaco, raio } = useTema();
  const cmt = animal.ultimo_cmt;
  const alerta =
    animal.status === 'em_carencia'
      ? { cor: c.alerta, icone: 'block' as const }
      : animal.status === 'em_tratamento'
        ? { cor: c.atencao, icone: 'medication' as const }
        : animal.status === 'mastite_cronica'
          ? { cor: c.alerta, icone: 'coronavirus' as const }
          : animal.status === 'quarentena'
            ? { cor: c.atencao, icone: 'shield' as const }
            : null;

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
        <Txt v="caption" cor={c.textoSecundario} numberOfLines={1}>
          {ROTULO_CATEGORIA[animal.categoria]}
          {animal.del !== null ? ` · ${animal.del} DEL` : ''}
          {animal.producao_media_dia ? ` · ${numero(animal.producao_media_dia)} L/dia` : ''}
        </Txt>
        <Linha gap={6} style={{ marginTop: 4 }}>
          {alerta && (
            <Chip texto={ROTULO_STATUS[animal.status]} cor={alerta.cor} icone={alerta.icone} />
          )}
          {cmt && cmt !== 'N' && (
            <Chip texto={`CMT ${siglaCMT[cmt] ?? cmt}`} cor={corCMT[cmt] ?? c.borda} />
          )}
          {animal.tem_peito_perdido && <Chip texto="PP" cor={c.textoSecundario} />}
        </Linha>
      </View>

      <MaterialIcons name="chevron-right" size={24} color={c.textoSecundario} />
    </Pressable>
  );
}
