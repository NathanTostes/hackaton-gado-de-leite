/**
 * A lógica da busca do rebanho, separada da tela.
 *
 * Aqui mora o que decide **o que é pedido ao banco**: como o estado dos chips e
 * dos campos vira `FiltrosRebanho`, quantos filtros estão ativos e como a idade
 * é escrita. Separado da renderização porque é isto que precisa de teste — a
 * tela só desenha o resultado.
 */
import type { FiltrosRebanho, StatusAnimal } from '@drmoo/db';
import type { CategoriaAnimal } from '@drmoo/domain';

export interface EstadoFiltros {
  categorias: CategoriaAnimal[];
  status: StatusAnimal[];
  loteId: string | null;
  semLote: boolean;
  sexo: 'M' | 'F' | null;
  delMin: string;
  delMax: string;
  idadeMin: string;
  idadeMax: string;
  producaoMin: string;
  producaoMax: string;
  cmtMinimo: '1' | '2' | '3' | null;
  peitoPerdido: boolean;
  emCarencia: boolean;
  prenhe: boolean;
  partoEm60: boolean;
}

export const FILTROS_VAZIOS: EstadoFiltros = {
  categorias: [],
  status: [],
  loteId: null,
  semLote: false,
  sexo: null,
  delMin: '',
  delMax: '',
  idadeMin: '',
  idadeMax: '',
  producaoMin: '',
  producaoMax: '',
  cmtMinimo: null,
  peitoPerdido: false,
  emCarencia: false,
  prenhe: false,
  partoEm60: false,
};

/** Dias à frente considerados em "parto em breve". */
export const DIAS_PARTO_PROXIMO = 60;

/** Campo numérico digitado: aceita vírgula, e vazio significa "sem limite". */
export function paraNumero(v: string): number | undefined {
  const n = Number(v.replace(',', '.'));
  return v.trim() && Number.isFinite(n) ? n : undefined;
}

/** Quantos filtros o usuário ligou — vira o contador no chip "Filtros". */
export function contarAtivos(f: EstadoFiltros): number {
  return (
    f.categorias.length +
    f.status.length +
    (f.loteId ? 1 : 0) +
    (f.semLote ? 1 : 0) +
    (f.sexo ? 1 : 0) +
    [f.delMin, f.delMax, f.idadeMin, f.idadeMax, f.producaoMin, f.producaoMax].filter((v) => v.trim()).length +
    (f.cmtMinimo ? 1 : 0) +
    [f.peitoPerdido, f.emCarencia, f.prenhe, f.partoEm60].filter(Boolean).length
  );
}

/** Liga ou desliga um item de uma seleção múltipla. */
export function alternarNaLista<T>(lista: T[], item: T): T[] {
  return lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item];
}

/**
 * Converte o estado da tela no filtro do repositório.
 *
 * Lista vazia e campo em branco viram `undefined` — e não um filtro que não
 * filtra nada: é `undefined` que faz a consulta omitir a cláusula.
 */
export function montarFiltros(
  f: EstadoFiltros,
  busca: string,
  ordenarPor: NonNullable<FiltrosRebanho['ordenarPor']>,
  decrescente: boolean,
): FiltrosRebanho {
  return {
    busca,
    categorias: f.categorias.length ? f.categorias : undefined,
    status: f.status.length ? f.status : undefined,
    loteId: f.loteId ?? undefined,
    semLote: f.semLote || undefined,
    sexo: f.sexo ?? undefined,
    delMin: paraNumero(f.delMin),
    delMax: paraNumero(f.delMax),
    idadeMinMeses: paraNumero(f.idadeMin),
    idadeMaxMeses: paraNumero(f.idadeMax),
    producaoMin: paraNumero(f.producaoMin),
    producaoMax: paraNumero(f.producaoMax),
    cmtMinimo: f.cmtMinimo ?? undefined,
    peitoPerdido: f.peitoPerdido || undefined,
    emCarencia: f.emCarencia || undefined,
    prenhe: f.prenhe || undefined,
    partoEmDias: f.partoEm60 ? DIAS_PARTO_PROXIMO : undefined,
    ordenarPor,
    decrescente,
  };
}

/** Idade em meses escrita como o produtor fala: "8 m", "2 a", "5 a 2 m". */
export function idadeLegivel(meses: number | null): string | null {
  if (meses === null || meses < 0) return null;
  if (meses < 24) return `${meses} m`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  return resto ? `${anos} a ${resto} m` : `${anos} a`;
}

/** Linha de resumo da lista: quantos litros e quantos animais com alerta. */
export function resumirLista(
  animais: { producao_media_dia?: number | null; status?: string }[],
): { litros: number; comAlerta: number } | null {
  if (!animais.length) return null;
  return {
    litros: animais.reduce((t, a) => t + (a.producao_media_dia ?? 0), 0),
    comAlerta: animais.filter((a) => a.status && a.status !== 'saudavel').length,
  };
}
