/**
 * Dr. Moo — Tipos fundamentais do motor de inferência.
 *
 * Referência: specsDrMoo.md §4.1 e §4.2.
 * Este pacote é TypeScript puro: não importa React, SQLite nem nada de I/O.
 */

/** Fator de certeza, no intervalo [-1, +1] (modelo MYCIN). */
export type CF = number;

/** Valor que uma variável pode assumir na memória de trabalho. */
// A base usa listas de número em `entre` (ex.: DEL `[7, 60]`) e listas de texto
// em `em` (ex.: CMT `["1","2","3"]`). O tipo precisa admitir as duas, senão o
// JSON válido da base não casa com o tipo que o motor declara.
export type Valor = boolean | number | string | string[] | number[];

/** De onde veio um fato — usado no traço e para não reperguntar o que já se sabe. */
export type OrigemFato = 'pergunta' | 'banco' | 'regra' | 'calculado';

export interface Fato {
  variavel: string;
  valor: Valor;
  cf: CF;
  origem: OrigemFato;
  /** Preenchido quando `origem === 'regra'`. */
  regraId?: string;
  /** Variáveis que sustentaram a conclusão (para o encadeamento da explicação). */
  derivadoDe?: string[];
  timestamp: string;
}

/** Fatos da sessão atual, indexados por `variavel`. */
export type MemoriaDeTrabalho = Map<string, Fato>;

// ---------------------------------------------------------------------------
// Gramática das regras de produção (specsDrMoo.md §4.2)
// ---------------------------------------------------------------------------

export type Operador =
  | '='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'entre'
  | 'em'
  | 'contem'
  | 'desconhecido';

export interface CondicaoSimples {
  var: string;
  op: Operador;
  /** Para `entre`, usar `[min, max]`; para `em`, uma lista de valores aceitos. */
  val?: Valor;
}

export interface CondicaoTodas {
  todas: Condicao[];
}
export interface CondicaoAlguma {
  alguma: Condicao[];
}
export interface CondicaoNao {
  nao: Condicao;
}

export type Condicao = CondicaoSimples | CondicaoTodas | CondicaoAlguma | CondicaoNao;

export interface Conclusao {
  var: string;
  val: Valor;
  cf: CF;
}

export type StatusRegra = 'validada' | 'revisar';

export type GrupoRegra =
  | 'triagem'
  | 'mastite'
  | 'metabolicas'
  | 'pos_parto'
  | 'digestivas'
  | 'locomotor'
  | 'parasitarias'
  | 'notificacao_obrigatoria'
  | 'emergencia'
  | 'bezerras'
  | 'rebanho';

export interface Regra {
  id: string;
  versao: string;
  grupo: GrupoRegra;
  titulo: string;
  /** 0–100. Usado na resolução de conflito (§4.7). */
  prioridade: number;
  se: Condicao;
  entao: Conclusao[];
  /** Texto exibido em "por que essa pergunta?" e no traço. */
  porque: string;
  conduta?: string[];
  fonte: string;
  status: StatusRegra;
}

// ---------------------------------------------------------------------------
// Perguntas (specsDrMoo.md §4.3)
// ---------------------------------------------------------------------------

export type TipoPergunta = 'boolean' | 'enum' | 'numero' | 'multipla' | 'por_quarto';

export interface OpcaoPergunta {
  valor: string;
  rotulo: string;
  /** Cor semântica opcional para a UI (ex.: escala de CMT). */
  cor?: string;
}

export interface Pergunta {
  var: string;
  pergunta: string;
  tipo: TipoPergunta;
  ajuda?: string;
  ilustracao?: string;
  /** 1 = observação direta · 3 = exige manejo/contenção · 5 = exame laboratorial. */
  custo: number;
  opcoes?: OpcaoPergunta[];
  unidade?: string;
  min?: number;
  max?: number;
  /** Só é perguntada se esta condição for verdadeira na memória de trabalho. */
  preRequisito?: Condicao | null;
  fonte?: string;
}

// ---------------------------------------------------------------------------
// Variáveis e hipóteses
// ---------------------------------------------------------------------------

export interface VariavelDef {
  nome: string;
  rotulo: string;
  tipo: TipoPergunta;
  opcoes?: string[];
}

