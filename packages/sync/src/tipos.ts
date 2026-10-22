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

/**
 * Chave natural das tabelas que o app trata como "uma linha por chave".
 *
 * O `id` é sorteado em cada aparelho, então o mesmo lançamento feito offline nos
 * dois celulares (a ordenha do dia 20 da Mimosa, a produção do dia 20 da
 * propriedade) nasce com dois ids diferentes. Mesclar só por `id` guardaria as
 * duas linhas: a produção do animal apareceria somada em dobro, e onde o banco
 * tem UNIQUE (`producao_propriedade.data`) a gravação seria recusada em toda
 * sincronização, para sempre — os aparelhos nunca convergiriam.
 *
 * Por isso a mesclagem também colapsa por chave natural, com a mesma regra de
 * linha (vence o `updated_at` mais novo) — equivalente ao que o próprio app faz
 * ao relançar a ordenha do dia por cima da anterior.
 *
 * Só entram aqui tabelas-folha, que ninguém referencia: a linha perdedora é
 * apagada do aparelho e isso não pode deixar filho órfão. `animal` fica de fora
 * de propósito — brinco repetido tem dono, histórico e filiação, e continua
 * sendo conflito para decisão humana.
 */
export const CHAVES_NATURAIS: Record<string, readonly string[]> = {
  producao_propriedade: ['data'],
  controle_leiteiro: ['animal_id', 'data'],
  exame_cmt: ['animal_id', 'data'],
};

export interface ResultadoSincronizacao {
  /** Linhas gravadas localmente, por tabela. */
  aplicadas: Record<string, number>;
  /** Linhas apagadas localmente por terem perdido a chave natural, por tabela. */
  removidas: Record<string, number>;
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
