/**
 * O app abre com o banco vazio (os dados entram pela planilha). As consultas do
 * painel precisam responder sem explodir e sem devolver NaN/Infinity — senão a
 * primeira tela que o usuário vê fica cheia de lixo.
 */
import { DatabaseSync } from 'node:sqlite';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  composicaoRebanho,
  definirBackend,
  eventosPendentes,
  listarRebanho,
  obterPropriedade,
  painelMastite,
  panoramaPorVaca,
  resumoMensal,
  serieProducaoDiaria,
  vacasEmCarencia,
  type BackendSQLite,
} from '@drmoo/db';

function backendNode(): BackendSQLite {
  const db = new DatabaseSync(':memory:');
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

/** Todo número que chegar na tela tem de ser finito. */
function numerosFinitos(valor: unknown, caminho = 'raiz'): void {
  if (typeof valor === 'number') {
    expect(Number.isFinite(valor), `${caminho} = ${valor}`).toBe(true);
    return;
  }
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => numerosFinitos(v, `${caminho}[${i}]`));
    return;
  }
  if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) numerosFinitos(v, `${caminho}.${k}`);
  }
}

describe('banco vazio', () => {
  beforeAll(() => {
    definirBackend(backendNode());
  });

  it('não tem propriedade nem rebanho antes da importação', async () => {
    expect(await obterPropriedade()).toBeNull();
    expect(await listarRebanho()).toEqual([]);
    expect(await panoramaPorVaca()).toEqual([]);
    expect(await serieProducaoDiaria(30)).toEqual([]);
    expect(await vacasEmCarencia()).toEqual([]);
    expect(await eventosPendentes(6)).toEqual([]);
  });

  it('responde aos painéis com indicadores finitos', async () => {
    const agora = new Date();
    const resumo = await resumoMensal(agora.getFullYear(), agora.getMonth() + 1);
    numerosFinitos(resumo, 'resumo');
    numerosFinitos(await painelMastite(agora.getFullYear(), agora.getMonth() + 1), 'mastite');
    numerosFinitos(await composicaoRebanho(), 'rebanho');
  });
});
