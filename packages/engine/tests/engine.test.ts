import { describe, expect, it } from 'vitest';
import {
  CF_RESPOSTA,
  Sessao,
  combinar,
  conjuncao,
  disjuncao,
  propagar,
  rotuloDeConfianca,
  type BaseDeConhecimento,
  type Fato,
} from '@drmoo/engine';

const agora = () => '2026-10-21T12:00:00.000Z';

const kbMinima: BaseDeConhecimento = {
  versao: '0.0.1-teste',
  changelog: [],
  variavelObjetivo: 'diagnostico',
  variaveis: [
    { nome: 'sinal_a', rotulo: 'sinal A', tipo: 'boolean' },
    { nome: 'sinal_b', rotulo: 'sinal B', tipo: 'boolean' },
    { nome: 'sinal_caro', rotulo: 'exame caro', tipo: 'boolean' },
    { nome: 'contexto', rotulo: 'contexto', tipo: 'numero' },
  ],
  hipoteses: [
    { id: 'alfa', rotulo: 'Alfa', grupo: 'triagem', descricao: '' },
    { id: 'beta', rotulo: 'Beta', grupo: 'triagem', descricao: '', substitui: ['alfa'] },
    { id: 'urgente', rotulo: 'Urgente', grupo: 'emergencia', descricao: '', bandeiraVermelha: true },
  ],
  perguntas: [
    { var: 'sinal_a', pergunta: 'Sinal A?', tipo: 'boolean', custo: 1 },
    { var: 'sinal_b', pergunta: 'Sinal B?', tipo: 'boolean', custo: 1 },
    { var: 'sinal_caro', pergunta: 'Exame caro?', tipo: 'boolean', custo: 5 },
  ],
  regras: [
    {
      id: 'R-ALFA',
      versao: '1',
      grupo: 'triagem',
      titulo: 'Alfa',
      prioridade: 50,
      se: { var: 'sinal_a', op: '=', val: true },
      entao: [{ var: 'diagnostico', val: 'alfa', cf: 0.95 }],
      porque: 'porque A',
      fonte: 'teste',
      status: 'validada',
    },
    {
      id: 'R-BETA',
      versao: '1',
      grupo: 'triagem',
      titulo: 'Beta',
      prioridade: 60,
      se: {
        todas: [
          { var: 'diagnostico', op: '=', val: 'alfa' },
          { var: 'sinal_b', op: '=', val: true },
        ],
      },
      entao: [{ var: 'diagnostico', val: 'beta', cf: 0.95 }],
      porque: 'porque B em cima de alfa',
      fonte: 'teste',
      status: 'validada',
    },
    {
      id: 'R-URGENTE',
      versao: '1',
      grupo: 'emergencia',
      titulo: 'Urgente',
      prioridade: 99,
      se: { var: 'sinal_caro', op: '=', val: true },
      entao: [{ var: 'diagnostico', val: 'urgente', cf: 0.9 }],
      porque: 'emergência',
      fonte: 'teste',
      status: 'validada',
    },
  ],
};

function fato(variavel: string, valor: Fato['valor'], cf = 1): Fato {
  return { variavel, valor, cf, origem: 'banco', timestamp: agora() };
}

describe('álgebra de fatores de certeza', () => {
  it('combina evidências positivas sem ultrapassar 1', () => {
    expect(combinar(0.8, 0.5)).toBeCloseTo(0.9, 5);
    expect(combinar(0.95, 0.95)).toBeLessThanOrEqual(1);
  });

  it('combina evidências negativas', () => {
    expect(combinar(-0.6, -0.5)).toBeCloseTo(-0.8, 5);
  });

  it('resolve sinais opostos', () => {
    expect(combinar(0.8, -0.4)).toBeCloseTo((0.8 - 0.4) / (1 - 0.4), 5);
  });

  it('anula evidências exatamente contraditórias', () => {
    expect(combinar(1, -1)).toBe(0);
  });

  it('conjunção usa o elo mais fraco e disjunção o mais forte', () => {
    expect(conjuncao([0.9, 0.3, 0.7])).toBe(0.3);
    expect(disjuncao([0.1, 0.6, 0.2])).toBe(0.6);
  });

  it('propaga CF da regra pela força da premissa', () => {
    expect(propagar(0.9, 0.5)).toBeCloseTo(0.45, 5);
  });

  it('traduz CF em linguagem do produtor', () => {
    expect(rotuloDeConfianca(0.9)).toBe('Muito provável');
    expect(rotuloDeConfianca(0.7)).toBe('Provável');
    expect(rotuloDeConfianca(0.4)).toBe('Possível');
    expect(rotuloDeConfianca(0.25)).toBe('Pouco provável');
    expect(rotuloDeConfianca(0.1)).toBe('Descartado');
  });
});

