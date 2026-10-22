import { createRequire } from 'node:module';
import { Children, createElement, type PropsWithChildren, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnimalComResumo } from '@drmoo/db';
import { ContextoFormulario, type useFormulario } from '../../../apps/mobile/src/componentes/validacaoFormulario';
import { FormularioAnimal } from '../../../apps/mobile/src/componentes/formularioAnimal';

const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  renderToStaticMarkup(element: ReactElement): string;
};

const { inputs } = vi.hoisted(() => ({ inputs: [] as Record<string, unknown>[] }));

vi.mock('expo-router', () => ({ router: { replace: vi.fn() } }));
vi.mock('../../../apps/mobile/src/tema', () => ({
  useTema: () => ({ c: { alerta: '#d00', borda: '#aaa' }, espaco: {}, raio: {} }),
}));

vi.mock('react-native', () => {
  // Reproduz a restrição de View do react-native-web, inclusive para a string vazia.
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
    TextInput: (props: Record<string, unknown>) => {
      inputs.push(props);
      return createElement(props.multiline ? 'textarea' : 'input', {
        'aria-label': props.accessibilityLabel,
        defaultValue: props.value,
        autoComplete: props.autoComplete,
        rows: props.numberOfLines,
      });
    },
  };
});

vi.mock('../../../apps/mobile/src/componentes/base', async () => {
  const { View } = await import('react-native');
  const Texto = ({ children }: PropsWithChildren) => createElement('span', null, children);
  return {
    Tela: View, Cartao: View, Linha: View, Txt: Texto, TituloSecao: Texto,
    Espaco: () => null, Separador: () => null, MaterialIcons: () => null,
    Botao: () => null, Chip: () => null, Alerta: () => null,
  };
});

describe('renderização do cadastro de animais', () => {
  beforeEach(() => { inputs.length = 0; });

  it.each(['novo', 'nascimento'] as const)('abre o formulário %s vazio sem texto solto em View', (modo) => {
    expect(() => renderToStaticMarkup(createElement(FormularioAnimal, {
      modo, aoVoltar: () => {},
    }))).not.toThrow();
    expect(inputs.length).toBeGreaterThan(5);
  });

  it.each(['', '0', '2'])('renderiza idade estimada %j sem filhos primitivos em View', (idade) => {
    const animal = {
      id: 'animal', brinco: '238', sexo: 'F', categoria: 'novilha', origem: 'compra',
      idade_estimada_meses: idade === '' ? null : Number(idade), idade_estimada_em: '2026-01-01',
    } as AnimalComResumo;
    const html = renderToStaticMarkup(createElement(FormularioAnimal, {
      modo: 'novo', aoVoltar: () => {}, animal,
    }));
    expect(html.includes('Estimativa em')).toBe(idade !== '');
  });

  it.each(['novo', 'nascimento'] as const)('desativa autofill em todos os campos do formulário %s', (modo) => {
    renderToStaticMarkup(createElement(FormularioAnimal, { modo, aoVoltar: () => {} }));
    expect(inputs.length).toBeGreaterThan(5);
    for (const input of inputs) {
      expect(input.autoComplete).toBe('off');
      expect(input.importantForAutofill).toBe('no');
      expect(input.textContentType).toBe('none');
    }
  });

  it.each(['novo', 'nascimento'] as const)('usa controles web fora da heurística de cartões no modo %s', (modo) => {
    const html = renderToStaticMarkup(createElement(FormularioAnimal, { modo, aoVoltar: () => {} }));
    expect(html).not.toContain('<input');
    expect(html).toContain('<textarea');
    for (const input of inputs) {
      expect(input.multiline).toBe(true);
      expect(input.numberOfLines).toBe(
        /^(Observações|Histórico)/.test(String(input.accessibilityLabel)) ? 3 : 1,
      );
    }
  });

  it('mantém identificação em uma linha e permite parágrafos nas observações', () => {
    renderToStaticMarkup(createElement(FormularioAnimal, { modo: 'novo', aoVoltar: () => {} }));
    const nome = inputs.find((input) => input.accessibilityLabel === 'Nome')!;
    const observacoes = inputs.find((input) => input.accessibilityLabel === 'Observações')!;
    const impedirEnter = vi.fn();
    const evento = { nativeEvent: { key: 'Enter' }, preventDefault: impedirEnter };
    (nome.onKeyPress as (event: typeof evento) => void)(evento);
    expect(impedirEnter).toHaveBeenCalledOnce();
    impedirEnter.mockClear();
    (observacoes.onKeyPress as (event: typeof evento) => void)(evento);
    expect(impedirEnter).not.toHaveBeenCalled();
  });
});

it('destaca somente o campo inválido e limpa seu erro ao editar', () => {
    inputs.length = 0;
    const limparErro = vi.fn();
    const formulario = {
      erros: { 'Número ou brinco *': 'Já existe um animal com este brinco.' },
      campos: { current: new Map() }, limparErro,
    } as unknown as ReturnType<typeof useFormulario>;
    const html = renderToStaticMarkup(createElement(ContextoFormulario.Provider, { value: formulario },
      createElement(FormularioAnimal, { modo: 'novo', aoVoltar: () => {} })));
    const brinco = inputs.find((input) => input.accessibilityLabel === 'Número ou brinco *')!;
    const nome = inputs.find((input) => input.accessibilityLabel === 'Nome')!;
    expect((brinco.style as { borderColor: string }).borderColor).toBe('#d00');
    expect(brinco['aria-invalid']).toBe(true);
    expect((nome.style as { borderColor: string }).borderColor).toBe('#aaa');
    expect(html).toContain('Já existe um animal com este brinco.');
    (brinco.onChangeText as (texto: string) => void)('239');
    expect(limparErro).toHaveBeenCalledWith('Número ou brinco *');
  });
