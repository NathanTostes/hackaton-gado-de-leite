import { createRequire } from 'node:module';
import { Children, createElement, type PropsWithChildren, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Configuracoes from '../../../apps/mobile/app/configuracoes';

const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  renderToStaticMarkup(element: ReactElement): string;
};
const estado = vi.hoisted(() => ({
  recarregar: vi.fn(), erroCarga: null as string | null,
  botoes: [] as { titulo: string; aoTocar: () => Promise<void>; desabilitado: boolean }[],
}));

vi.mock('@drmoo/db', () => ({
  obterPropriedade: vi.fn(), salvarPropriedade: vi.fn(),
  // A tela também avisa sobre banco temporário e exporta/importa planilha.
  bancoEmMemoria: () => false,
  exportarPlanilha: vi.fn(), importarPlanilha: vi.fn(),
  gerarArquivoExemplo: vi.fn(() => new Uint8Array()),
  NOME_ARQUIVO_EXEMPLO: 'drmoo-planilha-de-exemplo.xlsx',
}));
vi.mock('../../../apps/mobile/src/arquivos', () => ({
  entregarArquivo: vi.fn(), escolherArquivo: vi.fn(),
}));
vi.mock('../../../apps/mobile/src/hooks', () => ({
  useDados: () => ({ dados: null, carregando: false, recarregar: estado.recarregar, erro: estado.erroCarga }),
}));
vi.mock('../../../apps/mobile/src/tema', () => ({
  useTema: () => ({ c: {}, espaco: {}, raio: {} }),
}));
vi.mock('../../../apps/mobile/src/modoVoz', () => ({
  useModoVoz: () => ({ ativo: false, carregado: true, definir: vi.fn() }),
}));
vi.mock('react-native', () => ({
  View: ({ children }: PropsWithChildren) => {
    Children.forEach(children, (child) => {
      if (typeof child === 'string' || typeof child === 'number') throw new Error('Texto fora de Text');
    });
    return createElement('div', null, children);
  },
  TextInput: () => createElement('input'),
  Platform: { OS: 'web' },
}));
vi.mock('../../../apps/mobile/src/componentes/base', async () => {
  const { View } = await import('react-native');
  const Texto = ({ children }: PropsWithChildren) => createElement('span', null, children);
  return {
    Tela: View, Cartao: View, Linha: View, Txt: Texto, TituloSecao: Texto,
    Espaco: () => null, Separador: () => null, Carregando: () => null, Chip: Texto,
    CabecalhoPagina: ({ titulo }: { titulo: string }) => createElement('span', null, titulo),
    // A barra de ações só agrupa botões; o teste olha os botões, não o arranjo.
    Acoes: ({ children, aviso }: PropsWithChildren<{ aviso?: unknown }>) =>
      createElement('div', null, children, aviso as never),
    Alerta: ({ texto }: { texto: string }) => createElement('span', null, texto),
    Botao: (props: (typeof estado.botoes)[number]) => { estado.botoes.push(props); return null; },
  };
});

describe('configurações', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    estado.botoes = [];
    estado.erroCarga = null;
  });

  it('renderiza campos vazios sem texto solto em View', () => {
    expect(() => renderToStaticMarkup(createElement(Configuracoes))).not.toThrow();
  });

  // O app abre vazio e os dados entram pela planilha: não existe mais nenhum
  // botão que apague tudo e recrie a demonstração.
  it('não oferece nenhuma ação de reset dos dados', () => {
    renderToStaticMarkup(createElement(Configuracoes));
    expect(estado.botoes.map((b) => b.titulo)).toEqual([
      'Salvar', 'Baixar planilha', 'Baixar planilha de exemplo', 'Importar planilha preenchida',
    ]);
  });

  // O exemplo existe para quem ainda não tem dado nenhum: ele não pode ler o
  // banco, e não pode escrever nele — só entrega um arquivo pronto.
  it('o botão de exemplo entrega o arquivo de demonstração sem tocar no banco', async () => {
    const { entregarArquivo } = await import('../../../apps/mobile/src/arquivos');
    const { exportarPlanilha, gerarArquivoExemplo, importarPlanilha } = await import('@drmoo/db');
    vi.mocked(entregarArquivo).mockResolvedValue('download');
    vi.mocked(gerarArquivoExemplo).mockReturnValue(new Uint8Array([1, 2, 3]));

    renderToStaticMarkup(createElement(Configuracoes));
    await estado.botoes.find((b) => b.titulo === 'Baixar planilha de exemplo')!.aoTocar();

    expect(vi.mocked(entregarArquivo).mock.calls[0]?.[0]).toMatchObject({
      nome: 'drmoo-planilha-de-exemplo.xlsx',
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(exportarPlanilha).not.toHaveBeenCalled();
    expect(importarPlanilha).not.toHaveBeenCalled();
  });

  it('exibe erro de leitura e impede salvar um formulário sem os dados carregados', () => {
    estado.erroCarga = 'Falha ao ler propriedade';
    expect(renderToStaticMarkup(createElement(Configuracoes))).toContain(estado.erroCarga);
    expect(estado.botoes.find((b) => b.titulo === 'Salvar')!.desabilitado).toBe(true);
  });
});
