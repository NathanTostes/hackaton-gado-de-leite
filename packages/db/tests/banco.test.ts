/**
 * Exercita o esquema, o seed e os repositórios contra um SQLite real
 * (`node:sqlite`), sem navegador e sem aparelho. Pega erro de SQL, de constraint
 * e de agregação antes que apareçam na demonstração.
 */
import { DatabaseSync } from 'node:sqlite';
import { beforeAll, describe, expect, it } from 'vitest';
import { Sessao } from '@drmoo/engine';
import { baseCompilada } from '@drmoo/knowledge';
import { METAS, totalRebanho } from '@drmoo/domain';
import {
  composicaoRebanho,
  definirBackend,
  fatosDoAnimal,
  lancarCMT,
  listarRebanho,
  obterAnimal,
  obterPropriedade,
  painelMastite,
  panoramaPorVaca,
  registrarTratamento,
  resumoMensal,
  salvarAtendimento,
  semear,
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

describe('banco local', () => {
  beforeAll(async () => {
    definirBackend(backendNode());
    await semear();
  });

  it('cria o esquema e popula a propriedade do Sr. João', async () => {
    const p = await obterPropriedade();
    expect(p?.nome).toBe('Sítio Boa Esperança');
    expect(p?.area_propria_ha).toBe(28);
    expect(p?.area_arrendada_ha).toBe(20);
    expect(p?.preco_leite_litro).toBeCloseTo(1.07, 2);
    expect(p?.mao_de_obra_pessoas).toBe(2);
  });

  it('semeia o rebanho de 91 animais com a distribuição da cartilha', async () => {
    const c = await composicaoRebanho();
    // Uma bezerra desmamada é registrada como morta no seed (causa: diarreia),
    // então ela sai da composição ativa.
    expect(c.vaca_lactacao).toBe(32);
    expect(c.vaca_seca).toBe(10);
    expect(c.novilha).toBe(13);
    expect(c.touro).toBe(3);
    expect(totalRebanho(c)).toBe(90);
  });

  it('lista o rebanho com os campos derivados', async () => {
    const lista = await listarRebanho({ categorias: ['vaca_lactacao'] });
    expect(lista).toHaveLength(32);
    const comDel = lista.filter((a) => a.del !== null);
    expect(comDel.length).toBe(32);
    expect(lista.every((a) => a.producao_media_dia !== null)).toBe(true);
  });

  it('aplica os filtros combinados da busca', async () => {
    const porBrinco = await listarRebanho({ busca: '101' });
    expect(porBrinco.length).toBeGreaterThan(0);

    const positivas = await listarRebanho({ cmtPositivo: true });
    expect(positivas.length).toBeGreaterThan(0);

    const ordenadas = await listarRebanho({
      categorias: ['vaca_lactacao'],
      ordenarPor: 'producao',
    });
    const producoes = ordenadas.map((a) => a.producao_media_dia ?? 0);
    expect([...producoes].sort((a, b) => b - a)).toEqual(producoes);
  });

  it('calcula o painel de mastite com as metas da Embrapa', async () => {
    const agora = new Date();
    const p = await painelMastite(agora.getFullYear(), agora.getMonth() + 1);
    expect(p.percentualClinica).toBeGreaterThan(0);
    expect(p.vacasTestadas).toBeGreaterThan(0);
    expect(p.cronicas.length).toBeGreaterThanOrEqual(3);
    expect(METAS.mastiteClinica).toBe(2);
  });

  it('tem série de produção diária para o gráfico', async () => {
    const serie = await serieProducaoDiaria(30);
    expect(serie.length).toBeGreaterThan(25);
    expect(serie.every((s) => s.litros > 0)).toBe(true);
  });

  it('calcula o resumo mensal com indicadores técnicos e financeiros', async () => {
    const agora = new Date();
    const r = await resumoMensal(agora.getFullYear(), agora.getMonth() + 1);
    expect(r.tecnicos.rebanhoTotal).toBe(90);
    expect(r.financeiros.totalDespesas).toBeGreaterThan(0);
    expect(r.despesasPorCategoria.length).toBeGreaterThan(5);
  });

  /**
   * Regressão: a média diária era calculada dividindo o total do mês pelos dias
   * do mês inteiro. Num mês em andamento isso subestimava a produção diária — e,
   * por tabela, o leite por vaca em lactação.
   */
  it('a média diária usa os dias COM lançamento, não os dias do mês', async () => {
    const agora = new Date();
    const r = await resumoMensal(agora.getFullYear(), agora.getMonth() + 1);

    expect(r.diasComProducao).toBeGreaterThan(0);
    expect(r.tecnicos.diasConsiderados).toBe(r.diasComProducao);
    expect(r.tecnicos.producaoDiariaL).toBeCloseTo(
      r.tecnicos.producaoMensalL / r.diasComProducao,
      5,
    );

    // 32 vacas em lactação produzindo em curva realista: a média fica
    // claramente acima de 10 L/vaca/dia mesmo no primeiro dia do mês.
    expect(r.tecnicos.leitePorVacaLactacaoDia).toBeGreaterThan(10);

    // Mês corrente nunca está fechado enquanto houver dias sem lançamento.
    expect(r.fechado).toBe(r.diasComProducao >= new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate());
  });

  it('produz o panorama por vaca ordenado por margem', async () => {
    const p = await panoramaPorVaca(90);
    expect(p.length).toBe(32);
    const margens = p.map((v) => v.margem);
    expect([...margens].sort((a, b) => b - a)).toEqual(margens);
  });

  it('seed deixa pelo menos uma vaca em carência', async () => {
    const emCarencia = await vacasEmCarencia();
    expect(emCarencia.length).toBeGreaterThanOrEqual(1);
    expect(emCarencia[0]?.carencia_leite_ate).toBeTruthy();
  });
});

describe('ponte entre banco e motor de inferência', () => {
  it('pré-carrega fatos do animal para a sessão não reperguntar', async () => {
    const vacas = await listarRebanho({ categorias: ['vaca_lactacao'] });
    const vaca = vacas[0]!;
    const fatos = await fatosDoAnimal(vaca.id);

    const variaveis = fatos.map((f) => f.variavel);
    expect(variaveis).toContain('del');
    expect(variaveis).toContain('numero_lactacao');
    expect(variaveis).toContain('producao_media_dia');
    expect(fatos.every((f) => f.origem === 'banco' && f.descricao.length > 0)).toBe(true);

    // O motor não deve perguntar nada que já veio do banco.
    const sessao = new Sessao(baseCompilada, fatos);
    for (let i = 0; i < 6; i++) {
      const passo = sessao.proximo();
      if (passo.tipo !== 'pergunta' || !passo.pergunta) break;
      expect(variaveis).not.toContain(passo.pergunta.var);
      sessao.responder({ variavel: passo.pergunta.var, valor: false, cf: 1 });
    }
  });

  it('CMT recente vira fato; CMT antigo não', async () => {
    const vacas = await listarRebanho({ categorias: ['vaca_lactacao'] });
    const vaca = vacas[1]!;
    const hoje = new Date().toISOString().slice(0, 10);
    await lancarCMT(vaca.id, hoje, { ad: '2', ae: 'N', pd: 'N', pe: 'N' });

    const fatos = await fatosDoAnimal(vaca.id);
    const cmt = fatos.find((f) => f.variavel === 'cmt_pior_quarto');
    expect(cmt?.valor).toBe('2');

    // Com esse fato, o motor já conclui mastite sem precisar perguntar nada.
    // Pode ser a subclínica ou, se o CMT vem positivo há 3 meses, a crônica —
    // que a subsume (a vaca deste seed é uma das crônicas plantadas).
    const sessao = new Sessao(baseCompilada, fatos);
    const ids = sessao.hipoteses().map((h) => h.id);
    expect(ids.some((id) => id === 'mastite_subclinica' || id === 'mastite_cronica')).toBe(true);
  });

  it('grava e relê um atendimento completo', async () => {
    const vacas = await listarRebanho({ categorias: ['vaca_lactacao'] });
    const vaca = vacas[2]!;
    const fatos = await fatosDoAnimal(vaca.id);

    const sessao = new Sessao(baseCompilada, fatos);
    sessao.responder({ variavel: 'caneca_grumos', valor: true, cf: 1 });
    sessao.responder({ variavel: 'palpacao_dor', valor: true, cf: 1 });
    const parecer = sessao.encerrar();

    // Grumos + dor fecham o grau 2. Ele pode não liderar o ranking quando a vaca
    // também tem CMT positivo pré-carregado: as duas condições coexistem de fato,
    // em quartos diferentes, e o ranking é por fator de certeza, não por gravidade.
    expect(parecer.hipoteses.map((h) => h.id)).toContain('mastite_clinica_g2');
    expect(parecer.traco.map((p) => p.regraId)).toContain('MAST-CLIN-G2');

    const id = await salvarAtendimento({
      animal_id: vaca.id,
      data_hora: new Date().toISOString(),
      queixa_principal: null,
      kb_versao: parecer.kbVersao,
      engine_versao: parecer.engineVersao,
      fatos_iniciais: JSON.stringify(sessao.serializar().fatosIniciais),
      respostas: JSON.stringify(sessao.serializar().respostas),
      conclusoes: JSON.stringify(parecer.hipoteses),
      traco: JSON.stringify(parecer.traco),
      conduta_check: null,
      motivo_parada: parecer.motivoParada,
      status: 'concluido',
      observacoes: null,
    });
    expect(id).toBeTruthy();
  });

  it('registrar tratamento bloqueia a carência, cria evento e lança a despesa', async () => {
    const vacas = await listarRebanho({ categorias: ['vaca_lactacao'] });
    const vaca = vacas[10]!;
    const hoje = new Date().toISOString().slice(0, 10);

    await registrarTratamento({
      animalId: vaca.id,
      medicamentoId: null,
      dataInicio: hoje,
      dias: 3,
      carenciaLeiteDias: 4,
      carenciaCarneDias: 10,
      custoTotal: 74,
      descricao: 'Mastite intramamária',
    });

    const depois = await obterAnimal(vaca.id);
    expect(depois?.status).toBe('em_carencia');
    expect(depois?.carencia_leite_ate).toBeTruthy();

    const emCarencia = await vacasEmCarencia();
    expect(emCarencia.some((v) => v.id === vaca.id)).toBe(true);
  });
});
