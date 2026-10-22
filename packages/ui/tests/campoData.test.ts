import { createRequire } from 'node:module';
import { createElement, type PropsWithChildren, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CampoData } from '../../../apps/mobile/src/componentes/campoData';
import { ContextoFormulario, type useFormulario } from '../../../apps/mobile/src/componentes/validacaoFormulario';

const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  renderToStaticMarkup(element: ReactElement): string;
};
const estado = vi.hoisted(() => ({
  plataforma: 'web', aberto: false,
  inputs: [] as Record<string, unknown>[],
  toques: [] as Record<string, unknown>[],
}));
vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>();
  return {
    ...real,
    createElement: (tipo: unknown, props: Record<string, unknown>, ...filhos: unknown[]) => {
      if (tipo === 'input') estado.inputs.push(props);
      return real.createElement(tipo as never, props, ...filhos as never[]);
    },
    useState: (inicial: unknown) => real.useState(typeof inicial === 'boolean' ? estado.aberto : inicial),
  };
});
vi.mock('react-native', () => ({
  Platform: { get OS() { return estado.plataforma; } },
  View: ({ children, nativeID }: PropsWithChildren<{ nativeID?: string }>) => createElement('div', { id: nativeID }, children),
  Modal: ({ children }: PropsWithChildren) => createElement('div', null, children),
  Pressable: (props: PropsWithChildren<Record<string, unknown>>) => {
    estado.toques.push(props);
    return createElement('button', { disabled: !!props.disabled }, props.children);
  },
}));
vi.mock('../../../apps/mobile/src/tema', () => ({
  useTema: () => ({ c: { alerta: '#d00', borda: '#aaa' }, espaco: {}, raio: {} }),
}));
vi.mock('../../../apps/mobile/src/componentes/base', () => ({
  Txt: ({ children }: PropsWithChildren) => createElement('span', null, children),
  Linha: ({ children }: PropsWithChildren) => createElement('div', null, children),
  Botao: (props: Record<string, unknown>) => { estado.toques.push(props); return null; },
}));

beforeEach(() => {
  estado.plataforma = 'web'; estado.aberto = false; estado.inputs = []; estado.toques = [];
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 22, 12));
});
afterEach(() => vi.useRealTimers());

describe('seletor de data', () => {
  it.each(['2024-02-29', '29/02/2024'])('abre valor %s em input date sem mudar o dia', (valor) => {
    const html = renderToStaticMarkup(createElement(CampoData, { rotulo: 'Nascimento', valor, aoMudar: vi.fn(), obrigatorio: true }));
    expect(html).toContain('type="date"');
    expect(html).toContain('value="2024-02-29"');
    expect(estado.inputs[0]?.max).toBe('2026-10-22');
    expect(estado.inputs[0]?.required).toBe(true);
  });

  it('envia ISO ao selecionar, permite limpar e limpa somente o erro do campo', () => {
    const mudar = vi.fn();
    const limparErro = vi.fn();
    const formulario = { erros: { Nascimento: 'Informe a data.' }, campos: { current: new Map() }, limparErro } as unknown as ReturnType<typeof useFormulario>;
    const html = renderToStaticMarkup(createElement(ContextoFormulario.Provider, { value: formulario },
      createElement(CampoData, { rotulo: 'Nascimento', valor: '', aoMudar: mudar })));
    expect(html).toContain('Informe a data.');
    const input = estado.inputs[0]!;
    expect(input['aria-invalid']).toBe(true);
    expect((input.style as { border: string }).border).toBe('1px solid #d00');
    const alterar = input.onChange as (evento: { target: { value: string } }) => void;
    alterar({ target: { value: '2024-02-29' } });
    expect(mudar).toHaveBeenLastCalledWith('2024-02-29');
    alterar({ target: { value: '' } });
    expect(mudar).toHaveBeenLastCalledWith('');
    expect(limparErro).toHaveBeenCalledWith('Nascimento');
  });

  it('no Android apresenta a data em português e abre o calendário sem input de texto', () => {
    estado.plataforma = 'android';
    const html = renderToStaticMarkup(createElement(CampoData, { rotulo: 'Nascimento', valor: '2024-02-29', aoMudar: vi.fn() }));
    expect(html).toContain('29/02/2024');
    expect(estado.inputs).toEqual([]);
    expect(estado.toques[0]?.accessibilityLabel).toBe('Nascimento');
  });

  it('no calendário Android respeita mês bissexto e emite ISO ao tocar no dia', () => {
    estado.plataforma = 'android'; estado.aberto = true;
    const mudar = vi.fn();
    renderToStaticMarkup(createElement(CampoData, { rotulo: 'Nascimento', valor: '2024-02-01', aoMudar: mudar }));
    const dia = estado.toques.find((p) => p.accessibilityLabel === '29/02/2024');
    expect(dia).toBeDefined();
    expect(estado.toques.some((p) => p.accessibilityLabel === '30/02/2024')).toBe(false);
    (dia!.onPress as () => void)();
    expect(mudar).toHaveBeenCalledWith('2024-02-29');
  });

  it('no calendário Android desabilita dias futuros e cancelar preserva o valor', () => {
    estado.plataforma = 'android'; estado.aberto = true;
    const mudar = vi.fn();
    renderToStaticMarkup(createElement(CampoData, { rotulo: 'Entrada', valor: '2026-10-20', aoMudar: mudar }));
    expect(estado.toques.find((p) => p.accessibilityLabel === '23/10/2026')?.disabled).toBe(true);
    (estado.toques.find((p) => p.titulo === 'Cancelar')!.aoTocar as () => void)();
    expect(mudar).not.toHaveBeenCalled();
  });
});
