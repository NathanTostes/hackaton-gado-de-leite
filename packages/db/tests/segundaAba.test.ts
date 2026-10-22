/**
 * A segunda aba do navegador.
 *
 * O arquivo do banco vive no OPFS, que só deixa uma aba escrever por vez. A
 * recusa não vem sempre no mesmo ponto: às vezes o `openDatabaseAsync` já
 * falha, às vezes ele devolve a conexão e o erro ("Invalid VFS state") só
 * estoura na primeira instrução. Nos dois casos a aba precisa cair no banco em
 * memória e avisar o usuário — nunca morrer numa tela de erro técnico.
 */
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Parametro } from '../src/driver';

/** Conexão fake: delega num SQLite real, mas pode recusar as instruções. */
function conexaoFake(recusar: 'nunca' | 'na-primeira-instrucao') {
  const db = new DatabaseSync(':memory:');
  let recusou = false;
  const barrar = () => {
    if (recusar === 'na-primeira-instrucao' && !recusou) {
      recusou = true;
      throw new Error('Invalid VFS state');
    }
  };
  return {
    execAsync: async (sql: string) => {
      barrar();
      db.exec(sql);
    },
    runAsync: async (sql: string, params: Parametro[]) => {
      barrar();
      db.prepare(sql).run(...params);
    },
    getAllAsync: async (sql: string, params: Parametro[]) => {
      barrar();
      return db.prepare(sql).all(...params);
    },
    getFirstAsync: async (sql: string, params: Parametro[]) => {
      barrar();
      return db.prepare(sql).get(...params) ?? null;
    },
    withTransactionAsync: async (fn: () => Promise<void>) => {
      barrar();
      await fn();
    },
  };
}

const abertos: string[] = [];
let falhaDaPrimeiraAbertura: 'nenhuma' | 'no-open' | 'na-primeira-instrucao' = 'nenhuma';

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: async (nome: string) => {
    abertos.push(nome);
    if (nome === ':memory:') return conexaoFake('nunca');
    if (falhaDaPrimeiraAbertura === 'no-open') throw new Error('Access Handles cannot be created');
    return conexaoFake(
      falhaDaPrimeiraAbertura === 'na-primeira-instrucao' ? 'na-primeira-instrucao' : 'nunca',
    );
  },
}));

describe('aba sem acesso ao arquivo do banco', () => {
  beforeEach(async () => {
    abertos.length = 0;
    // O fallback só existe no navegador; é `document` que o driver usa para
    // saber onde está rodando.
    (globalThis as { document?: unknown }).document = {};
    const { definirBackend } = await import('../src/driver');
    definirBackend(null);
  });

  afterEach(async () => {
    delete (globalThis as { document?: unknown }).document;
    const { definirBackend } = await import('../src/driver');
    definirBackend(null);
  });

  it('cai para o banco em memória quando o próprio open é recusado', async () => {
    falhaDaPrimeiraAbertura = 'no-open';
    const { abrirBanco, bancoEmMemoria } = await import('../src/driver');

    await abrirBanco();

    expect(abertos).toEqual(['drmoo.db', ':memory:']);
    expect(bancoEmMemoria()).toBe(true);
  });

  it('cai para o banco em memória quando o erro só aparece na primeira instrução', async () => {
    falhaDaPrimeiraAbertura = 'na-primeira-instrucao';
    const { abrirBanco, bancoEmMemoria, consultar } = await import('../src/driver');

    await abrirBanco();

    expect(abertos).toEqual(['drmoo.db', ':memory:']);
    expect(bancoEmMemoria()).toBe(true);
    // E o banco de reserva serve consultas de verdade: o app abre vazio, não quebra.
    expect(await consultar('SELECT COUNT(*) AS n FROM animal')).toEqual([{ n: 0 }]);
  });

  it('quando o arquivo está livre, a aba fica com o banco persistente', async () => {
    falhaDaPrimeiraAbertura = 'nenhuma';
    const { abrirBanco, bancoEmMemoria } = await import('../src/driver');

    await abrirBanco();

    expect(abertos).toEqual(['drmoo.db']);
    expect(bancoEmMemoria()).toBe(false);
  });
});
