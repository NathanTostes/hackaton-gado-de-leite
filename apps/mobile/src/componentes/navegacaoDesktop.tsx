/**
 * Navegação para telas grandes.
 *
 * O app continua mobile-first: no celular nada disso aparece e o fluxo é o mesmo
 * de sempre — abas embaixo, uma coluna. No computador, a barra inferior de abas
 * (que num monitor de 27" fica longe da mão e do olho) dá lugar a uma barra
 * lateral, e a marca sobe para um cabeçalho fixo.
 *
 * Implementado por fora do navegador de propósito: o Expo Router 58 não usa mais
 * o React Navigation, e depender de opções internas dele seria frágil.
 */
import { Image, Pressable, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { MaterialIcons, Txt, type NomeIcone } from './base';
import { useTema } from '../tema';

export interface ItemNavegacao {
  rota: string;
  rotulo: string;
  icone: NomeIcone;
}

/** Abas principais — as mesmas de `(tabs)`. */
export const ABAS: ItemNavegacao[] = [
  { rota: '/', rotulo: 'Início', icone: 'dashboard' },
  { rota: '/rebanho', rotulo: 'Rebanho', icone: 'pets' },
  { rota: '/saude', rotulo: 'Saúde', icone: 'health-and-safety' },
  { rota: '/calendario', rotulo: 'Calendário', icone: 'calendar-month' },
];

/** No celular estas telas moram em "Mais"; no computador cabem na lateral. */
export const SECUNDARIAS: ItemNavegacao[] = [
  { rota: '/financeiro', rotulo: 'Financeiro', icone: 'payments' },
  { rota: '/conhecimento', rotulo: 'Base de conhecimento', icone: 'account-tree' },
  { rota: '/triagem', rotulo: 'Triagem', icone: 'fact-check' },
  { rota: '/rede-local', rotulo: 'Rede local', icone: 'wifi-tethering' },
  { rota: '/configuracoes', rotulo: 'Configurações', icone: 'settings' },
];

export const LARGURA_LATERAL = 236;
export const ALTURA_BARRA_SUPERIOR = 60;

function rotaAtiva(caminho: string, rota: string): boolean {
  if (rota === '/') return caminho === '/' || caminho === '/index';
  return caminho === rota || caminho.startsWith(`${rota}/`);
}

// ---------------------------------------------------------------------------

export function BarraSuperior({ nomeDaPropriedade }: { nomeDaPropriedade?: string | null }) {
  const { c, espaco } = useTema();

  return (
    <View
      style={{
        height: ALTURA_BARRA_SUPERIOR,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: espaco.lg,
        gap: espaco.md,
        backgroundColor: c.primaria,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.12)',
      }}
    >
      <Pressable
        onPress={() => router.push('/')}
        accessibilityRole="link"
        accessibilityLabel="Dr. Moo — ir para o início"
        style={({ pressed }) => [
          { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Image
          source={require('../../assets/logo-dr-moo.jpg')}
          style={{ width: 38, height: 38, borderRadius: 9 }}
        />
        <View>
          <Txt v="h3" cor="#FFFFFF">
            Dr. Moo
          </Txt>
          <Txt v="caption" cor="rgba(255,255,255,0.72)">
            Anamnese e triagem de bovinos leiteiros
          </Txt>
        </View>
      </Pressable>

      <View style={{ flex: 1 }} />

      {nomeDaPropriedade ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialIcons name="home-work" size={16} color="rgba(255,255,255,0.72)" />
          <Txt v="label" cor="rgba(255,255,255,0.92)">
            {nomeDaPropriedade}
          </Txt>
        </View>
      ) : null}

      <Pressable
        onPress={() => router.push('/anamnese')}
        accessibilityRole="button"
        accessibilityLabel="Nova anamnese"
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            height: 40,
            paddingHorizontal: espaco.lg,
            borderRadius: 8,
            backgroundColor: 'rgba(255,255,255,0.14)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.3)',
          },
          pressed && { opacity: 0.75 },
        ]}
      >
        <MaterialIcons name="medical-services" size={18} color="#FFFFFF" />
        <Txt v="label" cor="#FFFFFF">
          Nova anamnese
        </Txt>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------

export function BarraLateral() {
  const { c, espaco } = useTema();
  const caminho = usePathname();

  return (
    <View
      style={{
        width: LARGURA_LATERAL,
        backgroundColor: c.superficieAlt,
        borderRightWidth: 1,
        borderRightColor: c.borda,
        paddingVertical: espaco.md,
        paddingHorizontal: espaco.sm,
        gap: 2,
      }}
    >
      {ABAS.map((item) => (
        <ItemLateral key={item.rota} item={item} ativo={rotaAtiva(caminho, item.rota)} />
      ))}

      <View
        style={{
          height: 1,
          backgroundColor: c.borda,
          marginVertical: espaco.md,
          marginHorizontal: espaco.sm,
        }}
      />
      <Txt
        v="caption"
        cor={c.textoSecundario}
        style={{ paddingHorizontal: espaco.md, marginBottom: 4 }}
      >
        GESTÃO
      </Txt>

      {SECUNDARIAS.map((item) => (
        <ItemLateral key={item.rota} item={item} ativo={rotaAtiva(caminho, item.rota)} />
      ))}
    </View>
  );
}

function ItemLateral({ item, ativo }: { item: ItemNavegacao; ativo: boolean }) {
  const { c, espaco } = useTema();

  return (
    <Pressable
      onPress={() => router.push(item.rota)}
      accessibilityRole="link"
      accessibilityState={{ selected: ativo }}
      accessibilityLabel={item.rotulo}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: espaco.md,
          minHeight: 44,
          paddingHorizontal: espaco.md,
          borderRadius: 8,
          backgroundColor: ativo ? c.primaria : 'transparent',
        },
        pressed && !ativo && { backgroundColor: c.borda },
      ]}
    >
      <MaterialIcons
        name={item.icone}
        size={20}
        color={ativo ? c.primariaTexto : c.textoSecundario}
      />
      <Txt v="label" cor={ativo ? c.primariaTexto : c.texto} numberOfLines={1}>
        {item.rotulo}
      </Txt>
    </Pressable>
  );
}
