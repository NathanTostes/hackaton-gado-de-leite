/**
 * A tela de rebanho é a mais usada do app: é por ela que o produtor acha o
 * animal.
 *
 * Aqui se verifica o que a tela MOSTRA e o que ela pede ao banco na abertura.
 * A tradução dos filtros em consulta é função pura e tem teste próprio
 * (`filtrosRebanho.test.ts`) — interação com estado não cabe em renderização
 * estática, e fingir que cabe daria um teste que passa sem provar nada.
 */
import { createRequire } from 'node:module';
import { Children, createElement, type PropsWithChildren, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FiltrosRebanho } from '@drmoo/db';
import Rebanho from '../../../apps/mobile/app/(tabs)/rebanho';

const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  renderToStaticMarkup(element: ReactElement): string;
};

const estado = vi.hoisted(() => ({
  filtros: [] as FiltrosRebanho[],
  chips: [] as { texto: string; ativo?: boolean; aoTocar?: () => void }[],
  animais: [] as Record<string, unknown>[],
  params: {} as Record<string, string>,
}));

vi.mock('@drmoo/db', () => ({
  ROTULO_STATUS: {
    saudavel: 'Saudável',
    em_tratamento: 'Em tratamento',
    em_carencia: 'Em carência',
    mastite_cronica: 'Mastite crônica',
    quarentena: 'Quarentena',
  },
  listarLotes: async () => [{ id: 'lot_1', nome: 'Lactação', animais: 12 }],
  listarRebanho: async (f: FiltrosRebanho) => {
    estado.filtros.push(f);
    return estado.animais;
  },
}));

vi.mock('expo-router', () => ({
  router: { push: vi.fn() },
  useLocalSearchParams: () => estado.params,
}));

vi.mock('../../../apps/mobile/src/hooks', () => ({
  // Executa o carregador de verdade para capturar os filtros, mas devolve
  // sempre o mesmo resultado: o teste é sobre a consulta, não sobre o await.
  useDados: (carregar: () => Promise<unknown>) => {
    void carregar();
    return { dados: estado.animais, carregando: false, recarregar: vi.fn(), erro: null };
  },
}));

vi.mock('../../../apps/mobile/src/responsivo', () => ({ useLayout: () => ({ amplo: false, largura: 400 }) }));
vi.mock('../../../apps/mobile/src/tema', () => ({
  useTema: () => ({ c: {}, espaco: {}, raio: {}, t: {}, toque: {} }),
}));

vi.mock('react-native', () => {
  function View({ children }: PropsWithChildren) {
    Children.forEach(children, (child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        throw new Error(`Texto fora de <Text>: ${JSON.stringify(child)}`);
      }
    });
    return createElement('div', null, children);
  }
  return {
    Platform: { OS: 'web' },
    View,
    Pressable: View,
    ScrollView: View,
    TextInput: () => createElement('input'),
    FlatList: ({
      data,
      renderItem,
    }: {
      data: unknown[];
      renderItem?: (info: { item: unknown; index: number }) => ReactElement;
    }) =>
      createElement(
        'div',
        null,
        renderItem ? data.map((item, index) => createElement('div', { key: index }, renderItem({ item, index }))) : null,
      ),
  };
});

vi.mock('../../../apps/mobile/src/componentes/base', async () => {
  const { View } = await import('react-native');
  const Texto = ({ children }: PropsWithChildren) => createElement('span', null, children);
  return {
    Tela: View,
    Cartao: View,
    Linha: View,
    Txt: Texto,
    TituloSecao: Texto,
    CabecalhoPagina: () => null,
    Espaco: () => null,
    Separador: () => null,
    Carregando: () => null,
    Vazio: ({ titulo }: { titulo: string }) => createElement('span', null, titulo),
    Botao: () => null,
    MaterialIcons: () => null,
    Chip: (props: (typeof estado.chips)[number]) => {
      estado.chips.push(props);
      return createElement('span', null, props.texto);
    },
  };
});

function renderizar(): string {
  estado.chips = [];
  estado.filtros = [];
  return renderToStaticMarkup(createElement(Rebanho));
}

describe('tela de rebanho', () => {
  beforeEach(() => {
    estado.animais = [
      {
        id: 'a1',
        brinco: '101',
        nome: 'Mimosa',
        categoria: 'vaca_lactacao',
        status: 'saudavel',
        raca: 'Girolando',
        idade_meses: 62,
        lote_nome: 'Lactação',
        del: 120,
        producao_media_dia: 16.4,
        ultimo_cmt: null,
        tem_peito_perdido: false,
        data_provavel_parto: null,
      },
    ];
    estado.params = {};
  });

  it('renderiza a lista sem texto solto fora de Text', () => {
    expect(() => renderizar()).not.toThrow();
  });

  it('mostra categoria, raça, idade, lote, DEL e produção na linha do animal', () => {
    const html = renderizar();

    expect(html).toContain('Mimosa');
    expect(html).toContain('Girolando');
    expect(html).toContain('5 a 2 m'); // 62 meses
    expect(html).toContain('Lactação');
    expect(html).toContain('120 DEL');
    expect(html).toContain('16,4 L/dia');
  });

  it('a primeira consulta vai sem filtro e ordenada por brinco', () => {
    renderizar();

    const primeira = estado.filtros[0];
    expect(primeira?.ordenarPor).toBe('brinco');
    expect(primeira?.categorias).toBeUndefined();
    expect(primeira?.emCarencia).toBeUndefined();
    expect(primeira?.cmtMinimo).toBeUndefined();
  });

  it('o parâmetro ?carencia=1 abre a tela já filtrada (veio do painel de alertas)', () => {
    estado.params = { carencia: '1' };
    renderizar();

    expect(estado.filtros[0]?.emCarencia).toBe(true);
  });

  it('a lista vazia explica o que fazer em vez de só dizer "nada"', () => {
    estado.animais = [];
    const html = renderizar();

    expect(html).toContain('Nenhum animal encontrado');
  });
});
