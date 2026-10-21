import { describe, expect, it } from 'vitest';
import { baseCompilada, baseDeConhecimento, casos, executarCaso } from '@drmoo/knowledge';

describe('base de conhecimento', () => {
  it('carrega e valida sem erros', () => {
    expect(baseDeConhecimento.regras.length).toBeGreaterThan(30);
    expect(baseDeConhecimento.versao).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('toda regra cita fonte e explicação', () => {
    for (const r of baseDeConhecimento.regras) {
      expect(r.fonte, `regra ${r.id}`).toBeTruthy();
      expect(r.porque, `regra ${r.id}`).toBeTruthy();
    }
  });

  it('o grupo de mastite é integralmente validado contra a cartilha da Embrapa', () => {
    const mastite = baseDeConhecimento.regras.filter((r) => r.id.startsWith('MAST-'));
    expect(mastite.length).toBeGreaterThanOrEqual(12);
    for (const r of mastite) {
      expect(r.status, `regra ${r.id} deveria estar validada`).toBe('validada');
      expect(r.fonte).toMatch(/EMBRAPA/i);
    }
  });

  it('cobre no mínimo os 20 casos exigidos pela especificação', () => {
    expect(casos.length).toBeGreaterThanOrEqual(20);
  });
});

describe('casos de teste com resultado esperado', () => {
  for (const caso of casos) {
    it(`${caso.id} — ${caso.descricao}`, () => {
      const r = executarCaso(baseCompilada, caso);
      expect(r.falhas.join(' | '), JSON.stringify(r.obtido, null, 2)).toBe('');
      expect(r.passou).toBe(true);
    });
  }
});
