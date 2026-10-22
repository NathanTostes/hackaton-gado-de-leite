/**
 * Carga e validação da base de conhecimento do Dr. Moo.
 *
 * A base vive em JSON (`kb/`) justamente para ser DADO, não código: pode ser lida,
 * revisada e versionada por quem entende do domínio — sem recompilar o app.
 * Este módulo apenas monta, valida e congela a estrutura.
 */
import {
  compilarBase,
  type BaseCompilada,
  type BaseDeConhecimento,
  type HipoteseDef,
  type Pergunta,
  type Regra,
  type VariavelDef,
} from '@drmoo/engine';

import meta from '../kb/meta.json';
import variaveisJson from '../kb/variaveis.json';
import hipotesesJson from '../kb/hipoteses.json';
import perguntasJson from '../kb/perguntas.json';

import g01 from '../kb/grupos/01-triagem-geral.json';
import g02 from '../kb/grupos/02-mastite.json';
import g03 from '../kb/grupos/03-metabolicas.json';
import g04 from '../kb/grupos/04-pos-parto.json';
import g05 from '../kb/grupos/05-digestivas.json';
import g06 from '../kb/grupos/06-locomotor.json';
import g07 from '../kb/grupos/07-parasitarias.json';
import g08 from '../kb/grupos/08-notificacao-obrigatoria.json';
import g09 from '../kb/grupos/09-bezerras.json';
import g10 from '../kb/grupos/10-rebanho.json';

export { default as metaKb } from '../kb/meta.json';

const GRUPOS: { arquivo: string; regras: unknown[] }[] = [
  { arquivo: '01-triagem-geral', regras: g01 },
  { arquivo: '02-mastite', regras: g02 },
  { arquivo: '03-metabolicas', regras: g03 },
  { arquivo: '04-pos-parto', regras: g04 },
  { arquivo: '05-digestivas', regras: g05 },
  { arquivo: '06-locomotor', regras: g06 },
  { arquivo: '07-parasitarias', regras: g07 },
  { arquivo: '08-notificacao-obrigatoria', regras: g08 },
  { arquivo: '09-bezerras', regras: g09 },
  { arquivo: '10-rebanho', regras: g10 },
];

export class ErroDeBase extends Error {}

/** Validações estruturais que nenhum tipo de TypeScript pega sozinho. */
function validar(kb: BaseDeConhecimento): void {
  const problemas: string[] = [];

  const idsRegra = new Set<string>();
  for (const r of kb.regras) {
    if (idsRegra.has(r.id)) problemas.push(`Regra duplicada: ${r.id}`);
    idsRegra.add(r.id);
    if (!r.fonte?.trim()) problemas.push(`Regra ${r.id} sem fonte citada.`);
    if (!r.porque?.trim()) problemas.push(`Regra ${r.id} sem explicação ("porque").`);
    for (const c of r.entao) {
      if (Math.abs(c.cf) > 1) problemas.push(`Regra ${r.id}: CF fora de [-1, 1].`);
    }
  }

  const idsHipotese = new Set(kb.hipoteses.map((h) => h.id));
  for (const r of kb.regras) {
    for (const c of r.entao) {
      if (c.var === kb.variavelObjetivo && !idsHipotese.has(String(c.val))) {
        problemas.push(`Regra ${r.id} conclui hipótese inexistente: ${String(c.val)}`);
      }
    }
  }

  const nomesVariavel = new Set(kb.variaveis.map((v) => v.nome));
  for (const p of kb.perguntas) {
    if (!nomesVariavel.has(p.var)) {
      problemas.push(`Pergunta sobre variável não declarada em variaveis.json: ${p.var}`);
    }
  }

  const varsPergunta = new Set(kb.perguntas.map((p) => p.var));
  for (const h of kb.hipoteses) {
    for (const sub of h.substitui ?? []) {
      if (!idsHipotese.has(sub)) {
        problemas.push(`Hipótese ${h.id} substitui hipótese inexistente: ${sub}`);
      }
    }
  }
  // Sanidade: variável citada em alguma premissa, sem pergunta e sem regra que a
  // produza, nunca poderá ser conhecida — a regra seria letra morta.
  const produzidas = new Set(
    kb.regras.flatMap((r) =>
      r.entao.map((c) => (c.var === kb.variavelObjetivo ? `${c.var}=${String(c.val)}` : c.var)),
    ),
  );
  const contexto = new Set([
    'del',
    'numero_lactacao',
    'producao_media_dia',
    'idade_dias',
    'cmt_positivo_meses',
    'perc_mastite_clinica_mes',
    'perc_mastite_subclinica',
    'perc_vacas_lactacao',
    'dias_desde_ultimo_cmt',
  ]);
  for (const v of nomesVariavel) {
    if (!varsPergunta.has(v) && !produzidas.has(v) && !contexto.has(v)) {
      problemas.push(
        `Variável "${v}" não tem pergunta, não é produzida por regra e não é fato de contexto — inalcançável.`,
      );
    }
  }

  if (problemas.length > 0) {
    throw new ErroDeBase(
      `Base de conhecimento inválida (${problemas.length} problema(s)):\n- ${problemas.join('\n- ')}`,
    );
  }
}

