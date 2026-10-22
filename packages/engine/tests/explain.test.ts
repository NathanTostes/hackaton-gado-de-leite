/**
 * Explicação: "por que essa pergunta?" e "como cheguei nisso?".
 *
 * É o que separa um sistema especialista de um chute com interface bonita — e
 * é o texto que vai para a tela e para o PDF que o veterinário recebe. Se a
 * explicação mentir ou vier vazia, o parecer perde a defesa.
 */
import { describe, expect, it } from 'vitest';
import { Sessao, explicarConclusao, regraEmLinguagemNatural, tracoEmTexto } from '../src/index';
import type { BaseDeConhecimento, Parecer } from '../src/types';

const BASE: BaseDeConhecimento = {
  versao: '1.0.0-teste',
  changelog: [{ versao: '1.0.0-teste', data: '2026-10-22', notas: 'Base mínima usada só neste teste.' }],
  variavelObjetivo: 'diagnostico',
  variaveis: [
    { nome: 'grumos_no_leite', tipo: 'boolean', rotulo: 'Grumos no leite' },
    { nome: 'ubere_inchado', tipo: 'boolean', rotulo: 'Úbere inchado' },
    { nome: 'febre', tipo: 'boolean', rotulo: 'Febre' },
  ],
  hipoteses: [
    { id: 'mastite_g1', rotulo: 'Mastite grau 1', grupo: 'mastite', descricao: 'Só o leite alterado.' },
    { id: 'mastite_g2', rotulo: 'Mastite grau 2', grupo: 'mastite', descricao: 'Leite e úbere alterados.' },
  ],
  perguntas: [
    { var: 'grumos_no_leite', tipo: 'boolean', pergunta: 'Há grumos no leite?', custo: 1 },
    { var: 'ubere_inchado', tipo: 'boolean', pergunta: 'O úbere está inchado?', custo: 1 },
    { var: 'febre', tipo: 'boolean', pergunta: 'A vaca está com febre?', custo: 3 },
  ],
  regras: [
    {
      id: 'R-01',
      versao: '1.0.0',
      titulo: 'Grumos indicam mastite clínica',
      grupo: 'mastite',
      se: { var: 'grumos_no_leite', op: '=', val: true },
      entao: [{ var: 'diagnostico', val: 'mastite_g1', cf: 0.8 }],
      status: 'validada',
      prioridade: 50,
      porque: 'Grumos no leite são o sinal clássico da forma clínica.',
      fonte: 'Embrapa, Mastite, p. 21',
    },
    {
      id: 'R-02',
      versao: '1.0.0',
      titulo: 'Grumos com úbere inchado agravam o quadro',
      grupo: 'mastite',
      se: { todas: [{ var: 'grumos_no_leite', op: '=', val: true }, { var: 'ubere_inchado', op: '=', val: true }] },
      entao: [{ var: 'diagnostico', val: 'mastite_g2', cf: 0.9 }],
      status: 'revisar',
      prioridade: 60,
      porque: 'Leite alterado com úbere inchado é quadro mais grave.',
      fonte: 'consenso veterinário',
    },
  ],
};

function parecerDe(respostas: { variavel: string; valor: boolean }[]): Parecer {
  const sessao = new Sessao(BASE, []);
  for (const r of respostas) sessao.responder({ variavel: r.variavel, valor: r.valor, cf: 1 });
  const passo = sessao.proximo();
  return passo.parecer ?? sessao.encerrar();
}

describe('árvore de explicação', () => {
  it('mostra a regra que concluiu e o fato que a sustentou', () => {
    const parecer = parecerDe([{ variavel: 'grumos_no_leite', valor: true }]);

    const arvore = explicarConclusao(parecer, 'diagnostico=mastite_g1');

    expect(arvore).toHaveLength(1);
    expect(arvore[0]?.tipo).toBe('regra');
    expect(arvore[0]?.titulo).toContain('R-01');
    expect(arvore[0]?.filhos[0]?.titulo).toBe('grumos_no_leite');
    expect(arvore[0]?.filhos[0]?.detalhe).toContain('sim');
  });

  it('carrega a fonte e o status da regra, para o leitor julgar a origem', () => {
    const parecer = parecerDe([
      { variavel: 'grumos_no_leite', valor: true },
      { variavel: 'ubere_inchado', valor: true },
    ]);

    const [validada] = explicarConclusao(parecer, 'diagnostico=mastite_g1');
    const [revisar] = explicarConclusao(parecer, 'diagnostico=mastite_g2');

    expect(validada?.fonte).toContain('Embrapa');
    expect(validada?.status).toBe('validada');
    expect(revisar?.status).toBe('revisar');
  });

  it('conclusão que ninguém sustentou não inventa explicação', () => {
    const parecer = parecerDe([{ variavel: 'grumos_no_leite', valor: false }]);

    expect(explicarConclusao(parecer, 'diagnostico=mastite_g1')).toEqual([]);
    expect(explicarConclusao(parecer, 'diagnostico=inexistente')).toEqual([]);
  });

  it('não entra em laço quando a mesma chave reaparece', () => {
    const parecer = parecerDe([
      { variavel: 'grumos_no_leite', valor: true },
      { variavel: 'ubere_inchado', valor: true },
    ]);
    const visitadas = new Set<string>();

    explicarConclusao(parecer, 'diagnostico=mastite_g2', visitadas);
    const segunda = explicarConclusao(parecer, 'diagnostico=mastite_g2', visitadas);

    expect(segunda).toEqual([]);
  });
});

