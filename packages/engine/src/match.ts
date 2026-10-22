/**
 * Casamento de condições com a memória de trabalho.
 * Referência: specsDrMoo.md §4.2 (operadores) e §4.5 (CF da premissa).
 */
import { conjuncao, disjuncao, limitar } from './cf';
import type {
  Condicao,
  CondicaoAlguma,
  CondicaoNao,
  CondicaoSimples,
  CondicaoTodas,
  MemoriaDeTrabalho,
  PremissaAvaliada,
  Valor,
} from './types';

export function ehCondicaoSimples(c: Condicao): c is CondicaoSimples {
  return typeof (c as CondicaoSimples).var === 'string';
}
export function ehTodas(c: Condicao): c is CondicaoTodas {
  return Array.isArray((c as CondicaoTodas).todas);
}
export function ehAlguma(c: Condicao): c is CondicaoAlguma {
  return Array.isArray((c as CondicaoAlguma).alguma);
}
export function ehNao(c: Condicao): c is CondicaoNao {
  return (c as CondicaoNao).nao !== undefined;
}

/** Todas as variáveis citadas numa condição (usado no encadeamento regressivo). */
export function variaveisDaCondicao(c: Condicao, acc: Set<string> = new Set()): Set<string> {
  if (ehCondicaoSimples(c)) acc.add(c.var);
  else if (ehTodas(c)) c.todas.forEach((sub) => variaveisDaCondicao(sub, acc));
  else if (ehAlguma(c)) c.alguma.forEach((sub) => variaveisDaCondicao(sub, acc));
  else if (ehNao(c)) variaveisDaCondicao(c.nao, acc);
  return acc;
}

/**
 * Quantas condições simples a regra realmente EXIGE — mede a especificidade (§4.7).
 *
 * Numa conjunção, todas as condições são exigidas, então somam. Numa disjunção,
 * basta um ramo: exigir "grumos OU cor OU consistência" é exigir um sinal, não
 * três. Contar os ramos de um `alguma` como se fossem exigências fazia uma regra
 * de triagem com seis alternativas parecer mais específica que um diagnóstico
 * encadeado de duas condições obrigatórias — e vencer a resolução de conflito
 * que deveria perder. O erro passava batido numa base de um só sistema, onde as
 * regras concorrentes tinham forma parecida; com muitos grupos, não passa mais.
 */
export function especificidade(c: Condicao): number {
  if (ehCondicaoSimples(c)) return 1;
  if (ehTodas(c)) return c.todas.reduce((n, sub) => n + especificidade(sub), 0);
  if (ehAlguma(c)) {
    // O ramo mais exigente define o piso do que a disjunção pede.
    return c.alguma.reduce((max, sub) => Math.max(max, especificidade(sub)), 0);
  }
  if (ehNao(c)) return especificidade(c.nao);
  return 0;
}

function comparavel(v: Valor | undefined): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function iguais(a: Valor, b: Valor): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }
  return a === b;
}

/**
 * Avalia uma condição simples.
 *
 * Retorna o CF da premissa. Quando a variável é desconhecida, devolve `null`:
 * desconhecido NÃO é falso (§4.5) — é ausência de informação, e é justamente o
 * que faz o motor decidir perguntar.
 */
