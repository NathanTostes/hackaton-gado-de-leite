import type { Parecer } from '@drmoo/engine';
import type { TipoEvento } from '@drmoo/db';
import { hoje } from '@drmoo/domain';

export interface CompromissoConsulta { titulo: string; tipo: TipoEvento; data: string }
export interface AjusteCompromisso { data?: string; tipo?: TipoEvento; agendar?: boolean; extra?: boolean }
export type AjustesAgenda = Record<string, AjusteCompromisso>;

/** Só classifica o texto já existente; não prescreve nem calcula intervalos clínicos. */
export function tipoDaAcao(texto: string): TipoEvento {
  if (/vacin/i.test(texto)) return 'vacinacao';
  if (/\bCMT\b/i.test(texto)) return 'exame_cmt';
  if (/\bCCS\b/i.test(texto)) return 'exame_ccs';
  if (/medica|rem[eé]dio|tratamento/i.test(texto)) return 'medicacao';
  if (/reavali/i.test(texto)) return 'reavaliacao';
  if (/veterin/i.test(texto)) return 'consulta';
  return 'manejo';
}

export function itensDaAgenda(parecer: Parecer, feitas: readonly string[], ajustes: AjustesAgenda) {
  const titulos = [...new Set([
    ...parecer.hipoteses.flatMap((h) => h.conduta),
    ...(parecer.bandeiraVermelha?.conduta ?? []),
    ...Object.keys(ajustes).filter((titulo) => ajustes[titulo]?.extra),
  ])].filter((titulo) => !feitas.includes(titulo));
  return titulos.map((titulo) => ({ titulo, tipo: ajustes[titulo]?.tipo ?? tipoDaAcao(titulo),
    data: ajustes[titulo]?.data ?? hoje(), agendar: ajustes[titulo]?.agendar ?? true }));
}

export function compromissosDaAgenda(parecer: Parecer, feitas: readonly string[], ajustes: AjustesAgenda): CompromissoConsulta[] {
  return itensDaAgenda(parecer, feitas, ajustes).filter((item) => item.agendar)
    .map(({ titulo, tipo, data }) => ({ titulo, tipo, data }));
}