describe('regra em linguagem natural', () => {
  const rotulos = new Map([
    ['grumos_no_leite', 'Grumos no leite'],
    ['ubere_inchado', 'Úbere inchado'],
    ['diagnostico', 'diagnóstico'],
  ]);

  it('escreve SE/ENTÃO com os rótulos humanos e o CF em português', () => {
    const texto = regraEmLinguagemNatural(
      { var: 'grumos_no_leite', op: '=', val: true },
      [{ var: 'diagnostico', val: 'mastite_g1', cf: 0.8 }],
      rotulos,
    );

    expect(texto).toContain('SE Grumos no leite');
    expect(texto).toContain('ENTÃO diagnóstico = mastite_g1');
    expect(texto).toContain('CF 0,80');
  });

  it('booleano falso vira NÃO, sem "é false"', () => {
    const texto = regraEmLinguagemNatural(
      { var: 'grumos_no_leite', op: '=', val: false },
      [{ var: 'diagnostico', val: 'x', cf: 0.5 }],
      rotulos,
    );

    expect(texto).toContain('SE NÃO Grumos no leite');
    expect(texto).not.toContain('false');
  });

  it('junta condições com E, OU e NÃO legíveis', () => {
    const texto = regraEmLinguagemNatural(
      {
        todas: [
          { var: 'grumos_no_leite', op: '=', val: true },
          { alguma: [{ var: 'ubere_inchado', op: '=', val: true }, { nao: { var: 'febre', op: '=', val: true } }] },
        ],
      },
      [{ var: 'diagnostico', val: 'y', cf: -0.6 }],
      rotulos,
    );

    expect(texto).toContain(' E ');
    expect(texto).toContain(' OU ');
    expect(texto).toContain('NÃO');
  });

  it('traduz os operadores que não são igualdade', () => {
    expect(
      regraEmLinguagemNatural({ var: 'del', op: 'entre', val: [0, 30] }, [{ var: 'd', val: 'x', cf: 0.5 }]),
    ).toContain('está entre');
    expect(
      regraEmLinguagemNatural({ var: 'cmt', op: 'em', val: ['1', '2'] }, [{ var: 'd', val: 'x', cf: 0.5 }]),
    ).toContain('é um de');
    expect(
      regraEmLinguagemNatural({ var: 'febre', op: 'desconhecido' }, [{ var: 'd', val: 'x', cf: 0.5 }]),
    ).toContain('é desconhecido');
  });

  it('sem rótulos, cai no nome da variável em vez de quebrar', () => {
    const texto = regraEmLinguagemNatural({ var: 'febre', op: '=', val: true }, [
      { var: 'diagnostico', val: 'z', cf: 0.7 },
    ]);

    expect(texto).toContain('SE febre');
    expect(texto).toContain('ENTÃO diagnostico = z');
  });
});

describe('traço em texto (vai para o PDF do prontuário)', () => {
  it('lista as regras que dispararam, na ordem', () => {
    const parecer = parecerDe([
      { variavel: 'grumos_no_leite', valor: true },
      { variavel: 'ubere_inchado', valor: true },
    ]);

    const texto = tracoEmTexto(parecer.traco);

    expect(texto).toContain('R-01');
    expect(texto).toContain('R-02');
    // A ordem do texto é a ordem em que as regras dispararam: a mais
    // específica primeiro (resolução de conflito), e o número do passo junto.
    expect(texto).toMatch(/1\. \[R-0\d\]/);
    expect(texto).toContain('Fonte: Embrapa, Mastite, p. 21');
  });

  it('sem regra disparada, devolve texto vazio em vez de lixo', () => {
    expect(tracoEmTexto([])).toBe('');
  });
});
