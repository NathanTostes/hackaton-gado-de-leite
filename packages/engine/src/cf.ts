/**
 * Álgebra de fatores de certeza (modelo MYCIN).
 * Referência: specsDrMoo.md §4.5 e §4.6.
 */
import type { CF } from './types';

/** Abaixo deste módulo, a premissa não conta como evidência. */
export const LIMIAR_PREMISSA = 0.2;

export function limitar(cf: CF): CF {
  if (Number.isNaN(cf)) return 0;
  return Math.max(-1, Math.min(1, cf));
}

/**
 * Combina duas evidências que apontam para a MESMA conclusão.
 *
 *  - ambos positivos: c1 + c2·(1 − c1)
 *  - ambos negativos: c1 + c2·(1 + c1)
 *  - sinais opostos:  (c1 + c2) / (1 − min(|c1|, |c2|))
 */
export function combinar(c1: CF, c2: CF): CF {
  const a = limitar(c1);
  const b = limitar(c2);
  if (a >= 0 && b >= 0) return limitar(a + b * (1 - a));
  if (a <= 0 && b <= 0) return limitar(a + b * (1 + a));
  const denominador = 1 - Math.min(Math.abs(a), Math.abs(b));
  // Evidências exatamente contraditórias (+1 e −1) se anulam.
  if (denominador === 0) return 0;
  return limitar((a + b) / denominador);
}

/** CF resultante do disparo de uma regra: CF da regra × CF da premissa. */
export function propagar(cfRegra: CF, cfPremissa: CF): CF {
  return limitar(cfRegra * cfPremissa);
}

/** Conjunção: o elo mais fraco define a força da premissa. */
export function conjuncao(cfs: CF[]): CF {
  if (cfs.length === 0) return 0;
  return cfs.reduce((min, c) => (c < min ? c : min), 1);
}

/** Disjunção: a evidência mais forte define a força da premissa. */
export function disjuncao(cfs: CF[]): CF {
  if (cfs.length === 0) return 0;
  return cfs.reduce((max, c) => (c > max ? c : max), -1);
}

/** Uma premissa só é considerada satisfeita acima do limiar de corte. */
export function premissaSatisfeita(cf: CF): boolean {
  return cf >= LIMIAR_PREMISSA;
}

/**
 * Tradução de CF para linguagem do produtor (§4.6).
 * Nunca mostrar o número cru sozinho na interface.
 */
export function rotuloDeConfianca(cf: CF): string {
  if (cf >= 0.85) return 'Muito provável';
  if (cf >= 0.6) return 'Provável';
  if (cf >= 0.35) return 'Possível';
  if (cf >= 0.2) return 'Pouco provável';
  return 'Descartado';
}

/** CF atribuído à resposta do usuário (§4.5). */
export const CF_RESPOSTA = {
  sim: 1.0,
  nao: -1.0,
  achoQueSim: 0.6,
  achoQueNao: -0.6,
} as const;
