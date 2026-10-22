import { createRequire } from 'node:module';
import { createElement, type PropsWithChildren, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoricoSaidas } from '../../../apps/mobile/src/telas/historicoSaidas';
import RegistrarSaida from '../../../apps/mobile/app/registrar-saida/[id]';
import type { RegistroSaida } from '@drmoo/db';

const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  renderToStaticMarkup(element: ReactElement): string;
};
const estado = vi.hoisted(() => ({
  dados: null as unknown, erro: null as string | null, carregando: false,
  params: { id: 'a1', tipo: 'falecimento' },
  botoes: [] as { titulo: string; aoTocar: () => void; desabilitado?: boolean }[],
  push: vi.fn(), replace: vi.fn(), registrar: vi.fn(),
}));
vi.mock('expo-router', () => ({ router: { push: estado.push, replace: estado.replace, back: vi.fn() }, useLocalSearchParams: () => estado.params }));
vi.mock('@drmoo/db', () => ({ historicoSaidas: vi.fn(), obterAnimal: vi.fn(), registrarSaida: estado.registrar }));
vi.mock('../../../apps/mobile/src/hooks', () => ({ useDados: () => ({ ...estado, recarregar: vi.fn() }) }));
vi.mock('../../../apps/mobile/src/tema', () => ({ useTema: () => ({ c: {}, espaco: {}, raio: {} }) }));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  View: ({ children }: PropsWithChildren) => createElement('div', null, children),
  TextInput: ({ accessibilityLabel, value }: { accessibilityLabel: string; value: string }) =>
    createElement('input', { 'aria-label': accessibilityLabel, defaultValue: value }),
}));
vi.mock('../../../apps/mobile/src/componentes/base', () => {
  const Grupo = ({ children }: PropsWithChildren) => createElement('div', null, children);
  const Texto = ({ children }: PropsWithChildren) => createElement('span', null, children);
  return {
    Tela: Grupo, Cartao: Grupo, Linha: Grupo, Txt: Texto, Espaco: () => null, Carregando: () => null,
    CabecalhoPagina: ({ titulo }: { titulo: string }) => createElement('h1', null, titulo),
    Vazio: ({ titulo }: { titulo: string }) => createElement('p', null, titulo),
    Alerta: ({ titulo, texto }: { titulo: string; texto?: string }) => createElement('p', null, titulo, texto),
    Botao: (props: (typeof estado.botoes)[number]) => { estado.botoes.push(props); return null; },
  };
});

beforeEach(() => {
  estado.dados = null; estado.erro = null; estado.carregando = false;
  estado.botoes = []; estado.params = { id: 'a1', tipo: 'falecimento' };
  vi.clearAllMocks();
});
const registro: RegistroSaida = { id: 'r1', animal_id: 'a1', brinco: '101', nome: 'Mimosa',
  data: '2026-10-20', hora: '09:35', causa: 'Causa registrada', valor: 4800.5, destinatario: 'Fazenda vizinha' };

describe('históricos de saídas', () => {
  it('mostra data, hora e causa do falecimento com acesso à ficha', () => {
    estado.dados = [registro];
    const html = renderToStaticMarkup(createElement(HistoricoSaidas, { tipo: 'falecimento' }));
    expect(html).toContain('20/10/2026'); expect(html).toContain('09:35'); expect(html).toContain('Causa registrada');
    estado.botoes.find((b) => b.titulo === 'Ver ficha e prontuários')!.aoTocar();
    expect(estado.push).toHaveBeenCalledWith('/animal/a1');
  });
  it('mostra valor da venda e destinatário', () => {
    estado.dados = [registro];
    const html = renderToStaticMarkup(createElement(HistoricoSaidas, { tipo: 'venda' }));
    expect(html).toContain('4.800,50'); expect(html).toContain('Fazenda vizinha'); expect(html).not.toContain('Causa registrada');
  });
  it('não inventa hora nos falecimentos legados', () => {
    estado.dados = [{ ...registro, hora: null }];
    expect(renderToStaticMarkup(createElement(HistoricoSaidas, { tipo: 'falecimento' }))).toContain('Não informada');
  });
  it('exibe o estado vazio e os erros de leitura', () => {
    estado.dados = [];
    expect(renderToStaticMarkup(createElement(HistoricoSaidas, { tipo: 'venda' }))).toContain('Nenhuma venda registrada');
    estado.erro = 'Falha de leitura';
    expect(renderToStaticMarkup(createElement(HistoricoSaidas, { tipo: 'venda' }))).toContain('Falha de leitura');
  });
});

describe('formulário de saída no perfil', () => {
  it('oferece data, hora e causa no falecimento', () => {
    estado.dados = { id: 'a1', brinco: '101', status: 'saudavel' };
    const html = renderToStaticMarkup(createElement(RegistrarSaida));
    expect(html).toContain('type="date"'); expect(html).toContain('type="time"'); expect(html).toContain('Causa do falecimento');
    expect(estado.botoes.some((b) => b.titulo === 'Registrar falecimento')).toBe(true);
  });
  it('oferece valor e destinatário na venda', () => {
    estado.params.tipo = 'venda'; estado.dados = { id: 'a1', brinco: '101', status: 'saudavel' };
    const html = renderToStaticMarkup(createElement(RegistrarSaida));
    expect(html).toContain('Valor da venda (R$)'); expect(html).toContain('Destinatário');
    expect(estado.botoes.some((b) => b.titulo === 'Registrar venda')).toBe(true);
  });
  it.each(['morto', 'vendido'])('impede novo registro pelo formulário para um animal %s', (status) => {
    estado.dados = { id: 'a1', status };
    expect(renderToStaticMarkup(createElement(RegistrarSaida))).toContain('Este animal já saiu do rebanho');
    expect(estado.botoes.some((b) => b.titulo.startsWith('Registrar'))).toBe(false);
    expect(estado.registrar).not.toHaveBeenCalled();
  });
});
