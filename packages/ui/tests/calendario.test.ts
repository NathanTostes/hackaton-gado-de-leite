import { createRequire } from 'node:module';
import { createElement, type PropsWithChildren, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Calendario, { ListaEventos } from '../../../apps/mobile/app/(tabs)/calendario';
import { AgendaProntuario } from '../../../apps/mobile/src/componentes/agendaProntuario';
import { CompromissosProntuario } from '../../../apps/mobile/src/componentes/compromissosProntuario';
import type { EventoComAnimal } from '@drmoo/db';
import { Sessao } from '@drmoo/engine';
import { baseCompilada } from '@drmoo/knowledge';

const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as { renderToStaticMarkup(element: ReactElement): string };
const estado = vi.hoisted(() => ({
  expandido: false, eventos: [] as unknown[],
  botoes: [] as { titulo: string; aoTocar: () => void }[],
  datas: [] as { rotulo: string; valor: string; permitirFuturas?: boolean; desabilitado?: boolean }[],
  push: vi.fn(),
}));
vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>();
  return { ...real, useState: (inicial: unknown) => typeof inicial === 'boolean'
    ? [estado.expandido, (valor: boolean | ((atual: boolean) => boolean)) => { estado.expandido = typeof valor === 'function' ? valor(estado.expandido) : valor; }]
    : real.useState(inicial) };
});
vi.mock('expo-router', () => ({ router: { push: estado.push } }));
vi.mock('../../../apps/mobile/src/hooks', () => ({ useDados: () => ({ dados: estado.eventos, carregando: false, recarregar: vi.fn(), erro: null }) }));
vi.mock('../../../apps/mobile/src/tema', () => ({ useTema: () => ({ c: {}, espaco: {}, raio: {} }) }));
vi.mock('../../../apps/mobile/src/componentes/campoData', () => ({ CampoData: (props: (typeof estado.datas)[number]) => { estado.datas.push(props); return null; } }));
vi.mock('react-native', () => ({
  View: ({ children }: PropsWithChildren) => createElement('div', null, children),
  Pressable: ({ children }: PropsWithChildren) => createElement('button', null, children),
  TextInput: () => createElement('input'),
}));
vi.mock('../../../apps/mobile/src/componentes/base', () => {
  const Grupo = ({ children }: PropsWithChildren) => createElement('div', null, children);
  const Texto = ({ children }: PropsWithChildren) => createElement('span', null, children);
  return { Tela: Grupo, Linha: Grupo, Cartao: Grupo, Txt: Texto, TituloSecao: Texto,
    Espaco: () => null, MaterialIcons: () => null, Carregando: () => null,
    Chip: ({ texto }: { texto: string }) => createElement('span', null, texto),
    Alerta: ({ titulo }: { titulo: string }) => createElement('p', null, titulo),
    Vazio: ({ titulo }: { titulo: string }) => createElement('p', null, titulo),
    CabecalhoPagina: ({ titulo }: { titulo: string }) => createElement('h1', null, titulo),
    Botao: (props: (typeof estado.botoes)[number]) => { estado.botoes.push(props); return null; },
  };
});
const eventos = Array.from({ length: 7 }, (_, i) => ({
  id: `e${i}`, titulo: `Compromisso ${i}`, tipo: i === 0 ? 'vacinacao' : 'medicacao', data: '2026-10-23',
  status: 'pendente', brinco: '101', atendimento_id: 'ate1',
} as EventoComAnimal));
function renderizar(elemento: ReactElement) { estado.botoes = []; estado.datas = []; return renderToStaticMarkup(elemento); }
beforeEach(() => {
  estado.expandido = false; estado.eventos = []; estado.push.mockClear();
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 22, 12));
});
afterEach(() => vi.useRealTimers());

describe('calendário e compromissos do prontuário', () => {
  it('Ver mais revela os demais compromissos e Ver menos recolhe a lista', () => {
    const lista = createElement(ListaEventos, { eventos });
    expect(renderizar(lista)).not.toContain('Compromisso 6');
    estado.botoes.find((b) => b.titulo.startsWith('Ver mais'))!.aoTocar();
    expect(renderizar(lista)).toContain('Compromisso 6');
    estado.botoes.find((b) => b.titulo === 'Ver menos')!.aoTocar();
    expect(renderizar(lista)).not.toContain('Compromisso 6');
  });
  it('o calendário mostra vacinas, medicações, suas datas e o link para o prontuário', () => {
    estado.eventos = eventos.slice(0, 2);
    const html = renderizar(createElement(Calendario));
    expect(html).toContain('Vacinação'); expect(html).toContain('Medicação'); expect(html).toContain('23/10/2026');
    expect(html).toContain('Todos');
    estado.botoes.find((b) => b.titulo === 'Ver prontuário')!.aoTocar();
    expect(estado.push).toHaveBeenCalledWith('/prontuario/ate1');
  });
  it('o prontuário salvo mostra as datas e pode expandir os compromissos', () => {
    const componente = createElement(CompromissosProntuario, { eventos });
    const html = renderizar(componente);
    expect(html).toContain('23/10/2026'); expect(html).not.toContain('Compromisso 6');
    estado.botoes.find((b) => b.titulo.startsWith('Ver mais'))!.aoTocar();
    expect(renderizar(componente)).toContain('Compromisso 6');
  });
  it('permite escolher a data do atendimento e datas futuras para ações antes de salvar', () => {
    const parecer = new Sessao(baseCompilada).encerrar();
    const html = renderizar(createElement(AgendaProntuario, { parecer, ajustes: {
      'Vacina registrada': { extra: true, tipo: 'vacinacao', data: '2027-01-15' },
    }, aoMudar: vi.fn(), dataAtendimento: '2026-10-20', aoMudarData: vi.fn() }));
    expect(html).toContain('Vacina registrada');
    expect(estado.datas.find((d) => d.rotulo === 'Data do atendimento')?.valor).toBe('2026-10-20');
    expect(estado.datas.find((d) => d.rotulo.startsWith('Data —'))).toMatchObject({ permitirFuturas: true, valor: '2027-01-15' });
  });
});
