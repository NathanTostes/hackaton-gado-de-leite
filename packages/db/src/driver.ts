/**
 * Acesso ao SQLite local.
 *
 * O mesmo código atende Android (SQLite nativo) e navegador (SQLite compilado em
 * WebAssembly pelo próprio expo-sqlite). Não há servidor nem rede envolvidos em
 * nenhum dos dois casos — requisito do regulamento (localhost).
 *
 * O backend é injetável (`definirBackend`) por um motivo prático: assim a suíte
 * automatizada roda o esquema e as consultas de verdade, num SQLite de verdade,
 * sem precisar de navegador nem de aparelho.
 */
import { COLUNAS_CADASTRO, DDL, SCHEMA_VERSAO } from './schema';

export type Parametro = string | number | null;

export interface BackendSQLite {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: Parametro[]): Promise<void>;
  getAllAsync<T>(sql: string, params: Parametro[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: Parametro[]): Promise<T | null>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
}

export const NOME_BANCO = 'drmoo.db';

let backendInjetado: BackendSQLite | null = null;
let conexao: BackendSQLite | null = null;
let abrindo: Promise<BackendSQLite> | null = null;

/** Substitui o backend (usado nos testes). `null` volta ao expo-sqlite. */
export function definirBackend(b: BackendSQLite | null): void {
  backendInjetado = b;
  conexao = null;
  abrindo = null;
}

async function abrirExpoSqlite(): Promise<BackendSQLite> {
  // Import dinâmico: mantém o pacote utilizável fora do runtime do Expo.
  const SQLite = await import('expo-sqlite');
  const db = await SQLite.openDatabaseAsync(NOME_BANCO);
  return {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: async (sql, params) => {
      await db.runAsync(sql, params);
    },
    getAllAsync: (sql, params) => db.getAllAsync(sql, params),
    getFirstAsync: async (sql, params) => (await db.getFirstAsync(sql, params)) ?? null,
    withTransactionAsync: (fn) => db.withTransactionAsync(fn),
  };
}

export async function abrirBanco(): Promise<BackendSQLite> {
  if (conexao) return conexao;
  if (abrindo) return abrindo;

  abrindo = (async () => {
    const db = backendInjetado ?? (await abrirExpoSqlite());
    await db.execAsync(DDL);
    // CREATE TABLE IF NOT EXISTS não acrescenta colunas em bancos já instalados.
    await db.withTransactionAsync(async () => {
      const colunas = await db.getAllAsync<{ name: string }>('PRAGMA table_info(animal)', []);
      const existentes = new Set(colunas.map((coluna) => coluna.name));
      for (const [nome, tipo] of Object.entries(COLUNAS_CADASTRO)) {
        if (!existentes.has(nome)) await db.execAsync(`ALTER TABLE animal ADD COLUMN ${nome} ${tipo}`);
      }
    });
    await db.runAsync(
      `INSERT INTO meta_app (chave, valor) VALUES ('schema_versao', ?)
       ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
      [String(SCHEMA_VERSAO)],
    );
    conexao = db;
    return db;
  })();

  return abrindo;
}

export async function consultar<T>(sql: string, params: Parametro[] = []): Promise<T[]> {
  const db = await abrirBanco();
  return db.getAllAsync<T>(sql, params);
}

export async function consultarUm<T>(sql: string, params: Parametro[] = []): Promise<T | null> {
  const db = await abrirBanco();
  return db.getFirstAsync<T>(sql, params);
}

export async function executar(sql: string, params: Parametro[] = []): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync(sql, params);
}

/** Executa várias instruções numa transação — tudo ou nada. */
export async function emTransacao(fn: () => Promise<void>): Promise<void> {
  const db = await abrirBanco();
  await db.withTransactionAsync(fn);
}

const TABELAS_EM_ORDEM_DE_EXCLUSAO = [
  'fato_registrado',
  'exame_cmt',
  'exame_ccs',
  'caso_mastite',
  'tratamento',
  'atendimento',
  'vacinacao',
  'evento_calendario',
  'controle_leiteiro',
  'producao_propriedade',
  'cobertura',
  'morte',
  'despesa',
  'receita',
  'medicamento',
  'vacina',
  'lactacao',
  'animal',
  'lote',
  'propriedade',
];

/** Limpa os dados e, opcionalmente, os repõe na mesma transação. */
export async function apagarTudo(repopular?: () => Promise<void>): Promise<void> {
  const db = await abrirBanco();
  await db.withTransactionAsync(async () => {
    for (const t of TABELAS_EM_ORDEM_DE_EXCLUSAO) await db.runAsync(`DELETE FROM ${t}`, []);
    await repopular?.();
  });
}

let contador = 0;
/** Identificador local ordenável por tempo. Não precisa ser criptográfico. */
export function novoId(prefixo = 'id'): string {
  contador = (contador + 1) % 100000;
  return `${prefixo}_${Date.now().toString(36)}_${contador.toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function agoraISO(): string {
  return new Date().toISOString();
}
