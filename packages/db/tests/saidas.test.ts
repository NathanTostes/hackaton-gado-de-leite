import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  definirBackend, executar, obterAnimal, salvarAnimal, registrarSaida, historicoSaidas,
  listarRebanho, lancamentosDoMes, composicaoRebanho, exportarPlanilha, importarPlanilha,
  instantaneoLocal, aplicarLinhas, abrirBanco, type BackendSQLite,
} from '@drmoo/db';
import { DDL } from '../src/schema';

function backend(db: DatabaseSync, falhar: () => string | null = () => null): BackendSQLite {
  return {
    async execAsync(sql) { db.exec(sql); },
    async runAsync(sql, params) {
      if (falhar() && sql.includes(falhar()!)) throw new Error('Falha simulada');
      db.prepare(sql).run(...params);
    },
    async getAllAsync<T>(sql: string, params: (string | number | null)[]) { return db.prepare(sql).all(...params) as T[]; },
    async getFirstAsync<T>(sql: string, params: (string | number | null)[]) { return (db.prepare(sql).get(...params) as T | undefined) ?? null; },
    async withTransactionAsync(fn) {
      db.exec('BEGIN');
      try { await fn(); db.exec('COMMIT'); }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

describe('falecimentos e vendas de animais', () => {
  let db: DatabaseSync;
  let falhar: string | null;
  let animalId: string;
  beforeEach(async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 22, 12));
    db = new DatabaseSync(':memory:'); falhar = null;
    definirBackend(backend(db, () => falhar));
    animalId = await salvarAnimal({ brinco: '100', nome: 'Mimosa', categoria: 'vaca_lactacao', sexo: 'F',
      data_nascimento: '2020-01-01', data_entrada: '2021-01-01' });
  });
  afterEach(() => { definirBackend(null); db.close(); vi.useRealTimers(); });

  const morte = (animalId: string) => ({ tipo: 'falecimento' as const, animalId, data: '2026-10-20', hora: '09:35', causa: ' Causa informada pelo responsável ' });
  const venda = (animalId: string) => ({ tipo: 'venda' as const, animalId, data: '2026-10-20', valor: 4800.50, destinatario: ' Fazenda Esperança ' });

  it('registra data, hora e causa sem apagar a ficha ou o prontuário', async () => {
    await executar(`INSERT INTO atendimento (id, animal_id, data_hora, kb_versao, engine_versao, fatos_iniciais,
      respostas, conclusoes, traco, status, created_at, updated_at)
      VALUES ('consulta', ?, '2026-10-19', '1', '1', '[]', '[]', '[]', '[]', 'concluido', '2026-10-19', '2026-10-19')`, [animalId]);
    await registrarSaida(morte(animalId));
    expect(await obterAnimal(animalId)).toMatchObject({ status: 'morto', data_saida: '2026-10-20', motivo_saida: 'Causa informada pelo responsável' });
    expect(await historicoSaidas('falecimento')).toMatchObject([{ animal_id: animalId, brinco: '100', nome: 'Mimosa', data: '2026-10-20', hora: '09:35', causa: 'Causa informada pelo responsável' }]);
    expect(await listarRebanho()).toEqual([]);
    expect((await listarRebanho({ status: ['morto'] }))[0]?.id).toBe(animalId);
    expect(db.prepare('SELECT COUNT(*) n FROM atendimento').get()?.n).toBe(1);
    expect(db.prepare('SELECT deleted_at FROM animal').get()?.deleted_at).toBeNull();
    expect((await composicaoRebanho()).vaca_lactacao ?? 0).toBe(0);
  });

  it('registra venda, destinatário e uma única receita no financeiro', async () => {
    await registrarSaida(venda(animalId));
    expect(await obterAnimal(animalId)).toMatchObject({ status: 'vendido', data_saida: '2026-10-20', motivo_saida: 'Venda' });
    expect(await historicoSaidas('venda')).toMatchObject([{ animal_id: animalId, valor: 4800.50, destinatario: 'Fazenda Esperança' }]);
    expect((await lancamentosDoMes(2026, 10)).receitas).toMatchObject([{ animal_id: animalId, categoria: 'venda_animais', valor: 4800.50 }]);
    await expect(registrarSaida(venda(animalId))).rejects.toThrow('saída registrada');
    await expect(registrarSaida(morte(animalId))).rejects.toThrow('saída registrada');
    expect(db.prepare('SELECT COUNT(*) n FROM receita').get()?.n).toBe(1);
    expect(await listarRebanho()).toEqual([]);
  });

  it('cancela tarefas pendentes futuras sem alterar tarefas já concluídas ou passadas', async () => {
    for (const [id, data, status] of [['futuro', '2026-10-21', 'pendente'], ['passado', '2026-10-19', 'pendente'], ['feito', '2026-10-21', 'concluido']]) {
      await executar('INSERT INTO evento_calendario (id,animal_id,tipo,titulo,data,status,created_at,updated_at) VALUES (?,?,?, ?,?,?,?,?)',
        [id!, animalId, 'outro', 'Tarefa', data!, status!, '2026-10-01', '2026-10-01']);
    }
    await registrarSaida(morte(animalId));
    expect(db.prepare('SELECT id,status FROM evento_calendario ORDER BY id').all()).toEqual([
      { id: 'feito', status: 'concluido' }, { id: 'futuro', status: 'cancelado' }, { id: 'passado', status: 'pendente' },
    ]);
  });

  it.each(['INSERT INTO morte', 'UPDATE animal', 'UPDATE evento_calendario'])(
    'desfaz falecimento e estado se falhar %s', async (sql) => {
      falhar = sql;
      await expect(registrarSaida(morte(animalId))).rejects.toThrow('Falha simulada');
      expect((await obterAnimal(animalId))?.status).toBe('saudavel');
      expect(await historicoSaidas('falecimento')).toEqual([]);
    },
  );

  it('desfaz também a receita se a atualização do estado da venda falhar', async () => {
    falhar = 'UPDATE animal';
    await expect(registrarSaida(venda(animalId))).rejects.toThrow('Falha simulada');
    expect((await obterAnimal(animalId))?.status).toBe('saudavel');
    expect((await lancamentosDoMes(2026, 10)).receitas).toEqual([]);
  });

  it('valida data, hora, causa, preço e destinatário antes de gravar', async () => {
    for (const dados of [
      { ...morte(animalId), data: '2026-02-31' }, { ...morte(animalId), hora: '25:00' },
      { ...morte(animalId), data: '2026-10-22', hora: '13:00' }, { ...morte(animalId), causa: ' ' },
      { ...venda(animalId), valor: -10 }, { ...venda(animalId), valor: Infinity },
      { ...venda(animalId), destinatario: '' }, { ...venda(animalId), data: '2027-01-01' },
      { ...venda(animalId), data: '2019-01-01' },
    ]) await expect(registrarSaida(dados)).rejects.toThrow();
    expect((await obterAnimal(animalId))?.status).toBe('saudavel');
    expect(await historicoSaidas('venda')).toEqual([]);
  });

  it('preserva falecimentos e duas vendas de mesmo valor no round-trip da planilha', async () => {
    await registrarSaida(morte(animalId));
    const a = await salvarAnimal({ brinco: '200', categoria: 'novilha', sexo: 'F', data_entrada: '2021-01-01' });
    const b = await salvarAnimal({ brinco: '300', categoria: 'novilha', sexo: 'F', data_entrada: '2021-01-01' });
    await registrarSaida(venda(a)); await registrarSaida({ ...venda(b), destinatario: 'Outro comprador' });
    const arquivo = await exportarPlanilha();
    const relatorio = await importarPlanilha(arquivo, { substituir: true });
    expect(relatorio.erros).toEqual([]);
    expect(await historicoSaidas('falecimento')).toMatchObject([{ hora: '09:35', causa: 'Causa informada pelo responsável' }]);
    expect(await historicoSaidas('venda')).toHaveLength(2);
    const falecido = (await historicoSaidas('falecimento'))[0]!;
    const vendido = (await historicoSaidas('venda')).find((s) => s.brinco === '200')!;
    expect(await obterAnimal(falecido.animal_id)).toMatchObject({ status: 'morto', data_saida: '2026-10-20' });
    expect(await obterAnimal(vendido.animal_id)).toMatchObject({ status: 'vendido', data_saida: '2026-10-20', motivo_saida: 'Venda' });
    expect((await historicoSaidas('venda')).map((s) => s.destinatario).sort()).toEqual(['Fazenda Esperança', 'Outro comprador']);
    await importarPlanilha(arquivo);
    expect((await lancamentosDoMes(2026, 10)).receitas).toHaveLength(2);
  });

  it('inclui hora, causa, destinatário e venda na sincronização local', async () => {
    await registrarSaida(morte(animalId));
    const outro = await salvarAnimal({ brinco: '200', categoria: 'novilha', sexo: 'F', data_entrada: '2021-01-01' });
    await registrarSaida(venda(outro));
    const instantaneo = await instantaneoLocal('origem');
    const novo = new DatabaseSync(':memory:');
    definirBackend(backend(novo));
    try {
      const resultado = await aplicarLinhas(instantaneo.tabelas);
      expect(resultado.conflitos).toEqual([]);
      expect(await historicoSaidas('falecimento')).toMatchObject([{ hora: '09:35' }]);
      expect(await historicoSaidas('venda')).toMatchObject([{ valor: 4800.50, destinatario: 'Fazenda Esperança' }]);
    } finally { definirBackend(backend(db)); novo.close(); }
  });

  it('migra banco antigo sem inventar hora ou destinatário dos registros legados', async () => {
    const antigo = new DatabaseSync(':memory:');
    antigo.exec(DDL.replace('  hora TEXT,\n', '').replace('  destinatario TEXT,\n', ''));
    antigo.exec(`INSERT INTO animal (id,brinco,categoria,sexo,status,created_at,updated_at)
      VALUES ('legado','antigo','bezerro_mamando','F','morto','2025','2025');
      INSERT INTO morte (id,animal_id,data,causa,created_at,updated_at)
      VALUES ('antigo','legado','2025-01-01','Causa antiga','2025','2025');`);
    definirBackend(backend(antigo));
    try {
      await abrirBanco();
      expect(await historicoSaidas('falecimento')).toMatchObject([{ hora: null, causa: 'Causa antiga' }]);
      expect(antigo.prepare('PRAGMA table_info(receita)').all().some((c) => c.name === 'destinatario')).toBe(true);
    } finally { definirBackend(backend(db)); antigo.close(); }
  });
});