function montar(): BaseDeConhecimento {
  const regras = GRUPOS.flatMap((g) => g.regras) as Regra[];
  const kb: BaseDeConhecimento = {
    versao: meta.versao,
    changelog: meta.changelog,
    variavelObjetivo: meta.variavelObjetivo,
    variaveis: variaveisJson as VariavelDef[],
    hipoteses: hipotesesJson as HipoteseDef[],
    perguntas: perguntasJson as Pergunta[],
    regras,
  };
  validar(kb);
  return kb;
}

export const baseDeConhecimento: BaseDeConhecimento = montar();

/** Base já compilada — use esta nas sessões para não recompilar a cada atendimento. */
export const baseCompilada: BaseCompilada = compilarBase(baseDeConhecimento);

/** Rótulos legíveis de variáveis e hipóteses, para a UI e para a explicação. */
export const rotulos: Map<string, string> = new Map([
  [baseDeConhecimento.variavelObjetivo, 'diagnóstico'] as const,
  ...baseDeConhecimento.variaveis.map((v) => [v.nome, v.rotulo] as const),
  ...baseDeConhecimento.hipoteses.map(
    (h) => [`${baseDeConhecimento.variavelObjetivo}=${h.id}`, h.rotulo] as const,
  ),
]);

/**
 * Nome legível de cada grupo de doenças da base.
 *
 * Mora aqui, junto da base, porque a lista de grupos é dela: a tela de saúde, a
 * base de conhecimento na interface e o gerador de documentação precisam dizer
 * o mesmo nome para o mesmo grupo.
 */
export const ROTULO_GRUPO: Record<string, string> = {
  triagem: 'Triagem geral',
  mastite: 'Mastite',
  metabolicas: 'Metabólicas',
  pos_parto: 'Pós-parto / reprodutivas',
  digestivas: 'Digestivas',
  locomotor: 'Locomotor',
  parasitarias: 'Parasitárias e infecciosas',
  notificacao_obrigatoria: 'Notificação obrigatória',
  emergencia: 'Emergências',
  bezerras: 'Bezerras',
  rebanho: 'Indicadores de rebanho',
};

/** Hipóteses da base agrupadas por grupo de doença — o que o sistema sabe diagnosticar. */
export const hipotesesPorGrupo = (): Map<string, HipoteseDef[]> => {
  const mapa = new Map<string, HipoteseDef[]>();
  for (const h of baseDeConhecimento.hipoteses) {
    if (h.id === 'sem_alteracao') continue;
    const lista = mapa.get(h.grupo) ?? [];
    lista.push(h);
    mapa.set(h.grupo, lista);
  }
  return mapa;
};

export const regrasPorGrupo = (): Map<string, Regra[]> => {
  const mapa = new Map<string, Regra[]>();
  for (const r of baseDeConhecimento.regras) {
    const lista = mapa.get(r.grupo) ?? [];
    lista.push(r);
    mapa.set(r.grupo, lista);
  }
  return mapa;
};

export {
  casos,
  executarCaso,
  executarCasos,
  type CasoDeTeste,
  type ResultadoCaso,
} from './casos';
