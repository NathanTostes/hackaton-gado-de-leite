/**
 * Módulo de explicação — responde "como você chegou nisso?" (specsDrMoo.md §4.8).
 *
 * Reconstrói, de trás para frente, a cadeia de regras e fatos que sustentam uma
 * conclusão, para renderização na UI e exportação no prontuário.
 */
import { rotuloDeConfianca } from './cf';
import type { Condicao, Fato, Parecer, PassoDoTraco, Valor } from './types';
import { ehAlguma, ehCondicaoSimples, ehNao, ehTodas } from './match';

export interface NoExplicacao {
  tipo: 'regra' | 'fato';
  titulo: string;
  detalhe: string;
  fonte?: string;
  status?: 'validada' | 'revisar';
  cf?: number;
  filhos: NoExplicacao[];
}

function descreverValor(v: Valor | null): string {
  if (v === null) return 'não informado';
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

/**
 * Monta a árvore de explicação de uma conclusão.
 * `chave` é a chave de memória (ex.: `diagnostico=mastite_clinica_g2`).
 */
export function explicarConclusao(
  parecer: Parecer,
  chave: string,
  visitadas: Set<string> = new Set(),
): NoExplicacao[] {
  if (visitadas.has(chave)) return [];
  visitadas.add(chave);

  const passos = parecer.traco.filter((p) => p.conclusoes.some((c) => c.var === chave));

  return passos.map((passo) => {
    const filhos: NoExplicacao[] = passo.premissasAvaliadas.map((pr) => {
      const derivados = explicarConclusao(parecer, pr.var, visitadas);
      const fato = parecer.fatos.find((f) => f.variavel === pr.var);
      return {
        tipo: 'fato' as const,
        titulo: pr.var,
        detalhe: `${descreverValor(pr.valorObtido)}${
          fato ? ` (${traduzirOrigem(fato)})` : ''
        }`,
        cf: pr.cf,
        filhos: derivados,
      };
    });

    const conclusao = passo.conclusoes.find((c) => c.var === chave)!;
    return {
      tipo: 'regra' as const,
      titulo: `${passo.regraId} — ${passo.regraTitulo}`,
      detalhe: passo.explicacao,
      fonte: passo.fonte,
      status: passo.status,
      cf: conclusao.cfDepois,
      filhos,
    };
  });
}

function traduzirOrigem(f: Fato): string {
  switch (f.origem) {
    case 'pergunta':
      return 'respondido por você';
    case 'banco':
      return 'do cadastro do animal';
    case 'regra':
      return `deduzido pela regra ${f.regraId ?? ''}`.trim();
    case 'calculado':
      return 'calculado';
  }
}

/** Renderização da regra em linguagem natural: `SE … ENTÃO … (CF 0,90)`. */
export function regraEmLinguagemNatural(
  se: Condicao,
  entao: { var: string; val: Valor; cf: number }[],
  rotulos: Map<string, string> = new Map(),
): string {
  const rotulo = (v: string) => rotulos.get(v) ?? v;

  const descrever = (c: Condicao, nivel = 0): string => {
    if (ehCondicaoSimples(c)) {
      const op =
        c.op === '='
          ? 'é'
          : c.op === '!='
            ? 'não é'
            : c.op === 'entre'
              ? 'está entre'
              : c.op === 'em'
                ? 'é um de'
                : c.op === 'contem'
                  ? 'contém'
                  : c.op === 'desconhecido'
                    ? 'é desconhecido'
                    : c.op;
      if (c.op === 'desconhecido') return `${rotulo(c.var)} ${op}`;
      if (typeof c.val === 'boolean' && c.op === '=') {
        return c.val ? rotulo(c.var) : `NÃO ${rotulo(c.var)}`;
      }
      return `${rotulo(c.var)} ${op} ${descreverValor(c.val ?? null)}`;
    }
    if (ehTodas(c)) {
      const partes = c.todas.map((s) => descrever(s, nivel + 1));
      return nivel === 0 ? partes.join(' E ') : `(${partes.join(' E ')})`;
    }
    if (ehAlguma(c)) {
      const partes = c.alguma.map((s) => descrever(s, nivel + 1));
      return `(${partes.join(' OU ')})`;
    }
    if (ehNao(c)) return `NÃO ${descrever(c.nao, nivel + 1)}`;
    return '';
  };

  const conclusoes = entao
    .map(
      (c) =>
        `${rotulo(c.var)} = ${descreverValor(c.val)} (CF ${c.cf.toFixed(2).replace('.', ',')} — ${rotuloDeConfianca(Math.abs(c.cf))})`,
    )
    .join(' e ');

  return `SE ${descrever(se)}\nENTÃO ${conclusoes}`;
}

/** Texto corrido do traço, para exportação em PDF/HTML do prontuário. */
export function tracoEmTexto(traco: readonly PassoDoTraco[]): string {
  return traco
    .map((p) => {
      const premissas = p.premissasAvaliadas
        .map((pr) => `  · ${pr.var} = ${descreverValor(pr.valorObtido)} (CF ${pr.cf.toFixed(2)})`)
        .join('\n');
      const conclusoes = p.conclusoes
        .map(
          (c) =>
            `  → ${c.var}: ${c.cfAntes === null ? '' : `${c.cfAntes.toFixed(2)} ⇒ `}${c.cfDepois.toFixed(2)}`,
        )
        .join('\n');
      return [
        `${p.ordem}. [${p.regraId}] ${p.regraTitulo}`,
        premissas,
        conclusoes,
        `  Por quê: ${p.explicacao}`,
        `  Fonte: ${p.fonte}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}
