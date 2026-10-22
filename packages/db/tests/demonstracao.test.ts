import { DatabaseSync } from 'node:sqlite';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import {
  apagarTudo, definirBackend, executar, listarRebanho, semear, recriarDemonstracao,
  obterPropriedade, resumoMensal, painelMastite, panoramaPorVaca, eventosPendentes,
  fatosDoAnimal, listarMedicamentos, atendimentosRecentes, salvarPropriedade,
  type BackendSQLite,
} from '@drmoo/db';

describe('recriação da demonstração', () => {
  let sqlite: DatabaseSync;
  let falharNoSeed: boolean;

  beforeEach(async () => {
    sqlite = new DatabaseSync(':memory:');
    falharNoSeed = false;
    const backend: BackendSQLite = {
      async execAsync(sql) { sqlite.exec(sql); },
      async runAsync(sql, params) {
        if (falharNoSeed && sql.includes('INSERT INTO animal')) throw new Error('Falha simulada');
        sqlite.prepare(sql).run(...params);
      },
      async getAllAsync<T>(sql: string, params: (string | number | null)[]) {
        return sqlite.prepare(sql).all(...params) as T[];
      },
      async getFirstAsync<T>(sql: string, params: (string | number | null)[]) {
        return (sqlite.prepare(sql).get(...params) as T | undefined) ?? null;
      },
      async withTransactionAsync(fn) {
        sqlite.exec('BEGIN');
        try { await fn(); sqlite.exec('COMMIT'); }
        catch (e) { sqlite.exec('ROLLBACK'); throw e; }
      },
    };
    definirBackend(backend);
    await semear();
  });

  afterEach(() => { definirBackend(null); sqlite.close(); });

  it('apaga atendimentos com casos, tratamentos e fatos vinculados', async () => {
    const [vaca] = await listarRebanho({ categorias: ['vaca_lactacao'] });
    await executar(`INSERT INTO atendimento
      (id, animal_id, data_hora, kb_versao, engine_versao, fatos_iniciais, respostas, conclusoes, traco, status, created_at, updated_at)
      VALUES ('consulta', ?, '2026-10-21', '1', '1', '[]', '[]', '[]', '[]', 'concluido', '2026-10-21', '2026-10-21')`, [vaca!.id]);
    await executar(`UPDATE tratamento SET atendimento_id = 'consulta'`);
    await executar(`UPDATE caso_mastite SET atendimento_id = 'consulta'`);
    await executar(`INSERT INTO fato_registrado VALUES ('fato', 'consulta', 'febre', 'true', 1, 'pergunta')`);
    await apagarTudo();
    expect(await listarRebanho()).toHaveLength(0);
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('recria repetidamente sem duplicar dados e mantém as consultas das telas funcionando', async () => {
    for (let i = 0; i < 2; i++) {
      await recriarDemonstracao();
      const animais = await listarRebanho();
      expect(animais).toHaveLength(91);
      expect(animais.filter((a) => a.status !== 'morto')).toHaveLength(90);
      expect((await obterPropriedade())?.nome).toBe('Sítio Boa Esperança');
      const agora = new Date();
      const resumo = await resumoMensal(agora.getFullYear(), agora.getMonth() + 1);
      expect(resumo.tecnicos.rebanhoTotal).toBe(90);
      expect(resumo.financeiros.totalDespesas).toBeGreaterThan(0);
      expect((await painelMastite(agora.getFullYear(), agora.getMonth() + 1)).vacasTestadas).toBeGreaterThan(0);
      expect((await panoramaPorVaca()).length).toBeGreaterThan(0);
      expect((await eventosPendentes()).length).toBeGreaterThan(0);
      expect((await listarMedicamentos()).length).toBeGreaterThan(0);
      expect(await atendimentosRecentes()).toEqual([]);
      expect((await fatosDoAnimal(animais[0]!.id)).length).toBeGreaterThan(0);
      expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    }
  });

  it('restaura todos os registros anteriores quando a geração falha', async () => {
    const propriedade = (await obterPropriedade())!;
    await salvarPropriedade({ ...propriedade, nome: 'Minha propriedade' });
    const antes = sqlite.prepare('SELECT * FROM animal ORDER BY id').all();
    const tratamentos = sqlite.prepare('SELECT * FROM tratamento ORDER BY id').all();
    falharNoSeed = true;
    await expect(recriarDemonstracao()).rejects.toThrow('Falha simulada');
    expect((await obterPropriedade())?.nome).toBe('Minha propriedade');
    expect(sqlite.prepare('SELECT * FROM animal ORDER BY id').all()).toEqual(antes);
    expect(sqlite.prepare('SELECT * FROM tratamento ORDER BY id').all()).toEqual(tratamentos);
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    falharNoSeed = false;
    await recriarDemonstracao();
    expect((await obterPropriedade())?.nome).toBe('Sítio Boa Esperança');
  });
});
