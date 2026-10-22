/**
 * Componentes de base do Dr. Moo.
 *
 * Deliberadamente leves: sem biblioteca de UI, sem animações decorativas, sem
 * Reanimated. O alvo é Android 8 com 2 GB de RAM, usado em pé no curral — alvos
 * de toque grandes, fonte a partir de 16 px e contraste alto.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Children, memo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTema } from '../tema';
import { LARGURA_MAXIMA_CONTEUDO, larguraDaColuna, useLayout } from '../responsivo';

export type NomeIcone = keyof typeof MaterialIcons.glyphMap;

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

type VarianteTexto = keyof ReturnType<typeof useTema>['t'];

export function Txt({
  children,
  v = 'corpo',
  cor,
  style,
  numberOfLines,
  centro,
}: {
  children: ReactNode;
  v?: VarianteTexto;
  cor?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  centro?: boolean;
}) {
  const { t, c } = useTema();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[t[v], { color: cor ?? c.texto }, centro && { textAlign: 'center' }, style]}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Tela({
  children,
  scroll = true,
  style,
  largura = 'legivel',
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * `legivel` centraliza e limita a largura — numa tela de computador, uma linha
   * de texto atravessando 2.500 px é ilegível. `cheia` ocupa tudo (listas).
   */
  largura?: 'legivel' | 'cheia';
}) {
  const { c, espaco } = useTema();
  const { amplo } = useLayout();
  const base: ViewStyle = { flex: 1, backgroundColor: c.fundo };

  const limite: ViewStyle =
    largura === 'legivel'
      ? { width: '100%', maxWidth: LARGURA_MAXIMA_CONTEUDO, alignSelf: 'center' }
      : { width: '100%' };

  const preenchimento = amplo ? espaco.xl : espaco.lg;

  if (!scroll) {
    return (
      <View style={[base, style]}>
        <View style={[{ flex: 1 }, limite]}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={base}
      contentContainerStyle={{
        padding: preenchimento,
        paddingBottom: espaco.xxl * 2,
        alignItems: 'center',
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[limite, style]}>{children}</View>
    </ScrollView>
  );
}

/**
 * Grade responsiva: mede o espaço real e distribui os filhos em N colunas.
 * Em pixels porque `gap` somado a `flexBasis` percentual estoura o container.
 */
export function Grade({
  children,
  colunas,
  gap = 12,
  minimo = 240,
}: {
  children: ReactNode;
  /** Quando omitido, usa o máximo de colunas que couber respeitando `minimo`. */
  colunas?: number;
  gap?: number;
  minimo?: number;
}) {
  const [disponivel, setDisponivel] = useState(0);
  const itens = Children.toArray(children);

  const cabem = Math.floor((disponivel + gap) / (minimo + gap));
  const desejadas = colunas ?? (cabem > 0 ? cabem : 1);
  const n = Math.max(1, Math.min(desejadas, itens.length || 1));
  const largura = larguraDaColuna(disponivel, n, gap);

  return (
    <View
      onLayout={(e) => setDisponivel(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}
    >
      {itens.map((filho, i) => (
        <View key={i} style={disponivel > 0 ? { width: largura } : { width: '100%' }}>
          {filho}
        </View>
      ))}
    </View>
  );
}

/** Duas colunas lado a lado no computador, empilhadas no celular. */
export function Colunas({
  children,
  proporcao = [1, 1],
  gap = 16,
}: {
  children: ReactNode;
  proporcao?: number[];
  gap?: number;
}) {
  const { medio, amplo } = useLayout();
  const lado = medio || amplo;
  const itens = Children.toArray(children);

  return (
    <View style={{ flexDirection: lado ? 'row' : 'column', gap, alignItems: 'flex-start' }}>
      {itens.map((filho, i) => (
        <View key={i} style={lado ? { flex: proporcao[i] ?? 1 } : { width: '100%' }}>
          {filho}
        </View>
      ))}
    </View>
  );
}

export function Cartao({
  children,
  style,
  aoTocar,
  destaque,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  aoTocar?: () => void;
  destaque?: string;
}) {
  const { c, espaco, raio } = useTema();
  const conteudo = (
    <View
      style={[
        {
          backgroundColor: c.superficie,
          borderRadius: raio.card,
          borderWidth: 1,
          borderColor: destaque ?? c.borda,
          borderLeftWidth: destaque ? 4 : 1,
          padding: espaco.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!aoTocar) return conteudo;
  return (
    <Pressable onPress={aoTocar} style={({ pressed }) => pressed && { opacity: 0.7 }}>
      {conteudo}
    </Pressable>
  );
}

export function Linha({
  children,
  style,
  entre,
  centro,
  gap,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  entre?: boolean;
  centro?: boolean;
  gap?: number;
}) {
  const { espaco } = useTema();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: centro === false ? 'flex-start' : 'center',
          justifyContent: entre ? 'space-between' : 'flex-start',
          gap: gap ?? espaco.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Barra de ações de uma tela.
 *
 * No celular, botão é faixa: o dedo acerta a largura inteira e a ordem vertical
 * é a ordem de importância. No computador, faixa de 860 px para "Salvar" é
 * desperdício e fica estranho — os botões viram uma linha, com largura própria,
 * alinhados à esquerda e com o aviso ("Salvo", "Importando…") ao lado.
 */
export function Acoes({
  children,
  aviso,
  alinhar = 'esquerda',
}: {
  children: ReactNode;
  /** Texto curto de estado, mostrado ao lado dos botões no computador. */
  aviso?: ReactNode;
  alinhar?: 'esquerda' | 'direita';
}) {
  const { espaco } = useTema();
  const { amplo } = useLayout();

  if (!amplo) {
    return (
      <View style={{ gap: espaco.sm }}>
        {children}
        {aviso}
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: espaco.sm,
        justifyContent: alinhar === 'direita' ? 'flex-end' : 'flex-start',
      }}
    >
      {children}
      {aviso ? <View style={{ marginLeft: espaco.sm }}>{aviso}</View> : null}
    </View>
  );
}

export function Espaco({ h = 12 }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function Separador() {
  const { c, espaco } = useTema();
  return <View style={{ height: 1, backgroundColor: c.borda, marginVertical: espaco.md }} />;
}

/**
 * Título da página. Só aparece no computador: no celular quem dá esse contexto
 * é o cabeçalho do navegador, que ali vale a altura que ocupa.
 */
export function CabecalhoPagina({
  titulo,
  subtitulo,
  acao,
}: {
  titulo: string;
  subtitulo?: string;
  acao?: ReactNode;
}) {
  const { c, espaco } = useTema();
  const { amplo } = useLayout();
  if (!amplo) return null;

  return (
    <Linha entre style={{ marginBottom: espaco.lg }}>
      <View style={{ flex: 1 }}>
        <Txt v="h1">{titulo}</Txt>
        {subtitulo ? (
          <Txt v="label" cor={c.textoSecundario}>
            {subtitulo}
          </Txt>
        ) : null}
      </View>
      {acao}
    </Linha>
  );
}

export function TituloSecao({ children, icone }: { children: ReactNode; icone?: NomeIcone }) {
  const { c, espaco } = useTema();
  return (
    <Linha style={{ marginTop: espaco.xl, marginBottom: espaco.md }}>
      {icone && <MaterialIcons name={icone} size={22} color={c.primaria} />}
      <Txt v="h2">{children}</Txt>
    </Linha>
  );
}

// ---------------------------------------------------------------------------
// Botões
// ---------------------------------------------------------------------------

export function Botao({
  titulo,
  aoTocar,
  variante = 'primario',
  icone,
  desabilitado,
  style,
  grande,
}: {
  titulo: string;
  aoTocar?: () => void;
  variante?: 'primario' | 'secundario' | 'perigo' | 'texto';
  icone?: NomeIcone;
  desabilitado?: boolean;
  style?: StyleProp<ViewStyle>;
  grande?: boolean;
}) {
  const { c, raio, espaco, toque, t } = useTema();

  const fundo =
    variante === 'primario' ? c.primaria : variante === 'perigo' ? c.alerta : 'transparent';
  const corTexto =
    variante === 'primario' || variante === 'perigo'
      ? '#FFFFFF'
      : variante === 'texto'
        ? c.primaria
        : c.texto;
  const borda = variante === 'secundario' ? c.borda : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      disabled={desabilitado}
      onPress={aoTocar}
      style={({ pressed }) => [
        {
          minHeight: grande ? toque.botaoPrimario : toque.minimo,
          borderRadius: raio.input,
          backgroundColor: fundo,
          borderWidth: variante === 'secundario' ? 1 : 0,
          borderColor: borda,
          paddingHorizontal: espaco.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: espaco.sm,
          opacity: desabilitado ? 0.45 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {icone && <MaterialIcons name={icone} size={grande ? 24 : 20} color={corTexto} />}
      <Text style={[grande ? t.h3 : t.corpoForte, { color: corTexto }]}>{titulo}</Text>
    </Pressable>
  );
}

export const Chip = memo(function Chip({
  texto,
  cor,
  icone,
  aoTocar,
  ativo,
}: {
  texto: string;
  cor?: string;
  icone?: NomeIcone;
  aoTocar?: () => void;
  ativo?: boolean;
}) {
  const { c, raio, espaco, t } = useTema();
  const corBase = cor ?? c.primaria;
  const Comp = aoTocar ? Pressable : View;

  return (
    <Comp
      onPress={aoTocar}
      accessibilityRole={aoTocar ? 'button' : undefined}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: raio.chip,
        borderWidth: 1,
        borderColor: corBase,
        backgroundColor: ativo ? corBase : 'transparent',
        paddingVertical: 6,
        paddingHorizontal: espaco.md,
        minHeight: 34,
      }}
    >
      {icone && (
        <MaterialIcons name={icone} size={15} color={ativo ? c.primariaTexto : corBase} />
      )}
      <Text style={[t.caption, { color: ativo ? c.primariaTexto : corBase, fontSize: 13 }]}>
        {texto}
      </Text>
    </Comp>
  );
});

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

export function Kpi({
  rotulo,
  valor,
  unidade,
  meta,
  bom,
  icone,
}: {
  rotulo: string;
  valor: string;
  unidade?: string;
  meta?: string;
  /** true = dentro da meta, false = fora, undefined = neutro. */
  bom?: boolean;
  icone?: NomeIcone;
}) {
  const { c, espaco, raio, t } = useTema();
  const cor = bom === undefined ? c.texto : bom ? c.ok : c.alerta;

  return (
    <View
      style={{
        flex: 1,
        minWidth: 150,
        backgroundColor: c.superficieAlt,
        borderRadius: raio.card,
        padding: espaco.md,
        borderWidth: 1,
        borderColor: c.borda,
      }}
    >
      <Linha gap={4}>
        {icone && <MaterialIcons name={icone} size={16} color={c.textoSecundario} />}
        <Txt v="caption" cor={c.textoSecundario} numberOfLines={2} style={{ flex: 1 }}>
          {rotulo}
        </Txt>
      </Linha>
      <Linha gap={4} style={{ marginTop: 2 }}>
        <Text style={[t.numero, { color: cor }]}>{valor}</Text>
        {unidade && <Txt v="caption" cor={c.textoSecundario}>{unidade}</Txt>}
      </Linha>
      {meta && (
        <Txt v="caption" cor={c.textoSecundario}>
          {meta}
        </Txt>
      )}
    </View>
  );
}

export function Alerta({
  titulo,
  texto,
  tipo = 'atencao',
  icone,
  aoTocar,
}: {
  titulo: string;
  texto?: string;
  tipo?: 'alerta' | 'atencao' | 'ok' | 'info';
  icone?: NomeIcone;
  aoTocar?: () => void;
}) {
  const { c, espaco, raio } = useTema();
  const cor =
    tipo === 'alerta' ? c.alerta : tipo === 'atencao' ? c.atencao : tipo === 'ok' ? c.ok : c.primaria;
  const iconePadrao: NomeIcone =
    tipo === 'alerta' ? 'error' : tipo === 'atencao' ? 'warning' : tipo === 'ok' ? 'check-circle' : 'info';

  const Comp = aoTocar ? Pressable : View;
  return (
    <Comp
      onPress={aoTocar}
      style={{
        flexDirection: 'row',
        gap: espaco.md,
        backgroundColor: tipo === 'alerta' ? c.alertaFundo : c.superficieAlt,
        borderRadius: raio.card,
        borderLeftWidth: 4,
        borderLeftColor: cor,
        padding: espaco.md,
        alignItems: 'flex-start',
      }}
    >
      <MaterialIcons name={icone ?? iconePadrao} size={22} color={cor} />
      <View style={{ flex: 1 }}>
        <Txt v="corpoForte" cor={cor}>
          {titulo}
        </Txt>
        {texto ? (
          <Txt v="label" cor={c.textoSecundario} style={{ marginTop: 2 }}>
            {texto}
          </Txt>
        ) : null}
      </View>
      {aoTocar && <MaterialIcons name="chevron-right" size={22} color={c.textoSecundario} />}
    </Comp>
  );
}

export function Barra({ fracao, cor }: { fracao: number; cor: string }) {
  const { c } = useTema();
  return (
    <View
      style={{
        height: 8,
        borderRadius: 4,
        backgroundColor: c.borda,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${Math.max(0, Math.min(1, fracao)) * 100}%`,
          height: '100%',
          backgroundColor: cor,
        }}
      />
    </View>
  );
}

export function Carregando({
  texto = 'Carregando…',
  cor,
}: {
  texto?: string;
  /** Use sobre fundos que não são a superfície padrão — a abertura é teal. */
  cor?: string;
}) {
  const { c, espaco } = useTema();
  return (
    <View style={{ padding: espaco.xxl, alignItems: 'center', gap: espaco.md }}>
      <ActivityIndicator color={cor ?? c.primaria} />
      <Txt v="label" cor={cor ?? c.textoSecundario}>
        {texto}
      </Txt>
    </View>
  );
}

export function Vazio({ icone, titulo, texto }: { icone: NomeIcone; titulo: string; texto?: string }) {
  const { c, espaco } = useTema();
  return (
    <View style={{ padding: espaco.xxl, alignItems: 'center', gap: espaco.sm }}>
      <MaterialIcons name={icone} size={44} color={c.borda} />
      <Txt v="h3" cor={c.textoSecundario} centro>
        {titulo}
      </Txt>
      {texto && (
        <Txt v="label" cor={c.textoSecundario} centro>
          {texto}
        </Txt>
      )}
    </View>
  );
}

/** Aviso obrigatório em todo parecer (specsDrMoo.md §2). */
export function AvisoVeterinario() {
  const { c, espaco } = useTema();
  return (
    <Linha gap={espaco.sm} style={{ marginTop: espaco.lg }} centro={false}>
      <MaterialIcons name="info-outline" size={16} color={c.textoSecundario} />
      <Txt v="caption" cor={c.textoSecundario} style={{ flex: 1 }}>
        Orientação de triagem. O Dr. Moo não substitui o exame do médico-veterinário.
      </Txt>
    </Linha>
  );
}

export const estilos = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});

export { MaterialIcons };
