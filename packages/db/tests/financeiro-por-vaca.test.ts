/**
 * A conta que o app chama de lucro: leite da vaca × custo de tratá-la.
 *
 * O recorte é estreito de propósito, e por isso precisa estar certo — é o
 * número que vai para a tela, para o PDF e para a decisão de descarte. Aqui ele
 * é verificado com valores montados à mão, em SQLite real.
 */
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  agoraISO,
  definirBackend,
  executar,
  lancarDespesa,
  lancarReceita,
  lancamentosDoMes,
  novoId,
  panoramaPorVaca,
  registrarTratamento,
  salvarAnimal,
  salvarMedicamento,
  salvarPropriedade,
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

function diasAtras(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

/** Lança a mesma produção por vários dias, como faria a ordenha diária. */
async function produzir(animalId: string, litrosPorDia: number, dias: number): Promise<void> {
  const agora = agoraISO();
  for (let i = 1; i <= dias; i += 1) {
    await executar(
      `INSERT INTO controle_leiteiro
        (id, animal_id, data, litros_manha, litros_tarde, litros_total, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [novoId('cl'), animalId, diasAtras(i), litrosPorDia / 2, litrosPorDia / 2, litrosPorDia, agora, agora],
    );
  }
}

describe('tratamentos × produção de leite', () => {
  beforeEach(async () => {
    definirBackend(backendNode());
    await salvarPropriedade({ nome: 'Sítio de Teste', preco_leite_litro: 2 });
  });

  it('vaca sadia: a margem é o leite todo vendido, sem desconto', async () => {
    const id = await salvarAnimal({ brinco: '101', nome: 'Mimosa', categoria: 'vaca_lactacao', sexo: 'F' });
    await produzir(id, 20, 10); // 200 L × R$ 2,00

    const [vaca] = await panoramaPorVaca(90);

    expect(vaca?.litros).toBeCloseTo(200);
    expect(vaca?.custoTratamentos).toBe(0);
    expect(vaca?.perdaPorDescarte).toBe(0);
    expect(vaca?.receitaEstimada).toBeCloseTo(400);
    expect(vaca?.margem).toBeCloseTo(400);
  });

  it('o remédio e o leite descartado na carência saem da conta', async () => {
    const id = await salvarAnimal({ brinco: '102', nome: 'Jurema', categoria: 'vaca_lactacao', sexo: 'F' });
    await produzir(id, 20, 10);
    const medicamento = await salvarMedicamento({
      nome: 'Mastifin',
      custo_unidade: 30,
      carencia_leite_dias: 3,
      carencia_carne_dias: 10,
      estoque: 5,
      principio_ativo: null,
      apresentacao: null,
      validade: null,
    });

    await registrarTratamento({
      animalId: id,
      medicamentoId: medicamento,
      dataInicio: diasAtras(5),
      dias: 3,
      carenciaLeiteDias: 3,
      carenciaCarneDias: 10,
      custoTotal: 60,
      responsavel: 'Sr. João',
      descricao: 'Mastifin, 2 bisnagas',
    });

    const [vaca] = await panoramaPorVaca(90);

    expect(vaca?.custoTratamentos).toBeCloseTo(60); // 2 × R$ 30
    expect(vaca?.perdaPorDescarte).toBeGreaterThan(0);
    // A margem é a receita do leite aproveitado menos o custo do tratamento.
    expect(vaca?.margem).toBeCloseTo(vaca!.receitaEstimada - vaca!.custoTratamentos);
    expect(vaca?.margem).toBeLessThan(400);
  });

  it('a vaca que custou mais do que rendeu fica com margem negativa', async () => {
    const id = await salvarAnimal({ brinco: '103', nome: 'Lua', categoria: 'vaca_lactacao', sexo: 'F' });
    await produzir(id, 2, 3); // quase nada de leite
    const caro = await salvarMedicamento({
      nome: 'Antibiótico caro',
      custo_unidade: 500,
      carencia_leite_dias: 5,
      carencia_carne_dias: 30,
      estoque: 2,
      principio_ativo: null,
      apresentacao: null,
      validade: null,
    });
    await registrarTratamento({
      animalId: id,
      medicamentoId: caro,
      dataInicio: diasAtras(2),
      dias: 1,
      carenciaLeiteDias: 5,
      carenciaCarneDias: 30,
      custoTotal: 500,
      descricao: 'Antibiótico caro, 1 frasco',
    });

    const [vaca] = await panoramaPorVaca(90);

    expect(vaca?.margem).toBeLessThan(0);
  });

  it('a lista vem ordenada da melhor margem para a pior', async () => {
    const boa = await salvarAnimal({ brinco: '201', categoria: 'vaca_lactacao', sexo: 'F' });
    const fraca = await salvarAnimal({ brinco: '202', categoria: 'vaca_lactacao', sexo: 'F' });
    await produzir(boa, 25, 10);
    await produzir(fraca, 5, 10);

    const panorama = await panoramaPorVaca(90);

    expect(panorama.map((v) => v.brinco)).toEqual(['201', '202']);
    expect(panorama[0]!.margem).toBeGreaterThan(panorama[1]!.margem);
  });

  it('só entram vacas em lactação — novilha e touro não têm esta conta', async () => {
    await salvarAnimal({ brinco: '301', categoria: 'novilha', sexo: 'F' });
    await salvarAnimal({ brinco: '302', categoria: 'touro', sexo: 'M' });
    const vaca = await salvarAnimal({ brinco: '303', categoria: 'vaca_lactacao', sexo: 'F' });
    await produzir(vaca, 18, 5);

    const panorama = await panoramaPorVaca(90);

    expect(panorama.map((v) => v.brinco)).toEqual(['303']);
  });

  it('a janela de dias recorta o período: leite antigo não conta', async () => {
    const id = await salvarAnimal({ brinco: '401', categoria: 'vaca_lactacao', sexo: 'F' });
    await produzir(id, 20, 3);

    const trintaDias = await panoramaPorVaca(30);
    const umDia = await panoramaPorVaca(1);

    expect(trintaDias[0]?.litros).toBeCloseTo(60);
    expect(umDia[0]?.litros ?? 0).toBeLessThan(60);
  });

  it('vaca sem produção lançada não vira NaN nem desaparece', async () => {
    await salvarAnimal({ brinco: '501', categoria: 'vaca_lactacao', sexo: 'F' });

    const [vaca] = await panoramaPorVaca(90);

    expect(vaca?.litros).toBe(0);
    expect(vaca?.margem).toBe(0);
    expect(Number.isNaN(vaca?.margemPorLitro ?? NaN)).toBe(false);
  });
});

describe('lançamentos do mês (contexto econômico)', () => {
  beforeEach(async () => {
    definirBackend(backendNode());
    await salvarPropriedade({ nome: 'Sítio de Teste', preco_leite_litro: 2 });
  });

  it('separa despesas e receitas do mês pedido', async () => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth() + 1;
    const dia = `${ano}-${String(mes).padStart(2, '0')}-10`;

    await lancarDespesa({ data: dia, categoria: 'concentrado', valor: 1200, descricao: 'ração' });
    await lancarReceita({ data: dia, categoria: 'leite', valor: 4800, descricao: 'venda do laticínio' });
    await lancarDespesa({ data: '2020-01-05', categoria: 'concentrado', valor: 99 });

    const { despesas, receitas } = await lancamentosDoMes(ano, mes);

    expect(despesas.map((d) => d.valor)).toEqual([1200]);
    expect(receitas.map((r) => r.valor)).toEqual([4800]);
  });
});
