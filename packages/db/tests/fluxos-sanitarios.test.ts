import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sessao } from '@drmoo/engine';
import { baseCompilada } from '@drmoo/knowledge';
import {
  atualizarStatusAposTriagem, definirBackend, executar, listarRebanho, obterAnimal, painelMastite, registrarCasoMastite,
  registrarTratamento, salvarAnimal, obterAtendimento, eventosDoAtendimento, listarEventos, concluirEvento, criarEvento, type BackendSQLite,
} from '@drmoo/db';
import { salvarConsulta } from '../../../apps/mobile/src/salvarConsulta';

describe('integridade dos fluxos sanitários', () => {
  let sqlite: DatabaseSync;
  let falhar: string | null;
  let animalId: string;

  beforeEach(async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 22, 12));
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
    for (const t of ['tratamento', 'despesa']) expect(contar(t)).toBe(1);
    expect(contar('evento_calendario')).toBe(3);
    expect((await obterAnimal(animalId))?.status).toBe('em_carencia');
  });

  it('salva datas escolhidas e vincula vacina e medicação ao calendário e ao prontuário', async () => {
    const sessao = sessaoClinica();
    const id = await salvarConsulta(animalId, sessao, sessao.encerrar(), [], {
      dataAtendimento: '2026-10-20', compromissos: [
        { titulo: 'Vacina informada pelo responsável', tipo: 'vacinacao', data: '2026-11-01' },
        { titulo: 'Medicamento já orientado', tipo: 'medicacao', data: '2026-10-23' },
      ],
    });
    expect((await obterAtendimento(id))?.data_hora.slice(0, 10)).toBe('2026-10-20');
    expect(sqlite.prepare('SELECT data FROM exame_cmt').get()?.data).toBe('2026-10-20');
    const eventos = await eventosDoAtendimento(id);
    expect(eventos.map((e) => [e.tipo, e.data, e.animal_id, e.referencia_id])).toEqual([
      ['medicacao', '2026-10-23', animalId, id], ['vacinacao', '2026-11-01', animalId, id],
    ]);
    expect((await listarEventos('2026-10-01', '2026-12-31')).filter((e) => e.atendimento_id === id)).toHaveLength(2);
    expect(contar('tratamento')).toBe(0); expect(contar('vacinacao')).toBe(0);
    await concluirEvento(eventos[0]!.id);
    expect((await eventosDoAtendimento(id))[0]?.status).toBe('feito');
  });

  it('agenda ações pendentes uma vez e não agenda as condutas já concluídas', async () => {
    const sessao = sessaoClinica(); const parecer = sessao.encerrar();
    const acoes = [...new Set(parecer.hipoteses.flatMap((h) => h.conduta))];
    expect(acoes.length).toBeGreaterThan(1);
    const id = await salvarConsulta(animalId, sessao, parecer, [acoes[0]!]);
    const eventos = await eventosDoAtendimento(id);
    expect(eventos).toHaveLength(acoes.length - 1);
    expect(eventos.some((e) => e.titulo === acoes[0])).toBe(false);
  });

  it('desfaz toda a consulta se o agendamento falhar', async () => {
    const sessao = sessaoClinica(); falhar = 'INSERT INTO evento_calendario';
    await expect(salvarConsulta(animalId, sessao, sessao.encerrar(), [])).rejects.toThrow('Falha simulada');
    for (const t of ['atendimento', 'caso_mastite', 'exame_cmt', 'evento_calendario']) expect(contar(t)).toBe(0);
    expect((await obterAnimal(animalId))?.status).toBe('saudavel');
  });

  it('valida datas antes de gravar e respeita a opção de não agendar nada', async () => {
    const sessao = sessaoClinica(); const parecer = sessao.encerrar();
    await expect(salvarConsulta(animalId, sessao, parecer, [], { dataAtendimento: '9999-01-01' })).rejects.toThrow('até hoje');
    await expect(salvarConsulta(animalId, sessao, parecer, [], { compromissos: [{ titulo: 'Teste', tipo: 'vacinacao', data: '2026-02-31' }] })).rejects.toThrow('data');
    expect(contar('atendimento')).toBe(0);
    const id = await salvarConsulta(animalId, sessao, parecer, [], { compromissos: [] });
    expect(await eventosDoAtendimento(id)).toEqual([]);
  });

  it('não duplica um compromisso repetido e permite a mesma ação em dias distintos', async () => {
    const sessao = sessaoClinica();
    const compromisso = { titulo: 'Retorno', tipo: 'reavaliacao' as const, data: '2026-10-24' };
    const id = await salvarConsulta(animalId, sessao, sessao.encerrar(), [], { compromissos: [compromisso, compromisso, { ...compromisso, data: '2026-10-25' }] });
    expect(await eventosDoAtendimento(id)).toHaveLength(2);
  });

  it('mantém atrasados antigos visíveis sem incluir eventos cancelados', async () => {
    await criarEvento({ tipo: 'vacinacao', animalId, titulo: 'Vacina atrasada', data: '2025-01-01' });
    const cancelado = await criarEvento({ tipo: 'medicacao', animalId, titulo: 'Cancelado', data: '2025-01-01' });
    await executar("UPDATE evento_calendario SET status='cancelado' WHERE id=?", [cancelado]);
    expect((await listarEventos('2026-10-01', '2026-10-31')).map((e) => e.titulo)).toEqual(['Vacina atrasada']);
  });

  it('tratamento registrado cria compromissos nas datas de início, fim e carência', async () => {
    await registrarTratamento({ animalId, medicamentoId: null, dataInicio: '2026-10-01', dias: 3,
      carenciaLeiteDias: 4, carenciaCarneDias: 5, custoTotal: 0, descricao: 'Tratamento registrado' });
    const eventos = await listarEventos('2026-10-01', '2026-10-31');
    expect(eventos.map((e) => e.data)).toEqual(['2026-10-01', '2026-10-03', '2026-10-07']);
  });

  it('mostra vacinação realizada e a próxima dose informada, sem duplicar ou desfazer a conclusão', async () => {
    await executar(`INSERT INTO vacina (id,nome,created_at,updated_at) VALUES ('vac','Vacina registrada','2026','2026')`);
    await executar(`INSERT INTO vacinacao (id,animal_id,vacina_id,data,proxima_dose,created_at,updated_at)
      VALUES ('aplicacao',?,'vac','2026-10-20','2026-11-20','2026','2026')`, [animalId]);
    const eventos = await listarEventos('2026-10-01', '2026-12-31');
    expect(eventos.map((e) => [e.tipo, e.data, e.status])).toEqual([
      ['vacinacao', '2026-10-20', 'feito'], ['vacinacao', '2026-11-20', 'pendente'],
    ]);
    await concluirEvento(eventos[1]!.id);
    const novamente = await listarEventos('2026-10-01', '2026-12-31');
    expect(novamente).toHaveLength(2); expect(novamente[1]?.status).toBe('feito');
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
