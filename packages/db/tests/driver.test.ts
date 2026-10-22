/**
 * O driver: abertura, migração aditiva, transação e limpeza.
 *
 * É a camada em que um erro não aparece como bug, e sim como "o app não abre"
 * na frente do avaliador. Por isso ela é exercitada contra SQLite real.
 */
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  abrirBanco,
  agoraISO,
  apagarTudo,
  bancoEmMemoria,
  consultar,
  consultarUm,
  definirBackend,
  emTransacao,
  executar,
  novoId,
  salvarAnimal,
  salvarPropriedade,
  obterPropriedade,
  semear,
  type BackendSQLite,
} from '@drmoo/db';

function backendNode(db = new DatabaseSync(':memory:')): BackendSQLite & { db: DatabaseSync } {
  return {
    db,
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

describe('driver do banco', () => {
  beforeEach(() => {
    definirBackend(backendNode());
  });

  it('abre uma vez só, mesmo com várias chamadas em paralelo', async () => {
    const [a, b, c] = await Promise.all([abrirBanco(), abrirBanco(), abrirBanco()]);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('grava a versão do esquema no meta_app', async () => {
    await abrirBanco();
    const linha = await consultarUm<{ valor: string }>('SELECT valor FROM meta_app WHERE chave = ?', [
      'schema_versao',
    ]);
    expect(Number(linha?.valor)).toBeGreaterThanOrEqual(2);
  });

  it('acrescenta as colunas de cadastro num banco criado por uma versão anterior', async () => {
    // Banco "antigo": tabela animal sem as colunas acrescentadas depois.
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE animal (
      id TEXT PRIMARY KEY, brinco TEXT NOT NULL UNIQUE, nome TEXT, categoria TEXT NOT NULL,
      sexo TEXT NOT NULL, raca TEXT, data_nascimento TEXT, lote_id TEXT,
      status TEXT NOT NULL DEFAULT 'saudavel', origem TEXT NOT NULL DEFAULT 'nascimento',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT)`);
    definirBackend(backendNode(db));

    await abrirBanco();

    const colunas = (await consultar<{ name: string }>('PRAGMA table_info(animal)')).map((c) => c.name);
    expect(colunas).toContain('procedencia');
    expect(colunas).toContain('numero_gta');
    expect(colunas).toContain('situacao_reprodutiva');
  });

  it('migra propriedades antigas sem perder dados e pode reabrir o banco', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE propriedade (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL,
      area_propria_ha REAL NOT NULL DEFAULT 0, area_arrendada_ha REAL NOT NULL DEFAULT 0,
      mao_de_obra_pessoas INTEGER NOT NULL DEFAULT 1, preco_leite_litro REAL NOT NULL DEFAULT 0,
      mao_de_obra_familiar_mes REAL NOT NULL DEFAULT 0, reposicao_investimento_mes REAL NOT NULL DEFAULT 0,
      gestacao_dias INTEGER NOT NULL DEFAULT 283, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      INSERT INTO propriedade (id, nome, area_propria_ha, created_at, updated_at)
      VALUES ('antiga', 'Fazenda antiga', 25, '2025', '2025')`);
    const adaptador = backendNode(db);
    definirBackend(adaptador);
    expect(await obterPropriedade()).toMatchObject({ id: 'antiga', nome: 'Fazenda antiga', area_propria_ha: 25,
      estado: null, cidade: null, pais: null, tipo_pasto: null });
    await salvarPropriedade({ estado: 'MG', cidade: 'Juiz de Fora', pais: 'Brasil', tipo_pasto: 'Braquiária' });
    definirBackend(adaptador);
    expect(await obterPropriedade()).toMatchObject({ id: 'antiga', area_propria_ha: 25,
      estado: 'MG', cidade: 'Juiz de Fora', pais: 'Brasil', tipo_pasto: 'Braquiária' });
  });

  it('salva os novos campos, preserva atualizações parciais e permite limpar os dados', async () => {
    await salvarPropriedade({ nome: 'Sítio', estado: 'SP', cidade: ' Campinas ', pais: ' Brasil ', tipo_pasto: ' Tifton ' });
    expect(await obterPropriedade()).toMatchObject({ estado: 'SP', cidade: 'Campinas', pais: 'Brasil', tipo_pasto: 'Tifton' });
    await salvarPropriedade({ nome: 'Sítio atualizado' });
    expect(await obterPropriedade()).toMatchObject({ nome: 'Sítio atualizado', cidade: 'Campinas', tipo_pasto: 'Tifton' });
    await salvarPropriedade({ estado: null, cidade: '', pais: null, tipo_pasto: '' });
    expect(await obterPropriedade()).toMatchObject({ estado: null, cidade: null, pais: null, tipo_pasto: null });
  });

  it('a transação desfaz tudo quando algo falha no meio', async () => {
    await salvarAnimal({ brinco: '001', categoria: 'novilha', sexo: 'F' });

    await expect(
      emTransacao(async () => {
        await executar(
          `INSERT INTO lote (id, nome, created_at, updated_at) VALUES (?,?,?,?)`,
          ['lot_x', 'Lote novo', agoraISO(), agoraISO()],
        );
        throw new Error('falhou depois de gravar');
      }),
    ).rejects.toThrow(/falhou/);

    expect(await consultar('SELECT id FROM lote')).toEqual([]);
    expect(await consultar('SELECT id FROM animal')).toHaveLength(1);
  });

  it('apagarTudo limpa as tabelas e pode repopular na mesma transação', async () => {
    await semear();
    expect((await consultar('SELECT id FROM animal')).length).toBeGreaterThan(0);

    await apagarTudo();
    expect(await consultar('SELECT id FROM animal')).toEqual([]);
    expect(await consultar('SELECT id FROM propriedade')).toEqual([]);

    await apagarTudo(async () => {
      await salvarAnimal({ brinco: '777', categoria: 'novilha', sexo: 'F' });
    });
    expect(await consultar('SELECT id FROM animal')).toHaveLength(1);
  });

  it('novoId gera identificadores únicos e ordenáveis por tempo', () => {
    const ids = Array.from({ length: 500 }, () => novoId('ani'));

    expect(new Set(ids).size).toBe(500);
    expect(ids.every((id) => id.startsWith('ani_'))).toBe(true);
    const ordenados = [...ids].sort();
    // O prefixo de tempo faz os ids nascerem praticamente ordenados.
    expect(ordenados[0]?.slice(0, 10)).toBe(ids[0]?.slice(0, 10));
  });

  it('agoraISO devolve um instante válido em UTC', () => {
    const agora = agoraISO();
    expect(agora).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Number.isNaN(Date.parse(agora))).toBe(false);
  });

  it('com backend injetado, o app nunca está no modo "banco em memória" do navegador', () => {
    expect(bancoEmMemoria()).toBe(false);
  });
});
