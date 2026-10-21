/**
 * Tokens do design system do Dr. Moo.
 *
 * A paleta foi amostrada diretamente da logo (`reference/logoDrMoo.jpeg`):
 * o teal do fundo é a cor primária, e o creme, o preto azulado, o verde do selo
 * de check e o rosa do focinho vêm dos próprios pixels do desenho.
 *
 * O app é usado em pé, no curral, sob sol forte e às vezes de madrugada:
 * contraste alto vence elegância, e nada é comunicado só por cor.
 */

export const cores = {
  // Marca
  tealProfundo: '#015B66',
  tealEscuro: '#01434B',
  tealClaro: '#0E7F8C',
  tealSuave: '#E0F0F2',

  // Neutros
  branco: '#FFFFFF',
  creme: '#FEF6E9',
  preto: '#0F1F2C',

  cinza50: '#F6F7F8',
  cinza100: '#ECEEF0',
  cinza200: '#DCE1E4',
  cinza300: '#C9CFD4',
  cinza500: '#7A858D',
  cinza700: '#424E57',

  // Semânticas, derivadas da logo
  verdeOk: '#7ED7A1',
  verdeOkEscuro: '#2E8B5A',
  rosa: '#FEA79D',
  rosaEscuro: '#C25B50',
  atencao: '#E8A33D',
  atencaoEscuro: '#9A6410',
  alerta: '#C0392B',
  alertaClaro: '#FCEAE7',
} as const;

export const espaco = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const raio = {
  input: 8,
  card: 12,
  chip: 999,
} as const;

/** Mínimo 16 px no corpo: o usuário no campo muitas vezes tem presbiopia. */
export const tipografia = {
  display: { fontSize: 32, lineHeight: 38, fontFamily: 'Inter_700Bold' },
  h1: { fontSize: 24, lineHeight: 30, fontFamily: 'Inter_600SemiBold' },
  h2: { fontSize: 20, lineHeight: 26, fontFamily: 'Inter_600SemiBold' },
  h3: { fontSize: 17, lineHeight: 23, fontFamily: 'Inter_600SemiBold' },
  corpo: { fontSize: 16, lineHeight: 24, fontFamily: 'Inter_400Regular' },
  corpoForte: { fontSize: 16, lineHeight: 24, fontFamily: 'Inter_500Medium' },
  label: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium' },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_400Regular' },
  numero: { fontSize: 28, lineHeight: 34, fontFamily: 'Inter_700Bold' },
} as const;

/** Alvo de toque mínimo — uso com luva ou mão suja. */
export const toque = {
  minimo: 48,
  botaoPrimario: 56,
} as const;

export interface TemaCores {
  primaria: string;
  primariaTexto: string;
  fundo: string;
  superficie: string;
  superficieAlt: string;
  borda: string;
  texto: string;
  textoSecundario: string;
  ok: string;
  atencao: string;
  alerta: string;
  alertaFundo: string;
  destaque: string;
}

export const temaClaro: TemaCores = {
  primaria: cores.tealProfundo,
  primariaTexto: cores.branco,
  fundo: cores.branco,
  superficie: cores.branco,
  superficieAlt: cores.creme,
  borda: cores.cinza200,
  texto: cores.preto,
  textoSecundario: cores.cinza700,
  ok: cores.verdeOkEscuro,
  atencao: cores.atencaoEscuro,
  alerta: cores.alerta,
  alertaFundo: cores.alertaClaro,
  destaque: cores.tealClaro,
};

export const temaEscuro: TemaCores = {
  primaria: cores.tealClaro,
  primariaTexto: cores.preto,
  fundo: cores.preto,
  superficie: '#152635',
  superficieAlt: '#1C3040',
  borda: '#2A3C4C',
  texto: cores.branco,
  textoSecundario: cores.cinza300,
  ok: cores.verdeOk,
  atencao: cores.atencao,
  alerta: '#F08376',
  alertaFundo: '#3A1A16',
  destaque: cores.verdeOk,
};

/** Cores por resultado de CMT. A sigla SEMPRE acompanha a cor. */
export const corCMT: Record<string, string> = {
  N: cores.verdeOkEscuro,
  T: cores.verdeOk,
  '1': cores.atencao,
  '2': cores.atencaoEscuro,
  '3': cores.alerta,
  PP: cores.cinza500,
};

export const siglaCMT: Record<string, string> = {
  N: 'N',
  T: 'T',
  '1': '+',
  '2': '++',
  '3': '+++',
  PP: 'PP',
};

/** Cor por rótulo de confiança do parecer. */
export function corDaConfianca(cf: number, tema: TemaCores): string {
  if (cf >= 0.85) return tema.alerta;
  if (cf >= 0.6) return tema.atencao;
  if (cf >= 0.35) return tema.destaque;
  return tema.textoSecundario;
}