describe('encadeamento progressivo', () => {
  it('encadeia regras: alfa habilita beta', () => {
    const s = new Sessao(kbMinima, [fato('sinal_a', true), fato('sinal_b', true)], { agora });
    const ids = s.traco.map((p) => p.regraId);
    expect(ids).toEqual(['R-ALFA', 'R-BETA']);
  });

  it('aplica subsunção: beta remove alfa do ranking mas o traço preserva a cadeia', () => {
    const s = new Sessao(kbMinima, [fato('sinal_a', true), fato('sinal_b', true)], { agora });
    const hip = s.hipoteses();
    expect(hip.map((h) => h.id)).toEqual(['beta']);
    expect(s.traco.some((p) => p.regraId === 'R-ALFA')).toBe(true);
  });

  it('não dispara a mesma regra duas vezes com os mesmos fatos (refração)', () => {
    const s = new Sessao(kbMinima, [fato('sinal_a', true)], { agora });
    expect(s.traco.filter((p) => p.regraId === 'R-ALFA')).toHaveLength(1);
  });

  it('desconhecido não é falso: sem o fato, a regra não dispara nem é descartada', () => {
    const s = new Sessao(kbMinima, [], { agora });
    expect(s.traco).toHaveLength(0);
    expect(s.proximo().tipo).toBe('pergunta');
  });

  it('resposta negativa derruba a regra', () => {
    const s = new Sessao(kbMinima, [], { agora });
    s.responder({ variavel: 'sinal_a', valor: false, cf: CF_RESPOSTA.sim });
    expect(s.hipoteses()).toHaveLength(0);
  });
});

describe('seleção de perguntas (encadeamento regressivo)', () => {
  it('prefere a pergunta barata à cara quando o ganho é parecido', () => {
    const s = new Sessao(kbMinima, [], { agora });
    const passo = s.proximo();
    expect(passo.tipo).toBe('pergunta');
    expect(passo.pergunta?.custo).toBe(1);
  });

  it('nunca pergunta o que já veio do banco', () => {
    const s = new Sessao(kbMinima, [fato('sinal_a', true)], { agora });
    const perguntas: string[] = [];
    for (let i = 0; i < 5; i++) {
      const p = s.proximo();
      if (p.tipo !== 'pergunta' || !p.pergunta) break;
      perguntas.push(p.pergunta.var);
      s.responder({ variavel: p.pergunta.var, valor: false, cf: CF_RESPOSTA.sim });
    }
    expect(perguntas).not.toContain('sinal_a');
  });

  it('explica por que está perguntando', () => {
    const s = new Sessao(kbMinima, [], { agora });
    const passo = s.proximo();
    expect(passo.justificativa?.texto).toContain('Alfa');
    expect(passo.justificativa?.regrasPendentes.length).toBeGreaterThan(0);
  });
});

describe('parada e bandeira vermelha', () => {
  it('interrompe o questionário quando uma bandeira vermelha é confirmada', () => {
    const s = new Sessao(kbMinima, [fato('sinal_caro', true)], { agora });
    const passo = s.proximo();
    expect(passo.tipo).toBe('parecer');
    expect(passo.parecer?.motivoParada).toBe('bandeira_vermelha');
    expect(passo.parecer?.bandeiraVermelha?.id).toBe('urgente');
  });

  it('encerra por confiança suficiente', () => {
    const s = new Sessao(kbMinima, [fato('sinal_a', true), fato('sinal_b', true)], { agora });
    expect(s.proximo().parecer?.motivoParada).toBe('confianca_suficiente');
  });

  it('respeita o teto de perguntas', () => {
    const s = new Sessao(kbMinima, [], { agora, maxPerguntas: 1 });
    s.responder({ variavel: 'sinal_a', valor: false, cf: 1 });
    expect(s.proximo().parecer?.motivoParada).toBe('limite_de_perguntas');
  });
});

describe('retração e reprodutibilidade', () => {
  it('voltar desfaz a última resposta e recalcula a cadeia', () => {
    const s = new Sessao(kbMinima, [fato('sinal_a', true)], { agora });
    s.responder({ variavel: 'sinal_b', valor: true, cf: 1 });
    expect(s.hipoteses()[0]?.id).toBe('beta');
    s.voltar();
    expect(s.hipoteses()[0]?.id).toBe('alfa');
  });

  it('restaurar uma sessão reproduz exatamente o mesmo parecer', () => {
    const s = new Sessao(kbMinima, [fato('sinal_a', true)], { agora });
    s.responder({ variavel: 'sinal_b', valor: true, cf: 1 });
    const original = s.proximo().parecer!;

    const restaurada = Sessao.restaurar(kbMinima, s.serializar(), { agora });
    const reproduzido = restaurada.proximo().parecer!;

    expect(JSON.stringify(reproduzido)).toBe(JSON.stringify(original));
  });
});
