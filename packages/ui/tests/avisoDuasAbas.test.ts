/**
 * A tela que aparece quando o app já está aberto em outra aba.
 *
 * O risco que ela existe para evitar é específico: a aba secundária funciona,
 * aceita lançamento de CMT, e não salva nada. A tela precisa dizer isso com
 * todas as letras e oferecer saída — qualquer regressão aqui volta a produzir
 * perda silenciosa de dado.
 */
import { createRequire } from 'node:module';
import { Children, createElement, type PropsWithChildren, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AvisoDuasAbas } from '../../../apps/mobile/src/componentes/avisoDuasAbas';

const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  renderToStaticMarkup(element: ReactElement): string;
};

const estado = vi.hoisted(() => ({
  botoes: [] as { accessibilityLabel: string; disabled?: boolean; onPress?: () => void }[],
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
    ScrollView: View,
    Pressable: (props: PropsWithChildren<(typeof estado.botoes)[number]>) => {
      estado.botoes.push(props);
      return createElement('button', { 'aria-label': props.accessibilityLabel }, props.children);
    },
  };
});

vi.mock('../../../apps/mobile/src/componentes/base', () => ({
  MaterialIcons: () => null,
  Txt: ({ children }: PropsWithChildren) => createElement('span', null, children),
}));

function renderizar(aoTentar = vi.fn(async () => true), aoContinuar = vi.fn()): string {
  estado.botoes = [];
  return renderToStaticMarkup(
    createElement(AvisoDuasAbas, { aoTentarNovamente: aoTentar, aoContinuarSemSalvar: aoContinuar }),
  );
}

describe('aviso de duas abas', () => {
  it('renderiza sem texto solto fora de Text', () => {
    expect(() => renderizar()).not.toThrow();
  });

  it('explica o motivo em linguagem de produtor, sem jargão de navegador', () => {
    const html = renderizar();

    expect(html).toContain('O Dr. Moo já está aberto em outra aba');
    expect(html).toContain('uma aba escrever nele por vez');
    expect(html).not.toContain('OPFS');
    expect(html).not.toContain('SQLite');
  });

  it('diz o que fazer: voltar à outra aba ou fechá-la e tentar de novo', () => {
    const html = renderizar();

    expect(html).toContain('Volte à outra aba');
    expect(html).toContain('feche a outra aba');
  });

  it('avisa que continuar ali não salva nada', () => {
    const html = renderizar();

    expect(html).toContain('Continuar aqui sem salvar');
    // O React quebra o parágrafo em vários nós de texto; comparar o texto puro
    // é o que reflete o que o usuário lê.
    const texto = html.replace(/<[^>]+>/g, '');
    expect(texto).toContain('nada do que você registrar nela será guardado');
  });

  it('oferece as duas saídas como botões acessíveis', () => {
    renderizar();

    expect(estado.botoes.map((b) => b.accessibilityLabel)).toEqual([
      'Tentar de novo',
      'Continuar aqui sem salvar',
    ]);
  });

  it('“tentar de novo” chama quem sabe reabrir o banco', async () => {
    const aoTentar = vi.fn(async () => true);
    renderizar(aoTentar);

    await estado.botoes[0]?.onPress?.();

    expect(aoTentar).toHaveBeenCalledOnce();
  });

  it('“continuar sem salvar” libera o app na hora', () => {
    const aoContinuar = vi.fn();
    renderizar(vi.fn(async () => true), aoContinuar);

    estado.botoes[1]?.onPress?.();

    expect(aoContinuar).toHaveBeenCalledOnce();
  });
});
