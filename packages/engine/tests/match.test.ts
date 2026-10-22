/**
 * Casamento de condições — o coração frio do motor.
 *
 * Duas regras que este arquivo protege, porque errar nelas muda diagnóstico:
 *  1. **desconhecido não é falso**: sem o fato, a premissa não é julgada (é
 *     isso que faz o motor perguntar em vez de concluir);
 *  2. **fato negativo que "bate" é evidência contra**: responder "não" a uma
 *     premissa afirmativa pesa contra a regra, não a favor.
 */
import { describe, expect, it } from 'vitest';
import { avaliarCondicao, especificidade, variaveisDaCondicao } from '../src/index';
import type { Condicao, Fato, MemoriaDeTrabalho, Valor } from '../src/types';

function memoria(fatos: Record<string, { valor: Valor; cf?: number }>): MemoriaDeTrabalho {
  const mapa = new Map<string, Fato>();
  for (const [variavel, { valor, cf }] of Object.entries(fatos)) {
    mapa.set(variavel, {
      variavel,
      valor,
      cf: cf ?? 1,
      origem: 'pergunta',
      timestamp: '2026-10-22T00:00:00.000Z',
    });
  }
  return mapa;
}

describe('operadores de comparação', () => {
  const m = memoria({
    del: { valor: 45 },
    producao: { valor: '18.5' },
    cmt: { valor: '2' },
    sinais: { valor: ['febre', 'apatia'] },
    observacao: { valor: 'leite com grumos' },
    febre: { valor: true },
  });

  it('igualdade e desigualdade', () => {
    expect(avaliarCondicao({ var: 'cmt', op: '=', val: '2' }, m).cf).toBe(1);
    expect(avaliarCondicao({ var: 'cmt', op: '=', val: '3' }, m).cf).toBe(-1);
    expect(avaliarCondicao({ var: 'cmt', op: '!=', val: '3' }, m).cf).toBe(1);
  });

  it('comparações numéricas, inclusive com número guardado como texto', () => {
    expect(avaliarCondicao({ var: 'del', op: '>', val: 30 }, m).cf).toBe(1);
    expect(avaliarCondicao({ var: 'del', op: '<=', val: 45 }, m).cf).toBe(1);
    expect(avaliarCondicao({ var: 'producao', op: '>=', val: 18 }, m).cf).toBe(1);
  });

  it('comparar o que não é número não vira falso: vira "não sei julgar"', () => {
    const naoNumerico = memoria({ raca: { valor: 'Girolando' } });
    expect(avaliarCondicao({ var: 'raca', op: '>', val: 10 }, naoNumerico).cf).toBeNull();
  });

  it('entre inclui os extremos e exige faixa com dois valores', () => {
    expect(avaliarCondicao({ var: 'del', op: 'entre', val: [45, 60] }, m).cf).toBe(1);
    expect(avaliarCondicao({ var: 'del', op: 'entre', val: [0, 30] }, m).cf).toBe(-1);
    expect(avaliarCondicao({ var: 'del', op: 'entre', val: [10] }, m).cf).toBeNull();
  });

  it('em compara com a lista; contém olha dentro de lista e de texto', () => {
    expect(avaliarCondicao({ var: 'cmt', op: 'em', val: ['1', '2', '3'] }, m).cf).toBe(1);
    expect(avaliarCondicao({ var: 'cmt', op: 'em', val: ['N', 'T'] }, m).cf).toBe(-1);
    expect(avaliarCondicao({ var: 'sinais', op: 'contem', val: 'febre' }, m).cf).toBe(1);
    expect(avaliarCondicao({ var: 'observacao', op: 'contem', val: 'grumos' }, m).cf).toBe(1);
    expect(avaliarCondicao({ var: 'observacao', op: 'contem', val: 'sangue' }, m).cf).toBe(-1);
  });

  it('"desconhecido" é verdadeiro justamente quando o fato não existe', () => {
    expect(avaliarCondicao({ var: 'nunca_perguntado', op: 'desconhecido' }, m).cf).toBe(1);
    expect(avaliarCondicao({ var: 'febre', op: 'desconhecido' }, m).cf).toBe(-1);
  });
});

describe('desconhecido não é falso', () => {
  it('variável ausente deixa a condição sem julgamento e aponta a faltante', () => {
    const resultado = avaliarCondicao({ var: 'febre', op: '=', val: true }, memoria({}));

    expect(resultado.cf).toBeNull();
    expect(resultado.faltantes).toEqual(['febre']);
  });

  it('num E, uma faltante basta para suspender o julgamento', () => {
    const cond: Condicao = {
      todas: [
        { var: 'grumos', op: '=', val: true },
        { var: 'febre', op: '=', val: true },
      ],
    };

    const resultado = avaliarCondicao(cond, memoria({ grumos: { valor: true } }));

    expect(resultado.cf).toBeNull();
    expect(resultado.faltantes).toEqual(['febre']);
  });
});

describe('incerteza do usuário se propaga', () => {
  it('resposta com certeza parcial entrega CF parcial', () => {
    const resultado = avaliarCondicao({ var: 'febre', op: '=', val: true }, memoria({ febre: { valor: true, cf: 0.6 } }));
    expect(resultado.cf).toBeCloseTo(0.6);
  });

  it('fato negativo que casa na comparação pesa CONTRA a premissa', () => {
    const resultado = avaliarCondicao(
      { var: 'febre', op: '=', val: true },
      memoria({ febre: { valor: true, cf: -0.8 } }),
    );
    expect(resultado.cf).toBeCloseTo(-0.8);
  });

  it('E fica com a menor certeza; OU fica com a maior', () => {
    const m = memoria({ a: { valor: true, cf: 0.9 }, b: { valor: true, cf: 0.4 } });

    const e = avaliarCondicao({ todas: [{ var: 'a', op: '=', val: true }, { var: 'b', op: '=', val: true }] }, m);
    const ou = avaliarCondicao({ alguma: [{ var: 'a', op: '=', val: true }, { var: 'b', op: '=', val: true }] }, m);

    expect(e.cf).toBeCloseTo(0.4);
    expect(ou.cf).toBeCloseTo(0.9);
  });

  it('NÃO inverte o sinal da certeza', () => {
    const m = memoria({ a: { valor: true, cf: 0.7 } });
    expect(avaliarCondicao({ nao: { var: 'a', op: '=', val: true } }, m).cf).toBeCloseTo(-0.7);
  });
});

describe('utilidades da condição', () => {
  it('lista as variáveis de que a regra depende, sem repetir', () => {
    const cond: Condicao = {
      todas: [
        { var: 'a', op: '=', val: true },
        { alguma: [{ var: 'b', op: '=', val: true }, { nao: { var: 'a', op: '=', val: false } }] },
      ],
    };

    expect([...variaveisDaCondicao(cond)].sort()).toEqual(['a', 'b']);
  });

  it('especificidade conta as premissas — é o desempate entre regras', () => {
    expect(especificidade({ var: 'a', op: '=', val: true })).toBe(1);
    expect(
      especificidade({ todas: [{ var: 'a', op: '=', val: true }, { var: 'b', op: '=', val: true }] }),
    ).toBe(2);
    expect(especificidade({ nao: { var: 'a', op: '=', val: true } })).toBe(1);
  });
});
