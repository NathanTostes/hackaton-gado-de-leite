import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { hoje, somarDias } from '@drmoo/domain';
import {
  abrirBanco, consultar, criarEvento, definirBackend, emTransacao, executar,
  fatosDoAnimal, listarRebanho, obterAnimal, registrarEntradaAnimal, salvarAnimal, type BackendSQLite,
} from '@drmoo/db';

function backend(db: DatabaseSync): BackendSQLite {
  return {
    async execAsync(sql) { db.exec(sql); },
    async runAsync(sql, params) { db.prepare(sql).run(...params); },
    async getAllAsync<T>(sql: string, params: (string | number | null)[]) {
      return db.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, params: (string | number | null)[]) {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async withTransactionAsync(fn) {
      db.exec('BEGIN');
      try { await fn(); db.exec('COMMIT'); }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

describe('cadastro ampliado de animais', () => {
  beforeEach(() => definirBackend(backend(new DatabaseSync(':memory:'))));

  it('migra um banco v1 sem perder registros e pode ser reaberto', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE animal (
      id TEXT PRIMARY KEY, brinco TEXT NOT NULL UNIQUE, nome TEXT, tatuagem TEXT,
      categoria TEXT NOT NULL, sexo TEXT NOT NULL, raca TEXT, data_nascimento TEXT,
      peso_nascimento REAL, pelagem_sinal TEXT, pai_id TEXT, mae_id TEXT, pai_nome TEXT,
      lote_id TEXT, status TEXT NOT NULL, origem TEXT NOT NULL, data_entrada TEXT,
      data_saida TEXT, motivo_saida TEXT, observacoes TEXT, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, deleted_at TEXT
    );
    CREATE TABLE meta_app (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
    INSERT INTO meta_app VALUES ('schema_versao', '1');
    INSERT INTO animal (id,brinco,categoria,sexo,status,origem,created_at,updated_at)
      VALUES ('legado','100','novilha','F','saudavel','compra','2020','2020');`);
    const adaptador = backend(db);
    definirBackend(adaptador);
    const legado = await obterAnimal('legado');
    expect(legado?.brinco).toBe('100');
    expect(legado?.numero_gta).toBeNull();
    await salvarAnimal({ id: 'legado', brinco: '100', numero_gta: 'GTA-1' });
    definirBackend(adaptador);
    expect((await obterAnimal('legado'))?.numero_gta).toBe('GTA-1');
    expect(db.prepare("SELECT valor FROM meta_app WHERE chave='schema_versao'").get()?.valor).toBe('3');
  });

  it('salva e relê todos os dados da entrada, filiação e reprodução', async () => {
    const dados = {
      brinco: '238', nome: 'Estrela', sexo: 'F' as const, categoria: 'vaca_lactacao' as const,
      origem: 'transferencia' as const, data_entrada: hoje(), data_nascimento: '2020-01-12',
      raca: 'Girolando', pelagem_sinal: 'Preta e branca', mae_nome: 'Matriz 27', pai_nome: 'Touro 10',
      peso_nascimento: 35.5, peso_entrada: 480.5, procedencia: 'Fazenda Sol', valor_aquisicao: 0,
      numero_gta: '001/2026', historico_sanitario: 'Exames informados pelo vendedor',
      situacao_reprodutiva: 'prenhe', ultimo_parto_entrada: somarDias(hoje(), -20),
      numero_lactacoes_entrada: 3, observacoes: 'Animal transferido',
    };
    const id = await salvarAnimal(dados);
    const animal = await obterAnimal(id);
    expect(animal).toMatchObject(dados);
    expect(animal?.del).toBe(20);
    expect(animal?.numero_lactacao).toBe(3);
    expect((await listarRebanho({ busca: 'Girolando' }))[0]?.id).toBe(id);
    expect((await listarRebanho({ busca: 'branca' }))[0]?.id).toBe(id);
    const fatos = await fatosDoAnimal(id);
    expect(fatos.find((f) => f.variavel === 'del')?.valor).toBe(20);
    expect(fatos.find((f) => f.variavel === 'numero_lactacao')?.valor).toBe(3);
  });

  it('preserva campos não editados e permite limpar campos opcionais', async () => {
    const maeId = await salvarAnimal({ brinco: 'MAE' });
    const paiId = await salvarAnimal({ brinco: 'PAI', sexo: 'M', categoria: 'touro' });
    const id = await salvarAnimal({ brinco: 'FILHA', mae_id: maeId, pai_id: paiId, numero_gta: '123',
      pelagem_sinal: 'Malhada', origem: 'compra', status: 'em_tratamento' });
    await salvarAnimal({ id, brinco: 'FILHA-2', numero_gta: null });
    expect(await obterAnimal(id)).toMatchObject({
      brinco: 'FILHA-2', mae_id: maeId, pai_id: paiId, numero_gta: null,
      pelagem_sinal: 'Malhada', origem: 'compra', status: 'em_tratamento',
      mae_identificacao: 'MAE', pai_identificacao: 'PAI',
    });
  });

  it('não transforma idade estimada em idade exata na anamnese', async () => {
    const id = await salvarAnimal({ brinco: 'EST', categoria: 'bezerro_mamando',
      idade_estimada_meses: 2, idade_estimada_em: hoje() });
    expect(await obterAnimal(id)).toMatchObject({ idade_estimada_meses: 2, data_nascimento: null });
    expect((await fatosDoAnimal(id)).some((f) => f.variavel === 'idade_dias')).toBe(false);
  });

  it('registra nascimento com eventos relativos à data informada, sem duplicar na edição', async () => {
    const nascimento = somarDias(hoje(), -5);
    const id = await registrarEntradaAnimal({
      brinco: 'NASC', categoria: 'bezerro_mamando', sexo: 'M', origem: 'nascimento',
      data_nascimento: nascimento, data_entrada: nascimento, peso_nascimento: 32.5,
      raca: 'Holandês', mae_nome: 'Matriz 1', pai_nome: 'Touro 2', pelagem_sinal: 'Malhado',
    }, 'nascimento');
    await registrarEntradaAnimal({ id, brinco: 'NASC', pelagem_sinal: 'Preto e branco' }, 'novo');
    expect(await obterAnimal(id)).toMatchObject({ peso_nascimento: 32.5, mae_nome: 'Matriz 1', pelagem_sinal: 'Preto e branco' });
    expect(await consultar('SELECT tipo,data FROM evento_calendario WHERE animal_id=? ORDER BY tipo', [id])).toEqual([
      { tipo: 'consulta', data: nascimento }, { tipo: 'desmame', data: somarDias(nascimento, 60) },
    ]);
  });

  it.each([
    ['M', 'touro', ['quarentena']],
    ['F', 'novilha', ['quarentena']],
    ['F', 'vaca_lactacao', ['exame_cmt', 'quarentena']],
  ] as const)('agenda cuidados de entrada conforme sexo %s e categoria %s', async (sexo, categoria, esperados) => {
    const entrada = somarDias(hoje(), -2);
    const id = await registrarEntradaAnimal({ brinco: 'ENTRADA', sexo, categoria, origem: 'compra', data_entrada: entrada }, 'novo');
    const eventos = await consultar<{ tipo: string; data: string }>('SELECT tipo,data FROM evento_calendario WHERE animal_id=? ORDER BY tipo', [id]);
    expect(eventos.map((e) => e.tipo)).toEqual(esperados);
    expect(eventos.find((e) => e.tipo === 'quarentena')?.data).toBe(somarDias(entrada, 30));
    if (categoria === 'vaca_lactacao') expect(eventos[0]?.data).toBe(somarDias(entrada, 28));
  });

  it('prioriza lactações registradas sobre o histórico informado na entrada', async () => {
    const id = await salvarAnimal({ brinco: 'LAC', ultimo_parto_entrada: '2020-01-01', numero_lactacoes_entrada: 2 });
    await executar(`INSERT INTO lactacao (id,animal_id,numero,data_parto,created_at,updated_at)
      VALUES (?,?,?,?,?,?)`, ['lac', id, 3, somarDias(hoje(), -10), hoje(), hoje()]);
    expect(await obterAnimal(id)).toMatchObject({ numero_lactacao: 3, del: 10 });
  });

  it.each([
    { peso_entrada: -1 }, { peso_nascimento: 0 }, { valor_aquisicao: Number.NaN },
    { data_nascimento: '2025-02-30' }, { data_entrada: somarDias(hoje(), 1) },
    { idade_estimada_meses: 2.5, idade_estimada_em: hoje() },
    { idade_estimada_meses: 2 }, { numero_lactacoes_entrada: 1.5 },
    { sexo: 'M' as const, categoria: 'vaca_lactacao' as const },
    { data_nascimento: '2020-01-01', data_entrada: '2019-01-01' },
  ])('rejeita valores inválidos: %j', async (invalido) => {
    await expect(salvarAnimal({ brinco: 'INVALIDO', ...invalido })).rejects.toThrow();
    expect(await listarRebanho()).toHaveLength(0);
  });

  it('rejeita brinco duplicado com mensagem para o formulário', async () => {
    await salvarAnimal({ brinco: '100' });
    await expect(salvarAnimal({ brinco: ' 100 ' })).rejects.toThrow('Já existe');
  });

  it('recalcula somente lembretes pendentes ao corrigir datas', async () => {
    const id = await salvarAnimal({ brinco: 'DATAS', data_entrada: '2025-01-01', data_nascimento: '2024-12-01' });
    await criarEvento({ animalId: id, tipo: 'quarentena', titulo: 'Fim da quarentena', data: '2025-01-31', origem: 'regra' });
    await criarEvento({ animalId: id, tipo: 'desmame', titulo: 'Desmame previsto', data: '2025-01-30', origem: 'automatico' });
    await criarEvento({ animalId: id, tipo: 'consulta', titulo: 'Consulta manual', data: '2025-01-01', origem: 'manual' });
    await salvarAnimal({ id, brinco: 'DATAS', data_entrada: '2025-01-02', data_nascimento: '2024-12-02' });
    const eventos = await consultar<{ tipo: string; data: string }>('SELECT tipo,data FROM evento_calendario WHERE animal_id=?', [id]);
    expect(eventos).toContainEqual({ tipo: 'quarentena', data: '2025-02-01' });
    expect(eventos).toContainEqual({ tipo: 'desmame', data: '2025-01-31' });
    expect(eventos).toContainEqual({ tipo: 'consulta', data: '2025-01-01' });
  });

  it('desfaz o cadastro se a criação dos eventos falhar', async () => {
    await abrirBanco();
    await expect(emTransacao(async () => {
      await salvarAnimal({ brinco: 'ROLLBACK' });
      throw new Error('Falha ao criar evento');
    })).rejects.toThrow();
    expect(await listarRebanho()).toHaveLength(0);
  });
});
