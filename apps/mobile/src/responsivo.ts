import { useWindowDimensions } from 'react-native';

/**
 * Pontos de quebra do Dr. Moo.
 *
 * O app é mobile-first: o layout compacto é o padrão e é o que roda no curral.
 * Os tamanhos maiores só acrescentam — barra lateral, conteúdo centralizado e
 * colunas extras — sem mudar nenhum fluxo.
 */
export const QUEBRAS = {
  /** A partir daqui cabem duas colunas de conteúdo. */
  medio: 760,
  /** A partir daqui vale a pena trocar as abas inferiores por barra lateral. */
  amplo: 1024,
} as const;

/** Largura máxima do conteúdo: linha de texto longa demais cansa de ler. */
export const LARGURA_MAXIMA_CONTEUDO = 1180;

export interface Layout {
  largura: number;
  altura: number;
  /** Celular: abas embaixo, uma coluna. */
  compacto: boolean;
  /** Tablet / janela estreita de computador: duas colunas, abas embaixo. */
  medio: boolean;
  /** Computador: barra lateral, cabeçalho com a logo, várias colunas. */
  amplo: boolean;
  /** Quantas colunas usar numa grade de cartões. */
  colunas: number;
}

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const medio = width >= QUEBRAS.medio;
  const amplo = width >= QUEBRAS.amplo;

  return {
    largura: width,
    altura: height,
    compacto: !medio,
    medio: medio && !amplo,
    amplo,
    colunas: amplo ? (width >= 1500 ? 4 : 3) : medio ? 2 : 1,
  };
}

/**
 * Largura em pixels de cada item para montar N colunas dentro de um container
 * já medido. Em pixels, e não em porcentagem, porque `gap` + `flexBasis: '50%'`
 * estoura o container no React Native.
 */
export function larguraDaColuna(larguraDisponivel: number, colunas: number, gap = 12): number {
  if (colunas <= 1 || larguraDisponivel <= 0) return larguraDisponivel;
  return (larguraDisponivel - gap * (colunas - 1)) / colunas;
}
