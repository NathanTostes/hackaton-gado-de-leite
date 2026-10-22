import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sessao } from '@drmoo/engine';
import { baseCompilada } from '@drmoo/knowledge';
import {
  atualizarStatusAposTriagem, definirBackend, executar, listarRebanho, obterAnimal, painelMastite, registrarCasoMastite,
  registrarTratamento, salvarAnimal, type BackendSQLite,
} from '@drmoo/db';
import { salvarConsulta } from '../../../apps/mobile/src/salvarConsulta';

describe('integridade dos fluxos sanitários', () => {
  let sqlite: DatabaseSync;
  let falhar: string | null;
  let animalId: string;

  beforeEach(async () => {
    sqlite = new DatabaseSync(':memory:');
    falhar = null;
    const backend: BackendSQLite = {
      async execAsync(sql) { sqlite.exec(sql); },
      async runAsync(sql, params) {
        if (falhar && sql.includes(falhar)) throw new Error('Falha simulada');
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
    animalId = await salvarAnimal({ brinco: '001', categoria: 'vaca_lactacao', sexo: 'F' });
  });

  afterEach(() => { vi.useRealTimers(); definirBackend(null); sqlite.close(); });

  function contar(tabela: string): number {
    return (sqlite.prepare(`SELECT COUNT(*) n FROM ${tabela}`).get() as { n: number }).n;
  }

  function sessaoClinica() {
    const sessao = new Sessao(baseCompilada);
    sessao.responder({ variavel: 'cmt_pior_quarto', valor: '3', cf: 1 });
    sessao.responder({ variavel: 'caneca_grumos', valor: true, cf: 1 });
    sessao.responder({ variavel: 'palpacao_dor', valor: true, cf: 1 });
    return sessao;
  }

  it('registra clínica em segundo lugar junto com prontuário e CMT', async () => {
    const sessao = sessaoClinica();
    const parecer = sessao.encerrar();
    expect(parecer.hipoteses[0]?.id).toBe('mastite_subclinica');
    expect(parecer.hipoteses[1]?.id).toBe('mastite_clinica_g2');
    const id = await salvarConsulta(animalId, sessao, parecer, ['conduta']);
    expect((await obterAnimal(animalId))?.status).toBe('suspeito');
    expect(contar('atendimento')).toBe(1);
    expect(contar('caso_mastite')).toBe(1);
    expect(contar('exame_cmt')).toBe(1);
    expect(sqlite.prepare('SELECT grau, atendimento_id FROM caso_mastite').get()).toEqual({ grau: 2, atendimento_id: id });
    expect(sqlite.prepare('SELECT conduta_check FROM atendimento').get()?.conduta_check).toBe('["conduta"]');
  });

  it('não abre caso clínico em consultas somente subclínicas', async () => {
    const sessao = new Sessao(baseCompilada);
    sessao.responder({ variavel: 'cmt_pior_quarto', valor: '2', cf: 1 });
    await salvarConsulta(animalId, sessao, sessao.encerrar(), []);
    expect((await obterAnimal(animalId))?.status).toBe('suspeito');
    expect(contar('atendimento')).toBe(1);
    expect(contar('caso_mastite')).toBe(0);
    expect(contar('exame_cmt')).toBe(1);
  });

  it('desfaz a consulta inteira se o exame falhar e permite tentar novamente', async () => {
    const sessao = sessaoClinica();
    falhar = 'INSERT INTO exame_cmt';
    await expect(salvarConsulta(animalId, sessao, sessao.encerrar(), [])).rejects.toThrow('Falha simulada');
    for (const t of ['atendimento', 'caso_mastite', 'exame_cmt']) expect(contar(t)).toBe(0);
    expect((await obterAnimal(animalId))?.status).toBe('saudavel');
    falhar = null;
    await salvarConsulta(animalId, sessao, sessao.encerrar(), []);
    for (const t of ['atendimento', 'caso_mastite', 'exame_cmt']) expect(contar(t)).toBe(1);
  });

  it('atualiza suspeitas de outros grupos e a lista filtrada do rebanho', async () => {
    const sessao = new Sessao(baseCompilada);
    for (const [variavel, valor] of Object.entries({ del: 1, numero_lactacao: 3, decubito: true, febre: false, extremidades_frias: true })) {
      sessao.responder({ variavel, valor, cf: 1 });
    }
    const parecer = sessao.encerrar();
    expect(parecer.hipoteses.some((h) => h.id === 'hipocalcemia')).toBe(true);
    await salvarConsulta(animalId, sessao, parecer, []);
    expect((await obterAnimal(animalId))?.status).toBe('suspeito');
    expect((await listarRebanho({ status: ['suspeito'] })).map((a) => a.id)).toEqual([animalId]);
    expect(await listarRebanho({ status: ['saudavel'] })).toEqual([]);
  });

  it('marca suspeita ao salvar uma Bandeira Vermelha', async () => {
    const sessao = new Sessao(baseCompilada);
    sessao.responder({ variavel: 'sinais_nervosos', valor: true, cf: 1 });
    sessao.responder({ variavel: 'dificuldade_deglutir', valor: true, cf: 1 });
    const parecer = sessao.encerrar();
    expect(parecer.bandeiraVermelha).not.toBeNull();
    await salvarConsulta(animalId, sessao, parecer, []);
    expect((await obterAnimal(animalId))?.status).toBe('suspeito');
  });

  it('não marca doença em consulta inconclusiva nem dá alta automática a uma suspeita anterior', async () => {
    const sessao = new Sessao(baseCompilada);
    await salvarConsulta(animalId, sessao, sessao.encerrar(), []);
    expect((await obterAnimal(animalId))?.status).toBe('saudavel');
    await salvarAnimal({ id: animalId, brinco: '001', status: 'suspeito' });
    await salvarConsulta(animalId, sessao, sessao.encerrar(), []);
    expect((await obterAnimal(animalId))?.status).toBe('suspeito');
  });

  it('ignora sem alteração, alertas de rebanho e hipóteses sem suporte positivo', async () => {
    await atualizarStatusAposTriagem(animalId, [
      { id: 'sem_alteracao', grupo: 'triagem', cf: 1 },
      { id: 'rebanho_cmt_atrasado', grupo: 'rebanho', cf: 1 },
      { id: 'cetose', grupo: 'metabolicas', cf: 0 },
      { id: 'hipocalcemia', grupo: 'metabolicas', cf: -0.5 },
    ]);
    expect((await obterAnimal(animalId))?.status).toBe('saudavel');
    await atualizarStatusAposTriagem(animalId, [{ id: 'cetose', grupo: 'metabolicas', cf: 0.3 }]);
    expect((await obterAnimal(animalId))?.status).toBe('suspeito');
  });

  it.each(['em_tratamento', 'em_carencia', 'mastite_cronica', 'quarentena', 'morto', 'descartado'] as const)(
    'preserva o estado %s ao salvar nova suspeita', async (status) => {
      await salvarAnimal({ id: animalId, brinco: '001', status });
      const sessao = sessaoClinica();
      await salvarConsulta(animalId, sessao, sessao.encerrar(), []);
      expect((await obterAnimal(animalId))?.status).toBe(status);
    },
  );

  it('desfaz o prontuário se falhar a atualização do estado', async () => {
    falhar = "UPDATE animal SET status='suspeito'";
    const sessao = sessaoClinica();
    await expect(salvarConsulta(animalId, sessao, sessao.encerrar(), [])).rejects.toThrow('Falha simulada');
    for (const t of ['atendimento', 'caso_mastite', 'exame_cmt']) expect(contar(t)).toBe(0);
    expect((await obterAnimal(animalId))?.status).toBe('saudavel');
  });

  it.each(['INSERT INTO evento_calendario', 'INSERT INTO despesa'])('desfaz tratamento, status e efeitos ao falhar em %s', async (comando) => {
    const tratamento = {
      animalId, medicamentoId: null, dataInicio: '2025-10-22', dias: 3,
      carenciaLeiteDias: 4, carenciaCarneDias: 10, custoTotal: 50, descricao: 'Registro de teste',
    };
    falhar = comando;
    await expect(registrarTratamento(tratamento)).rejects.toThrow('Falha simulada');
    for (const t of ['tratamento', 'evento_calendario', 'despesa']) expect(contar(t)).toBe(0);
    expect((await obterAnimal(animalId))?.status).toBe('saudavel');
    falhar = null;
    await registrarTratamento(tratamento);
    for (const t of ['tratamento', 'evento_calendario', 'despesa']) expect(contar(t)).toBe(1);
    expect((await obterAnimal(animalId))?.status).toBe('em_carencia');
  });

  it('distribui os dias de um caso fechado entre os meses afetados', async () => {
    await registrarCasoMastite({ animalId, quartos: 1, tipo: 'clinica', grau: 2, dataInicio: '2025-09-29', atendimentoId: null });
    await executar("UPDATE caso_mastite SET data_fim='2025-10-03'");
    expect((await painelMastite(2025, 9)).percentualClinica).toBeCloseTo(2 / 30 * 100);
    expect((await painelMastite(2025, 10)).percentualClinica).toBeCloseTo(3 / 31 * 100);
    expect((await painelMastite(2025, 8)).percentualClinica).toBe(0);
    expect((await painelMastite(2025, 11)).percentualClinica).toBe(0);
  });

  it('limita casos abertos ao mês consultado e ao dia atual', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 22, 12));
    await registrarCasoMastite({ animalId, quartos: 1, tipo: 'clinica', grau: 1, dataInicio: '2026-09-29', atendimentoId: null });
    expect((await painelMastite(2026, 9)).percentualClinica).toBeCloseTo(2 / 30 * 100);
    expect((await painelMastite(2026, 10)).percentualClinica).toBeCloseTo(22 / 31 * 100);
    expect((await painelMastite(2026, 11)).percentualClinica).toBe(0);
  });

  it('preserva o cálculo para casos inteiramente dentro do mês', async () => {
    await registrarCasoMastite({ animalId, quartos: 2, tipo: 'clinica', grau: 1, dataInicio: '2025-10-10', atendimentoId: null });
    await executar("UPDATE caso_mastite SET data_fim='2025-10-12'");
    expect((await painelMastite(2025, 10)).percentualClinica).toBeCloseTo(2 * 3 / 31 * 100);
  });
});
