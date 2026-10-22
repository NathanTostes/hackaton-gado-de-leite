/**
 * Formato de troca entre aparelhos.
 *
 * O instantâneo é o conteúdo das tabelas sincronizadas em JSON. A base de uma
 * propriedade é pequena (milhares de linhas), então trocar o conjunto inteiro a
 * cada sincronização é mais simples e mais seguro do que manter um log de
 * alterações — e o custo, numa rede Wi-Fi local, é irrelevante.
 */

export type Valor = string | number | null;
export type Linha = Record<string, Valor>;

export const VERSAO_PROTOCOLO = 1;

export interface Instantaneo {
  versao: number;
  /** Nome legível do aparelho que gerou o instantâneo. */
  dispositivo: string;
  geradoEm: string;
  tabelas: Record<string, Linha[]>;
}

/**
 * Tabelas trocadas entre aparelhos, na ordem em que podem ser inseridas sem
 * violar chave estrangeira (pai antes de filho).
 *
 * `meta_app` fica de fora de propósito: guarda configuração do próprio aparelho
 * (versão do esquema, endereço do servidor, código de pareamento).
 */
export const TABELAS_SINCRONIZADAS = [
  'propriedade',
  'lote',
  'animal',
  'lactacao',
  'medicamento',
  'vacina',
  'atendimento',
  'fato_registrado',
  'controle_leiteiro',
  'producao_propriedade',
  'cobertura',
  'morte',
  'exame_cmt',
  'exame_ccs',
  'caso_mastite',
  'tratamento',
  'vacinacao',
  'evento_calendario',
  'despesa',
  'receita',
] as const;

export type TabelaSincronizada = (typeof TABELAS_SINCRONIZADAS)[number];

/**
 * Tabelas sem `updated_at`. São registros imutáveis (os fatos coletados numa
 * anamnese): quem já tem a linha fica com ela, quem não tem recebe.
 */
export const TABELAS_IMUTAVEIS = new Set<string>(['fato_registrado']);

export interface ResultadoSincronizacao {
  /** Linhas gravadas localmente, por tabela. */
  aplicadas: Record<string, number>;
  /** Linhas recusadas pelo banco local (ex.: brinco repetido criado nos dois aparelhos). */
  conflitos: { tabela: string; id: string; motivo: string }[];
  /** Total de linhas enviadas ao servidor. */
  enviadas: number;
  dispositivos: DispositivoConhecido[];
  servidor: string;
  em: string;
}

export interface DispositivoConhecido {
  nome: string;
  visto: string;
  linhas: number;
}
