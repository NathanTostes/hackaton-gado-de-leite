import { createRequire } from 'node:module';
import { createElement, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validarCampos } from '../../../apps/mobile/src/componentes/validarCampos';
import { ContextoFormulario, useCampoFormulario, useFormulario } from '../../../apps/mobile/src/componentes/validacaoFormulario';

const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  renderToStaticMarkup(element: ReactElement): string;
};

afterEach(() => vi.unstubAllGlobals());

describe('validação dos cadastros', () => {
  it('coleta todos os erros sem aceitar datas inexistentes, infinitos ou frações de inteiros', () => {
    expect(Object.keys(validarCampos([
      { rotulo: 'Brinco', valor: ' ', obrigatorio: true },
      { rotulo: 'Nascimento', valor: '31/02/2025', tipo: 'data' },
      { rotulo: 'Peso', valor: '0', tipo: 'numero', positivo: true },
      { rotulo: 'Lactações', valor: '1,5', tipo: 'numero', inteiro: true },
      { rotulo: 'Preço', valor: 'Infinity', tipo: 'numero' },
      { rotulo: 'Litros', valor: 'abc', tipo: 'numero' },
    ]))).toEqual(['Brinco', 'Nascimento', 'Peso', 'Lactações', 'Preço', 'Litros']);
  });

  it('aceita vírgula decimal, datas BR e ISO, zero permitido e opcionais vazios', () => {
    expect(validarCampos([
      { rotulo: 'Preço', valor: '2,50', tipo: 'numero' },
      { rotulo: 'Litros', valor: '0', tipo: 'numero' },
      { rotulo: 'Nascimento', valor: '29/02/2024', tipo: 'data' },
      { rotulo: 'Entrada', valor: '2024-03-01', tipo: 'data' },
      { rotulo: 'Idade', valor: '', tipo: 'numero' },
    ])).toEqual({});
  });

  it('rejeita datas futuras, números negativos e separadores de milhar', () => {
    expect(Object.keys(validarCampos([
      { rotulo: 'Entrada', valor: '9999-01-01', tipo: 'data' },
      { rotulo: 'Peso', valor: '-1', tipo: 'numero' },
      { rotulo: 'Valor', valor: '1.000,00', tipo: 'numero' },
    ]))).toEqual(['Entrada', 'Peso', 'Valor']);
  });
});

describe('rolagem até o primeiro erro', () => {
  function montar() {
    let formulario!: ReturnType<typeof useFormulario>;
    const campos: Record<string, ReturnType<typeof useCampoFormulario>> = {};
    function Campo({ id }: { id: string }) {
      campos[id] = useCampoFormulario(id);
      return null;
    }
    function Formulario() {
      formulario = useFormulario();
      return createElement(ContextoFormulario.Provider, { value: formulario },
        createElement(Campo, { id: 'primeiro' }), createElement(Campo, { id: 'segundo' }));
    }
    renderToStaticMarkup(createElement(Formulario));
    return { formulario, campos };
  }

  it('mede após o layout e escolhe a ordem visual, mesmo com erros em ordem inversa', () => {
    const frames: (() => void)[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { frames.push(callback); return frames.length; });
    const { formulario, campos } = montar();
    const scrollTo = vi.fn();
    formulario.scroll.current = { scrollTo } as never;
    formulario.conteudo.current = {} as never;
    const measureLayout = vi.fn((_parent, sucesso) => sucesso(0, 350));
    campos.primeiro!.ref({ measureLayout } as never);
    campos.segundo!.ref({ measureLayout: vi.fn() } as never);
    expect(formulario.mostrarErros({ segundo: 'Inválido', primeiro: 'Obrigatório' })).toBe(true);
    expect(scrollTo).not.toHaveBeenCalled();
    frames.shift()!();
    frames.shift()!();
    expect(measureLayout).toHaveBeenCalledOnce();
    expect(scrollTo).toHaveBeenCalledWith({ y: 338, animated: true });
  });

  it('ignora campos desmontados e não rola quando não há erros', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { callback(); return 0; });
    const { formulario, campos } = montar();
    const scrollTo = vi.fn();
    formulario.scroll.current = { scrollTo } as never;
    formulario.conteudo.current = {} as never;
    campos.primeiro!.ref({ measureLayout: vi.fn() } as never);
    campos.primeiro!.ref(null);
    expect(formulario.mostrarErros({ primeiro: 'Erro' })).toBe(true);
    expect(formulario.mostrarErros({})).toBe(false);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