export interface HipoteseDef {
  /** Valor assumido pela variável-objetivo (por padrão `diagnostico`). */
  id: string;
  rotulo: string;
  grupo: GrupoRegra;
  /** Resumo em linguagem do produtor. */
  descricao: string;
  /** Se verdadeiro, interrompe o questionário ao ser concluída (§4.4 passo 3). */
  bandeiraVermelha?: boolean;
  /**
   * Subsunção: hipóteses que esta torna redundante quando confirmada.
   * Ex.: mastite clínica grau 2 substitui o grau 1 — o grau 1 continua no traço
   * (foi o degrau que levou até aqui), mas some do ranking do parecer.
   */
  substitui?: string[];
}

export interface BaseDeConhecimento {
  versao: string;
  changelog: { versao: string; data: string; notas: string }[];
  /** Variável-objetivo do encadeamento regressivo. Padrão: `diagnostico`. */
  variavelObjetivo: string;
  variaveis: VariavelDef[];
  hipoteses: HipoteseDef[];
  perguntas: Pergunta[];
  regras: Regra[];
}

// ---------------------------------------------------------------------------
// Traço e explicação (specsDrMoo.md §4.8)
// ---------------------------------------------------------------------------

export interface PremissaAvaliada {
  var: string;
  valorEsperado: Valor | null;
  valorObtido: Valor | null;
  cf: CF;
  satisfeita: boolean;
}

export interface PassoDoTraco {
  ordem: number;
  regraId: string;
  regraTitulo: string;
  premissasAvaliadas: PremissaAvaliada[];
  cfPremissa: CF;
  conclusoes: { var: string; val: Valor; cfAntes: CF | null; cfDepois: CF }[];
  fonte: string;
  explicacao: string;
  status: StatusRegra;
}

// ---------------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------------

export interface Hipotese {
  id: string;
  rotulo: string;
  descricao: string;
  grupo: GrupoRegra;
  cf: CF;
  /** Rótulo verbal conforme §4.6 ("Muito provável", "Provável", …). */
  confianca: string;
  bandeiraVermelha: boolean;
  conduta: string[];
  fontes: string[];
  status: StatusRegra;
  regrasQueSustentam: string[];
  /** Hipótese confirmada que tornou esta redundante (subsunção). */
  substituidaPor?: string;
}

export type MotivoParada =
  | 'confianca_suficiente'
  | 'sem_perguntas_uteis'
  | 'bandeira_vermelha'
  | 'limite_de_perguntas'
  | 'encerrado_pelo_usuario';

export interface ProximoPasso {
  tipo: 'pergunta' | 'parecer';
  pergunta?: Pergunta;
  /** Motivo pelo qual esta pergunta foi escolhida — alimenta "por que essa pergunta?". */
  justificativa?: JustificativaPergunta;
  parecer?: Parecer;
  /** Hipóteses vivas no momento (sempre presente, para a barra de progresso). */
  hipoteses: Hipotese[];
  perguntasFeitas: number;
}

export interface JustificativaPergunta {
  var: string;
  texto: string;
  regrasPendentes: { id: string; titulo: string; porque: string; hipoteses: string[] }[];
}

export interface Parecer {
  motivoParada: MotivoParada;
  hipoteses: Hipotese[];
  bandeiraVermelha: Hipotese | null;
  traco: PassoDoTraco[];
  fatos: Fato[];
  kbVersao: string;
  engineVersao: string;
  geradoEm: string;
}

export interface OpcoesSessao {
  /** Teto de perguntas antes de encerrar com parecer parcial. Padrão 20. */
  maxPerguntas?: number;
  /** CF mínimo da hipótese líder para encerrar. Padrão 0.85. */
  limiarConclusao?: number;
  /** Distância mínima para a segunda hipótese. Padrão 0.25. */
  distanciaMinima?: number;
  /** Relógio injetável — torna o motor determinístico nos testes. */
  agora?: () => string;
}

export interface RespostaUsuario {
  variavel: string;
  valor: Valor;
  /** +1 sim · -1 não · ±0.6 "acho que" · ver §4.5. */
  cf: CF;
}
