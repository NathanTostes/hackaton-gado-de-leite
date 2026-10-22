import { createRequire } from 'node:module';
import { Children, createElement, type PropsWithChildren, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Configuracoes from '../../../apps/mobile/app/configuracoes';

const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  renderToStaticMarkup(element: ReactElement): string;
};
const estado = vi.hoisted(() => ({
  recriar: vi.fn(), recarregar: vi.fn(), erroCarga: null as string | null,
  botoes: [] as { titulo: string; aoTocar: () => Promise<void>; desabilitado: boolean }[],
}));

vi.mock('@drmoo/db', () => ({
  obterPropriedade: vi.fn(), salvarPropriedade: vi.fn(), recriarDemonstracao: estado.recriar,
}));
vi.mock('../../../apps/mobile/src/hooks', () => ({
  useDados: () => ({ dados: null, carregando: false, recarregar: estado.recarregar, erro: estado.erroCarga }),
}));
vi.mock('../../../apps/mobile/src/tema', () => ({
  useTema: () => ({ c: {}, espaco: {}, raio: {} }),
}));
vi.mock('react-native', () => ({
  View: ({ children }: PropsWithChildren) => {
    Children.forEach(children, (child) => {
      if (typeof child === 'string' || typeof child === 'number') throw new Error('Texto fora de Text');
    });
    return createElement('div', null, children);
  },
  TextInput: () => createElement('input'),
}));
vi.mock('../../../apps/mobile/src/componentes/base', async () => {
  const { View } = await import('react-native');
  const Texto = ({ children }: PropsWithChildren) => createElement('span', null, children);
  return {
    Tela: View, Cartao: View, Linha: View, Txt: Texto, TituloSecao: Texto,
    Espaco: () => null, Separador: () => null, Carregando: () => null,
    Alerta: ({ texto }: { texto: string }) => createElement('span', null, texto),
    Botao: (props: (typeof estado.botoes)[number]) => { estado.botoes.push(props); return null; },
  };
});

describe('configurações e botão de demonstração', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    estado.botoes = [];
    estado.erroCarga = null;
  });

  it('renderiza campos vazios sem texto solto em View', () => {
    expect(() => renderToStaticMarkup(createElement(Configuracoes))).not.toThrow();
  });

  it('aciona a recriação atômica e atualiza a propriedade', async () => {
    renderToStaticMarkup(createElement(Configuracoes));
    await estado.botoes.find((b) => b.titulo === 'Recriar dados de demonstração')!.aoTocar();
    expect(estado.recriar).toHaveBeenCalledOnce();
    expect(estado.recarregar).toHaveBeenCalledOnce();
  });

  it('trata a rejeição do banco sem propagar erro não capturado', async () => {
    estado.recriar.mockRejectedValueOnce(new Error('Falha ao gravar'));
    renderToStaticMarkup(createElement(Configuracoes));
    await expect(estado.botoes.find((b) => b.titulo === 'Recriar dados de demonstração')!.aoTocar()).resolves.toBeUndefined();
    expect(estado.recarregar).not.toHaveBeenCalled();
  });

  it('exibe erro de leitura e impede salvar um formulário sem os dados carregados', () => {
    estado.erroCarga = 'Falha ao ler propriedade';
    expect(renderToStaticMarkup(createElement(Configuracoes))).toContain(estado.erroCarga);
    expect(estado.botoes.find((b) => b.titulo === 'Salvar')!.desabilitado).toBe(true);
  });
});
