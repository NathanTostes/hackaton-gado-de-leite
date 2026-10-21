/** Datas em formato ISO `YYYY-MM-DD`, sem fuso — datas de calendário, não instantes. */
export type DataISO = string;

/** Período de gestação bovina adotado por padrão (configurável nas Configurações). */
export const GESTACAO_DIAS = 283;
/** Secagem sugerida: 60 dias antes do parto previsto. */
export const PERIODO_SECO_DIAS = 60;
/** Período voluntário de espera antes de recobrir a vaca. */
export const ESPERA_VOLUNTARIA_DIAS = 45;

const MS_DIA = 86_400_000;

export function hoje(agora: Date = new Date()): DataISO {
  return paraISO(agora);
}

export function paraISO(d: Date): DataISO {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function deISO(s: DataISO): Date {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function somarDias(s: DataISO, dias: number): DataISO {
  const d = deISO(s);
  d.setDate(d.getDate() + dias);
  return paraISO(d);
}

export function diferencaEmDias(de: DataISO, ate: DataISO): number {
  return Math.round((deISO(ate).getTime() - deISO(de).getTime()) / MS_DIA);
}

export function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

export function formatarBR(s: DataISO | null | undefined): string {
  if (!s) return '—';
  const [a, m, d] = s.split('-');
  return `${d}/${m}/${a}`;
}

/** Dias em lactação. */
export function del(dataParto: DataISO, referencia: DataISO = hoje()): number {
  return Math.max(0, diferencaEmDias(dataParto, referencia));
}

export function dataProvavelParto(
  dataCobertura: DataISO,
  gestacaoDias: number = GESTACAO_DIAS,
): DataISO {
  return somarDias(dataCobertura, gestacaoDias);
}

export function dataSecagemSugerida(
  dataProvavelDoParto: DataISO,
  periodoSeco: number = PERIODO_SECO_DIAS,
): DataISO {
  return somarDias(dataProvavelDoParto, -periodoSeco);
}

/** Dias que ainda faltam para o fim da carência. Zero ou negativo = liberado. */
export function diasDeCarenciaRestantes(carenciaAte: DataISO, referencia: DataISO = hoje()): number {
  return diferencaEmDias(referencia, carenciaAte);
}

export function emCarencia(carenciaAte: DataISO | null, referencia: DataISO = hoje()): boolean {
  if (!carenciaAte) return false;
  return diasDeCarenciaRestantes(carenciaAte, referencia) > 0;
}
