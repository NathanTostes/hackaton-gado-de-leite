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
let emMemoria = false;

/** Substitui o backend (usado nos testes). `null` volta ao expo-sqlite. */
export function definirBackend(b: BackendSQLite | null): void {
  backendInjetado = b;
  conexao = null;
  abrindo = null;
  emMemoria = false;
}

/**
 * Verdadeiro quando esta aba caiu no banco em memória por não conseguir o
 * arquivo persistente (outra aba já o mantém aberto). Só faz sentido na web.
 */
export function bancoEmMemoria(): boolean {
  return emMemoria;
}

/** O banco em memória só existe na web; no aparelho uma falha é falha mesmo. */
function podeCairParaMemoria(): boolean {
  return typeof document !== 'undefined';
}

async function abrirExpoSqlite(nome: string): Promise<BackendSQLite> {
  // Import dinâmico: mantém o pacote utilizável fora do runtime do Expo.
  const SQLite = await import('expo-sqlite');
  const db = await SQLite.openDatabaseAsync(nome);
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

/** Cria o esquema e aplica as migrações de coluna na conexão recebida. */
async function prepararEsquema(db: BackendSQLite): Promise<void> {
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
}

export async function abrirBanco(): Promise<BackendSQLite> {
  if (conexao) return conexao;
  if (abrindo) return abrindo;

  abrindo = (async () => {
    if (backendInjetado) {
      await prepararEsquema(backendInjetado);
      conexao = backendInjetado;
      return backendInjetado;
    }

    try {
      const db = await abrirExpoSqlite(NOME_BANCO);
      await prepararEsquema(db);
      conexao = db;
      return db;
    } catch (e) {
      // No navegador o arquivo fica no OPFS, que só aceita UM acesso de escrita
      // por vez: a segunda aba/janela aberta no mesmo navegador não consegue o
      // arquivo. A falha pode aparecer já no open ou só na primeira consulta
      // ("Invalid VFS state") — por isso a tentativa inteira, esquema incluído,
      // é que decide se esta aba tem o banco de verdade.
      // Em vez de travar a aba, ela trabalha num banco em memória: o app abre e
      // funciona normalmente, só não persiste — e a tela de aviso explica isso.
      if (!podeCairParaMemoria()) throw e;
      const memoria = await abrirExpoSqlite(':memory:');
      await prepararEsquema(memoria);
      emMemoria = true;
      conexao = memoria;
      return memoria;
    }
  })();

  // Uma tentativa que falhou não pode ficar memorizada: sem isso, o botão
  // "tentar de novo" devolveria para sempre o mesmo erro.
  abrindo.catch(() => {
    abrindo = null;
  });

  return abrindo;
}

/**
 * Esquece a conexão atual e tenta abrir de novo.
 *
 * Serve à tela que avisa "já está aberto em outra aba": depois de fechar a
 * outra aba, o usuário pede para tentar de novo e o app segue com o banco de
 * verdade, sem recarregar a página.
 */
export async function reabrirBanco(): Promise<BackendSQLite> {
  conexao = null;
  abrindo = null;
  emMemoria = false;
  return abrirBanco();
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

/**
 * Par chave/valor de `meta_app` — o lugar certo para uma preferência pequena e
 * solitária (um endereço de sincronização, uma versão de esquema, um modo de
 * tela) que não merece coluna própria em nenhuma tabela de domínio.
 */
export async function lerMeta(chave: string): Promise<string | null> {
  const linha = await consultarUm<{ valor: string }>('SELECT valor FROM meta_app WHERE chave = ?', [chave]);
  return linha?.valor ?? null;
}

export async function gravarMeta(chave: string, valor: string): Promise<void> {
  await executar(
    `INSERT INTO meta_app (chave, valor) VALUES (?, ?)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
    [chave, valor],
  );
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
