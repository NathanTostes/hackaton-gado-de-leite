import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  definirBackend,
  diagnosticarRebanho,
  listarEventos,
  registrarCasoMastite,
  registrarEntradaAnimal,
  type BackendSQLite,
} from '@drmoo/db';

function backend(db: DatabaseSync): BackendSQLite {
  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, params) {
      db.prepare(sql).run(...params);
    },
    async getAllAsync<T>(sql: string, params: (string | number | null)[]) {
      return db.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, params: (string | number | null)[]) {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async withTransactionAsync(fn) {
      db.exec('BEGIN');
      try {
        await fn();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

describe('diagnóstico do rebanho (grupo "rebanho" da base, ligado ao calendário)', () => {
  beforeEach(() => definirBackend(backend(new DatabaseSync(':memory:'))));

  it('mastite clínica acima de 2% no mês gera uma medida de rebanho, sem vaca específica', async () => {
    const vacaId = await registrarEntradaAnimal(
      { brinco: 'REB-1', sexo: 'F', categoria: 'vaca_lactacao', origem: 'nascimento', data_nascimento: '2020-01-01' },
      'novo',
    );
    // 1 vaca em lactação, 1 dia de mastite clínica num mês de ~30 dias:
    // (1 quarto × 1 dia) ÷ 30 ÷ 1 vaca × 100 ≈ 3,3% — acima da meta de 2%.
    await registrarCasoMastite({
      animalId: vacaId,
      quartos: 1,
      tipo: 'clinica',
      grau: 1,
      dataInicio: '2026-10-20',
      atendimentoId: null,
    });

    const hipoteses = await diagnosticarRebanho('2026-10-22');
    expect(hipoteses.map((h) => h.id)).toContain('rebanho_mastite_clinica_alta');

    const eventos = await listarEventos('2026-10-01', '2026-10-31');
    const medida = eventos.find((e) => e.referencia_id === 'rebanho_mastite_clinica_alta');
    expect(medida).toBeTruthy();
    expect(medida!.animal_id).toBeNull();
    expect(medida!.tipo).toBe('manejo');
    expect(medida!.origem).toBe('automatico');
  });

  it('não duplica a mesma medida de rebanho se o problema persistir dentro do intervalo', async () => {
    const vacaId = await registrarEntradaAnimal(
      { brinco: 'REB-2', sexo: 'F', categoria: 'vaca_lactacao', origem: 'nascimento', data_nascimento: '2020-01-01' },
      'novo',
    );
    await registrarCasoMastite({
      animalId: vacaId, quartos: 1, tipo: 'clinica', grau: 1, dataInicio: '2026-10-05', atendimentoId: null,
    });

    await diagnosticarRebanho('2026-10-06');
    await diagnosticarRebanho('2026-10-10');

    const eventos = await listarEventos('2026-10-01', '2026-11-30');
    const medidas = eventos.filter((e) => e.referencia_id === 'rebanho_mastite_clinica_alta');
    expect(medidas).toHaveLength(1);
  });

  it('não gera nenhuma medida quando os indicadores estão dentro da meta', async () => {
    await registrarEntradaAnimal(
      { brinco: 'REB-3', sexo: 'F', categoria: 'vaca_lactacao', origem: 'nascimento', data_nascimento: '2020-01-01' },
      'novo',
    );

    const hipoteses = await diagnosticarRebanho('2026-10-22');
    expect(hipoteses).toHaveLength(0);
  });
});
