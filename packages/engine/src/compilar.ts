/**
 * Compilação da base de conhecimento.
 *
 * A memória de trabalho é indexada por nome de variável, mas a variável-objetivo
 * (`diagnostico`) assume vários valores simultaneamente — cada hipótese tem o seu
 * próprio fator de certeza. Para que isso caiba num `Map<string, Fato>`, as
 * referências à variável-objetivo são reescritas, uma única vez na carga, para
 * chaves do tipo `diagnostico=mastite_clinica_g2` com valor booleano.
 */
import type { BaseDeConhecimento, Condicao, HipoteseDef, Pergunta, Regra, Valor } from './types';
import { ehAlguma, ehCondicaoSimples, ehNao, ehTodas } from './match';

export const SEP_OBJETIVO = '=';

export function chaveObjetivo(variavelObjetivo: string, valor: Valor): string {
  return `${variavelObjetivo}${SEP_OBJETIVO}${String(valor)}`;
}

export function ehChaveObjetivo(chave: string, variavelObjetivo: string): boolean {
  return chave.startsWith(`${variavelObjetivo}${SEP_OBJETIVO}`);
}

function reescrever(cond: Condicao, objetivo: string): Condicao {
  if (ehCondicaoSimples(cond)) {
    if (cond.var === objetivo && cond.op === '=' && cond.val !== undefined) {
      return { var: chaveObjetivo(objetivo, cond.val), op: '=', val: true };
    }
    if (cond.var === objetivo && cond.op === '!=' && cond.val !== undefined) {
      return { nao: { var: chaveObjetivo(objetivo, cond.val), op: '=', val: true } } as Condicao;
    }
    return cond;
  }
  if (ehTodas(cond)) return { todas: cond.todas.map((c) => reescrever(c, objetivo)) };
  if (ehAlguma(cond)) return { alguma: cond.alguma.map((c) => reescrever(c, objetivo)) };
  if (ehNao(cond)) return { nao: reescrever(cond.nao, objetivo) };
  return cond;
}

export interface RegraCompilada extends Regra {
  /** Condição com as referências à variável-objetivo já reescritas. */
  seCompilada: Condicao;
  /** Chaves de memória produzidas por esta regra. */
  chavesConclusao: string[];
  /** Posição na declaração — último critério de desempate (§4.7). */
  ordemDeclaracao: number;
}

export interface BaseCompilada extends BaseDeConhecimento {
  regrasCompiladas: RegraCompilada[];
  /** Índice: chave de memória → regras que a produzem (encadeamento regressivo). */
  produzidaPor: Map<string, RegraCompilada[]>;
  perguntaPorVar: Map<string, Pergunta>;
  /**
   * Pré-requisito de cada pergunta, com as referências à variável-objetivo já
   * reescritas.
   *
   * Sem esta reescrita um pré-requisito não poderia falar de hipótese ("só
   * pergunte sobre o teto azulado se já houver mastite clínica"), porque
   * `diagnostico` nunca existe como chave de memória — quem existe é
   * `diagnostico=mastite_clinica_g1`. Com a base inteira num só sistema isso não
   * fazia falta; com quinze grupos, é o que mantém o questionário no assunto.
   */
  preRequisitoCompilado: Map<string, Condicao>;
  /** Posição da pergunta na declaração — desempate determinístico da escolha. */
  ordemPergunta: Map<string, number>;
  /** Índice: id da hipótese → definição (grupo, subsunção, bandeira vermelha). */
  hipotesePorId: Map<string, HipoteseDef>;
}

export function compilarBase(kb: BaseDeConhecimento): BaseCompilada {
  const objetivo = kb.variavelObjetivo;

  const regrasCompiladas: RegraCompilada[] = kb.regras.map((r, i) => ({
    ...r,
    seCompilada: reescrever(r.se, objetivo),
    chavesConclusao: r.entao.map((c) =>
      c.var === objetivo ? chaveObjetivo(objetivo, c.val) : c.var,
    ),
    ordemDeclaracao: i,
  }));

  const produzidaPor = new Map<string, RegraCompilada[]>();
  for (const r of regrasCompiladas) {
    for (const chave of r.chavesConclusao) {
      const lista = produzidaPor.get(chave) ?? [];
      lista.push(r);
      produzidaPor.set(chave, lista);
    }
  }

  const perguntaPorVar = new Map(kb.perguntas.map((p) => [p.var, p] as const));
  const ordemPergunta = new Map(kb.perguntas.map((p, i) => [p.var, i] as const));

  const preRequisitoCompilado = new Map<string, Condicao>();
  for (const p of kb.perguntas) {
    if (p.preRequisito) preRequisitoCompilado.set(p.var, reescrever(p.preRequisito, objetivo));
  }

  const hipotesePorId = new Map(kb.hipoteses.map((h) => [h.id, h] as const));

  return {
    ...kb,
    regrasCompiladas,
    produzidaPor,
    perguntaPorVar,
    preRequisitoCompilado,
    ordemPergunta,
    hipotesePorId,
  };
}