function avaliarSimples(
  cond: CondicaoSimples,
  memoria: MemoriaDeTrabalho,
): { cf: number | null; valorObtido: Valor | null } {
  const fato = memoria.get(cond.var);

  if (cond.op === 'desconhecido') {
    return { cf: fato === undefined ? 1 : -1, valorObtido: fato?.valor ?? null };
  }
  if (fato === undefined) return { cf: null, valorObtido: null };

  const atual = fato.valor;
  const esperado = cond.val;
  let bate = false;

  switch (cond.op) {
    case '=':
      bate = esperado !== undefined && iguais(atual, esperado);
      break;
    case '!=':
      bate = esperado === undefined || !iguais(atual, esperado);
      break;
    case '>':
    case '>=':
    case '<':
    case '<=': {
      const a = comparavel(atual);
      const b = comparavel(esperado);
      if (a === null || b === null) return { cf: null, valorObtido: atual };
      bate =
        cond.op === '>' ? a > b : cond.op === '>=' ? a >= b : cond.op === '<' ? a < b : a <= b;
      break;
    }
    case 'entre': {
      const a = comparavel(atual);
      const faixa = Array.isArray(esperado) ? esperado : null;
      if (a === null || !faixa || faixa.length < 2) return { cf: null, valorObtido: atual };
      const min = Number(faixa[0]);
      const max = Number(faixa[1]);
      bate = a >= min && a <= max;
      break;
    }
    case 'em': {
      const lista = Array.isArray(esperado) ? esperado : [];
      bate = lista.some((v) => iguais(atual, v as Valor));
      break;
    }
    case 'contem': {
      if (Array.isArray(atual)) bate = atual.some((v) => iguais(v, esperado as Valor));
      else if (typeof atual === 'string' && typeof esperado === 'string')
        bate = atual.includes(esperado);
      break;
    }
  }

  // Um fato com CF negativo que "bate" na comparação é evidência CONTRA a premissa.
  return { cf: bate ? fato.cf : -fato.cf, valorObtido: atual };
}

export interface ResultadoAvaliacao {
  /** `null` ⇒ alguma variável necessária é desconhecida; a regra não pode ser julgada. */
  cf: number | null;
  premissas: PremissaAvaliada[];
  /** Variáveis desconhecidas que impedem a avaliação. */
  faltantes: string[];
}

export function avaliarCondicao(cond: Condicao, memoria: MemoriaDeTrabalho): ResultadoAvaliacao {
  const premissas: PremissaAvaliada[] = [];
  const faltantes: string[] = [];

  const visitar = (c: Condicao): number | null => {
    if (ehCondicaoSimples(c)) {
      const { cf, valorObtido } = avaliarSimples(c, memoria);
      if (cf === null) {
        faltantes.push(c.var);
        premissas.push({
          var: c.var,
          valorEsperado: c.val ?? null,
          valorObtido: null,
          cf: 0,
          satisfeita: false,
        });
        return null;
      }
      premissas.push({
        var: c.var,
        valorEsperado: c.val ?? null,
        valorObtido,
        cf: limitar(cf),
        satisfeita: cf > 0,
      });
      return limitar(cf);
    }

    if (ehTodas(c)) {
      const cfs: number[] = [];
      let indefinido = false;
      for (const sub of c.todas) {
        const r = visitar(sub);
        if (r === null) indefinido = true;
        else cfs.push(r);
      }
      // Numa conjunção, um ramo já falso derruba a premissa inteira mesmo que
      // haja outros ramos desconhecidos — não vale a pena perguntar o resto.
      const minConhecido = cfs.length > 0 ? conjuncao(cfs) : null;
      if (minConhecido !== null && minConhecido < 0) return minConhecido;
      if (indefinido) return null;
      return minConhecido;
    }

    if (ehAlguma(c)) {
      const cfs: number[] = [];
      let indefinido = false;
      for (const sub of c.alguma) {
        const r = visitar(sub);
        if (r === null) indefinido = true;
        else cfs.push(r);
      }
      // Numa disjunção, um ramo já verdadeiro basta.
      const maxConhecido = cfs.length > 0 ? disjuncao(cfs) : null;
      if (maxConhecido !== null && maxConhecido > 0) return maxConhecido;
      if (indefinido) return null;
      return maxConhecido;
    }

    if (ehNao(c)) {
      const r = visitar(c.nao);
      return r === null ? null : limitar(-r);
    }

    return null;
  };

  const cf = visitar(cond);
  return { cf, premissas, faltantes: [...new Set(faltantes)] };
}
