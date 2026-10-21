import { describe, expect, it } from 'vitest';
import {
  dataProvavelParto,
  dataSecagemSugerida,
  del,
  diasDeCarenciaRestantes,
  emCarencia,
  indicadoresFinanceiros,
  indicadoresTecnicos,
  percentualMastiteClinica,
  percentualMastiteSubclinica,
  percentualVacasEmLactacao,
  percentualVacasNoRebanho,
  piorCMT,
  totalRebanho,
  type ComposicaoRebanho,
} from '@drmoo/domain';

/**
 * Rebanho de janeiro da propriedade do Sr. João, conforme a planilha de
 * indicadores técnicos da cartilha (Administrando a propriedade leiteira, p. 45).
 */
const REBANHO_SR_JOAO: ComposicaoRebanho = {
  boi_carro: 0,
  touro: 3,
  bezerro_mamando: 4,
  bezerro_desmamado: 13,
  bezerra_1_2_anos: 16,
  novilha: 13,
  vaca_seca: 10,
  vaca_lactacao: 32,
};

describe('mastite — fórmulas da cartilha', () => {
  it('reproduz o exemplo impresso de 4,8% de mastite clínica (p. 38)', () => {
    // Abril (30 dias), 20 vacas em lactação. Uma vaca 1 quarto × 10 dias,
    // outra 2 quartos × 5 dias, a terceira 1 quarto × 9 dias ⇒ 29 dias.
    const perc = percentualMastiteClinica(
      [
        { quartos: 1, dias: 10 },
        { quartos: 2, dias: 5 },
        { quartos: 1, dias: 9 },
      ],
      30,
      20,
    );
    expect(perc).toBeCloseTo(4.8, 1);
    expect(perc).toBeGreaterThan(2); // acima da meta ⇒ exige programa de controle
  });

  it('calcula a mastite subclínica por tetos positivos', () => {
    expect(percentualMastiteSubclinica(25, 100)).toBe(25);
    expect(percentualMastiteSubclinica(0, 80)).toBe(0);
  });

  it('o pior CMT entre os quartos é o que alimenta o motor', () => {
    expect(piorCMT(['N', 'T', '2', 'N'])).toBe('2');
    expect(piorCMT(['N', 'N', 'N', 'N'])).toBe('N');
    expect(piorCMT(['PP', 'N', 'T', null])).toBe('T');
    expect(piorCMT(['PP', 'PP', null, null])).toBe('PP');
    expect(piorCMT([null, null, null, null])).toBeNull();
  });
});

describe('indicadores técnicos — propriedade do Sr. João, janeiro', () => {
  // A cartilha manda digitar "= 15416 + 434 + 2120 + 279" (vendido ao laticínio,
  // vendido ao queijeiro, fornecido aos bezerros, consumo da família) e imprime
  // 18.251 como resultado — mas essa soma dá 18.249. Adotamos o valor IMPRESSO,
  // porque é dele que todos os demais indicadores publicados na cartilha derivam.
  const PRODUCAO_MENSAL_CARTILHA = 18251;

  const ind = indicadoresTecnicos({
    producaoMensalL: PRODUCAO_MENSAL_CARTILHA,
    diasDoMes: 31,
    rebanho: REBANHO_SR_JOAO,
    maoDeObraPessoas: 2,
    areaHa: 48, // 28 ha próprios + 20 ha arrendados
    mortesNoMes: 3,
  });

  it('produção mensal e diária batem com a cartilha (18.251 L e 589 L/dia)', () => {
    expect(ind.producaoMensalL).toBe(18251);
    expect(Math.round(ind.producaoDiariaL)).toBe(589);
  });

  it('rebanho total de 91 animais e 42 vacas', () => {
    expect(totalRebanho(REBANHO_SR_JOAO)).toBe(91);
    expect(ind.rebanhoTotal).toBe(91);
    expect(ind.totalVacas).toBe(42);
  });

  it('% de vacas em lactação = 76 e % de vacas no rebanho = 46,2', () => {
    expect(Math.round(percentualVacasEmLactacao(REBANHO_SR_JOAO))).toBe(76);
    expect(percentualVacasNoRebanho(REBANHO_SR_JOAO)).toBeCloseTo(46.2, 1);
  });

  it('leite por vaca em lactação por dia = 18,4 L', () => {
    expect(ind.leitePorVacaLactacaoDia).toBeCloseTo(18.4, 1);
  });

  it('leite por mão de obra/dia = 294 L, leite/área/mês = 380 e /ano = 4563', () => {
    expect(Math.round(ind.leitePorMaoDeObraDia)).toBe(294);
    expect(Math.round(ind.leitePorAreaMes)).toBe(380);
    expect(Math.round(ind.leitePorAreaAno)).toBe(4563);
  });
});

