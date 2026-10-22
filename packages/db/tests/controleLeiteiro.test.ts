import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  controleLeiteiroDoAnimal,
  definirBackend,
  registrarControleLeiteiro,
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

describe('registro de produção de leite por vaca', () => {
  beforeEach(() => definirBackend(backend(new DatabaseSync(':memory:'))));

  it('soma manhã e tarde no total e aparece no histórico do animal', async () => {
    const id = await registrarEntradaAnimal(
      { brinco: 'LEITE-1', sexo: 'F', categoria: 'vaca_lactacao', origem: 'nascimento' },
      'novo',
    );

    await registrarControleLeiteiro(id, '2026-10-20', 9, 7.5);

    const historico = await controleLeiteiroDoAnimal(id);
    expect(historico).toEqual([
      { data: '2026-10-20', litros_total: 16.5, observacoes: null },
    ]);
  });

  it('relançar no mesmo dia corrige o lançamento em vez de duplicar', async () => {
    const id = await registrarEntradaAnimal(
      { brinco: 'LEITE-2', sexo: 'F', categoria: 'vaca_lactacao', origem: 'nascimento' },
      'novo',
    );

    await registrarControleLeiteiro(id, '2026-10-20', 9, 7);
    await registrarControleLeiteiro(id, '2026-10-20', 10, 8, 'pesagem corrigida');

    const historico = await controleLeiteiroDoAnimal(id);
    expect(historico).toEqual([
      { data: '2026-10-20', litros_total: 18, observacoes: 'pesagem corrigida' },
    ]);
  });

  it('mantém um lançamento por dia distinto', async () => {
    const id = await registrarEntradaAnimal(
      { brinco: 'LEITE-3', sexo: 'F', categoria: 'vaca_lactacao', origem: 'nascimento' },
      'novo',
    );

    await registrarControleLeiteiro(id, '2026-10-19', 8, 6);
    await registrarControleLeiteiro(id, '2026-10-20', 9, 7);

    const historico = await controleLeiteiroDoAnimal(id);
    expect(historico.map((h) => h.data)).toEqual(['2026-10-20', '2026-10-19']);
  });
});
