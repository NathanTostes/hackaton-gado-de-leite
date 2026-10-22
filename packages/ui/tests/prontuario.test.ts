import { createRequire } from 'node:module';
import { createElement, type PropsWithChildren, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Prontuario from '../../../apps/mobile/app/prontuario/[id]';
import { Sessao } from '@drmoo/engine';
import { baseCompilada } from '@drmoo/knowledge';

const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  renderToStaticMarkup(element: ReactElement): string;
};
const estado = vi.hoisted(() => ({
  dados: null as unknown, carregando: false, erro: null as string | null, recarregar: vi.fn(),
  botoes: [] as { titulo: string; aoTocar: () => void }[],
}));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'consulta' }) }));
vi.mock('../../../apps/mobile/src/hooks', () => ({ useDados: () => estado }));
vi.mock('../../../apps/mobile/src/tema', () => ({ useTema: () => ({ c: {}, espaco: {} }) }));
vi.mock('../../../apps/mobile/src/arquivos', () => ({ entregarPdf: vi.fn() }));
vi.mock('../../../apps/mobile/src/componentes/parecer', () => ({
  CartaoHipotese: () => null, ComoChegueiNisso: () => null,
}));
vi.mock('react-native', () => ({
  View: ({ children }: PropsWithChildren) => createElement('div', null, children),
  Platform: { OS: 'web' },
}));
vi.mock('../../../apps/mobile/src/componentes/base', () => {
  const Grupo = ({ children }: PropsWithChildren) => createElement('div', null, children);
  const Texto = ({ children }: PropsWithChildren) => createElement('span', null, children);
  return {
    Tela: Grupo, Cartao: Grupo, Linha: Grupo, Acoes: Grupo, Txt: Texto, TituloSecao: Texto,
    Espaco: () => null, MaterialIcons: () => null, AvisoVeterinario: () => null,
    Carregando: () => createElement('span', null, 'Carregando'),
    Vazio: ({ titulo }: { titulo: string }) => createElement('span', null, titulo),
    Alerta: ({ titulo, texto }: { titulo: string; texto?: string }) => createElement('span', null, titulo, texto),
    Botao: (props: (typeof estado.botoes)[number]) => { estado.botoes.push(props); return null; },
  };
});

describe('estados do prontuário', () => {
  beforeEach(() => {
    estado.dados = null;
    estado.carregando = false;
    estado.erro = null;
    estado.botoes = [];
    estado.recarregar.mockClear();
  });

  it('mostra carregamento apenas enquanto a consulta está pendente', () => {
    estado.carregando = true;
    const html = renderToStaticMarkup(createElement(Prontuario));
    expect(html).toContain('Carregando');
    expect(html).not.toContain('não encontrado');
  });

  it('informa prontuário inexistente depois de terminar a leitura', () => {
    const html = renderToStaticMarkup(createElement(Prontuario));
    expect(html).toContain('Prontuário não encontrado');
    expect(html).not.toContain('Carregando');
  });

  it('mostra falha de leitura e permite tentar novamente', () => {
    estado.erro = 'Falha de leitura';
    const html = renderToStaticMarkup(createElement(Prontuario));
    expect(html).toContain('Não foi possível carregar o prontuário');
    expect(html).toContain('Falha de leitura');
    estado.botoes.find((b) => b.titulo === 'Tentar novamente')!.aoTocar();
    expect(estado.recarregar).toHaveBeenCalledOnce();
  });

  it('continua mostrando o parecer e a exportação quando encontra o atendimento', () => {
    const parecer = new Sessao(baseCompilada).encerrar();
    estado.dados = {
      atendimento: { id: 'consulta', data_hora: '2026-10-22T12:00:00Z', kb_versao: parecer.kbVersao },
      animal: { nome: 'Mimosa', brinco: '001' }, parecer, respostas: [], reproduz: true,
    };
    const html = renderToStaticMarkup(createElement(Prontuario));
    expect(html).toContain('Mimosa');
    expect(html).toContain('Parecer reproduzido');
    expect(html).toContain('Levar este prontuário');
    expect(html).not.toContain('não encontrado');
  });
});