describe('indicadores financeiros — propriedade do Sr. João, janeiro', () => {
  const fin = indicadoresFinanceiros({
    receitas: { venda_leite: 19137, venda_animais: 3200, outras_vendas: 200 },
    despesas: {
      combustivel: 110,
      concentrados_sal: 7351 + 201,
      energia_eletrica: 163,
      impostos: 281 + 100,
      leite_bezerras: 3.5 * 4 * 31 * 1.07,
      manutencao_benfeitorias: 95,
      mao_de_obra_eventual: 180,
      mao_de_obra_fixa: 0,
      material_consumo: 33 + 28 + 45,
      pasto: 290 + 21,
      reproducao: 120 + 269,
      sanidade_medicamentos: 450 + 72 + 402 + 48,
      telefone_internet: 40,
      volumoso: 35,
      outros: 25,
    },
    producaoMensalL: 18251,
    precoRecebidoPorLitro: 1.07,
    maoDeObraFamiliar: 2640, // 3 salários mínimos de 2016
    reposicaoInvestimento: 4000,
  });

  it('total de despesas de R$ 10.823, como na cartilha', () => {
    expect(Math.round(fin.totalDespesas)).toBe(10823);
  });

  /**
   * A cartilha imprime "Vendas − despesas = 12.636", o que exigiria receitas de
   * R$ 23.459. Mas as receitas que ela própria detalha somam R$ 22.537, e é esse
   * valor que reproduz exatamente a margem líquida publicada (22.537 − 17.463 =
   * 5.074). Ou seja: o 12.636 impresso é inconsistente com a própria cartilha.
   * Mantemos a fórmula correta e documentamos a divergência.
   */
  it('margem bruta = receitas − despesas, com as receitas detalhadas na cartilha', () => {
    expect(Math.round(fin.totalReceitas)).toBe(22537);
    expect(Math.round(fin.margemBruta)).toBe(22537 - 10823);
  });

  it('custo por litro de 0,593 e diferença preço−custo de 0,477', () => {
    expect(fin.custoPorLitro).toBeCloseTo(0.593, 3);
    expect(fin.diferencaPrecoCusto).toBeCloseTo(0.477, 3);
  });

  it('custo operacional total de R$ 17.463 e R$ 0,957 por litro', () => {
    expect(Math.round(fin.custoOperacionalTotal)).toBe(17463);
    expect(fin.custoOperacionalTotalPorLitro).toBeCloseTo(0.957, 3);
  });

  it('margem líquida de R$ 5.074', () => {
    expect(Math.round(fin.margemLiquida)).toBe(5074);
  });
});

describe('datas zootécnicas', () => {
  it('calcula DEL', () => {
    expect(del('2026-09-01', '2026-10-21')).toBe(50);
  });

  it('prevê o parto 283 dias após a cobertura e sugere a secagem 60 dias antes', () => {
    const parto = dataProvavelParto('2026-02-05');
    expect(parto).toBe('2026-11-15');
    expect(dataSecagemSugerida(parto)).toBe('2026-09-16');
  });

  it('controla a carência do medicamento', () => {
    expect(diasDeCarenciaRestantes('2026-10-25', '2026-10-21')).toBe(4);
    expect(emCarencia('2026-10-25', '2026-10-21')).toBe(true);
    expect(emCarencia('2026-10-20', '2026-10-21')).toBe(false);
    expect(emCarencia(null, '2026-10-21')).toBe(false);
  });
});
