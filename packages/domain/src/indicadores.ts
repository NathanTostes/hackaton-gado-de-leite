/**
 * Indicadores técnicos e econômico-financeiros.
 *
 * Todas as fórmulas vêm das cartilhas da Embrapa Gado de Leite. Os testes deste
 * pacote reproduzem os números impressos no exemplo da propriedade do Sr. João —
 * se os testes passam, os cálculos batem com a cartilha que o produtor já conhece.
 */

// ---------------------------------------------------------------------------
// Metas (EMBRAPA)
// ---------------------------------------------------------------------------

export const METAS = {
  /** % de mastite clínica ao mês não deve passar de 2%. (Mastite, p. 38) */
  mastiteClinica: 2,
  /** No máximo 20% das vacas com mastite subclínica. (Mastite, p. 39) */
  mastiteSubclinica: 20,
  /** Média anual ideal: ~83% das vacas em lactação. (Administrando, p. 46) */
  vacasEmLactacao: 83,
  /** Referência: ~50% do rebanho deve ser constituído por vacas. (Administrando, p. 46) */
  vacasNoRebanho: 50,
  /** CMT pelo menos uma vez por mês. (Mastite, p. 23) */
  intervaloCmtDias: 30,
} as const;

// ---------------------------------------------------------------------------
// Mastite
// ---------------------------------------------------------------------------

export interface CasoMastiteParaCalculo {
  /** Quantos quartos mamários foram afetados neste caso. */
  quartos: number;
  /** Por quantos dias do mês o caso durou. */
  dias: number;
}

/**
 * % de mastite clínica no mês (adaptado do National Mastitis Council).
 *
 *     (Σ dias de mastite ÷ dias do mês) ÷ nº médio de vacas em lactação × 100
 *
 * onde "dias de mastite" = Σ (quartos afetados × dias afetados).
 *
 * Exemplo da cartilha (p. 38): rebanho com 20 vacas em abril; uma vaca com
 * 1 quarto por 10 dias, outra com 2 quartos por 5 dias e uma terceira com
 * 1 quarto por 9 dias ⇒ 29 dias de mastite ⇒ 29 ÷ 30 ÷ 20 × 100 = 4,8%.
 */
export function percentualMastiteClinica(
  casos: CasoMastiteParaCalculo[],
  diasDoMes: number,
  mediaVacasEmLactacao: number,
): number {
  if (diasDoMes <= 0 || mediaVacasEmLactacao <= 0) return 0;
  const diasDeMastite = casos.reduce((t, c) => t + c.quartos * c.dias, 0);
  return (diasDeMastite / diasDoMes / mediaVacasEmLactacao) * 100;
}

/** % de mastite subclínica = positivos ÷ testados × 100 (por teto ou por vaca). */
export function percentualMastiteSubclinica(positivos: number, testados: number): number {
  if (testados <= 0) return 0;
  return (positivos / testados) * 100;
}

export type ResultadoCMT = 'N' | 'T' | '1' | '2' | '3' | 'PP';

/** CMT a partir de "+" é positivo. Traços (T) é considerado negativo pela cartilha. */
export function cmtPositivo(r: ResultadoCMT): boolean {
  return r === '1' || r === '2' || r === '3';
}

/** Pior resultado entre os quatro quartos — é ele que alimenta o motor. */
export function piorCMT(quartos: (ResultadoCMT | null)[]): ResultadoCMT | null {
  const ordem: ResultadoCMT[] = ['N', 'T', '1', '2', '3'];
  let pior: ResultadoCMT | null = null;
  for (const q of quartos) {
    if (q === null || q === 'PP') continue;
    if (pior === null || ordem.indexOf(q) > ordem.indexOf(pior)) pior = q;
  }
  // Se todos os quartos avaliáveis são PP, o próprio PP é a informação relevante.
  if (pior === null && quartos.some((q) => q === 'PP')) return 'PP';
  return pior;
}

/** CCS individual acima de 200.000 células/mL indica mastite subclínica. */
export const LIMITE_CCS_INDIVIDUAL = 200_000;

// ---------------------------------------------------------------------------
// Rebanho
// ---------------------------------------------------------------------------

export type CategoriaAnimal =
  | 'boi_carro'
  | 'touro'
  | 'bezerro_mamando'
  | 'bezerro_desmamado'
  | 'bezerra_1_2_anos'
  | 'novilha'
  | 'vaca_seca'
  | 'vaca_lactacao'
  | 'novilho';

export const ROTULO_CATEGORIA: Record<CategoriaAnimal, string> = {
  boi_carro: 'Bois de carro',
  touro: 'Touro',
  bezerro_mamando: 'Bezerras(os) mamando',
  bezerro_desmamado: 'Bezerras(os) desmamados (até 1 ano)',
  bezerra_1_2_anos: 'Bezerras de 1 a 2 anos',
  novilha: 'Novilhas',
  vaca_seca: 'Vacas secas',
  vaca_lactacao: 'Vacas em lactação',
  novilho: 'Novilhos',
};

export type ComposicaoRebanho = Partial<Record<CategoriaAnimal, number>>;

export function totalRebanho(c: ComposicaoRebanho): number {
  return Object.values(c).reduce<number>((t, n) => t + (n ?? 0), 0);
}

/** Total de vacas = em lactação + secas. */
export function totalVacas(c: ComposicaoRebanho): number {
  return (c.vaca_lactacao ?? 0) + (c.vaca_seca ?? 0);
}

/** % de vacas em lactação sobre o total de vacas — eficiência reprodutiva. */
export function percentualVacasEmLactacao(c: ComposicaoRebanho): number {
  const vacas = totalVacas(c);
  return vacas === 0 ? 0 : ((c.vaca_lactacao ?? 0) / vacas) * 100;
}

/** % de vacas sobre o rebanho total. */
export function percentualVacasNoRebanho(c: ComposicaoRebanho): number {
  const total = totalRebanho(c);
  return total === 0 ? 0 : (totalVacas(c) / total) * 100;
}

// ---------------------------------------------------------------------------
// Indicadores técnicos mensais
// ---------------------------------------------------------------------------

export interface EntradaIndicadoresTecnicos {
  /** Litros produzidos no mês (vendido + bezerros + consumo + derivados). */
  producaoMensalL: number;
  diasDoMes: number;
  /**
   * Dias do mês que realmente têm lançamento de produção.
   *
   * Num mês em andamento, dividir o total parcial pelos dias do mês inteiro
   * subestima a média diária — e, por tabela, o leite por vaca em lactação.
   * Quando omitido, assume o mês completo.
   */
  diasComProducao?: number;
  rebanho: ComposicaoRebanho;
  /** Pessoas trabalhando na atividade leiteira no mês. */
  maoDeObraPessoas: number;
  /** Hectares destinados à atividade leiteira. */
  areaHa: number;
  mortesNoMes?: number;
}

export interface IndicadoresTecnicos {
  producaoMensalL: number;
  producaoDiariaL: number;
  /** Dias que entraram na média diária. */
  diasConsiderados: number;
  rebanhoTotal: number;
  totalVacas: number;
  percVacasEmLactacao: number;
  percVacasNoRebanho: number;
  leitePorVacaLactacaoDia: number;
  leitePorMaoDeObraDia: number;
  leitePorAreaMes: number;
  leitePorAreaAno: number;
  mortesNoMes: number;
}

export function indicadoresTecnicos(e: EntradaIndicadoresTecnicos): IndicadoresTecnicos {
  const diasBase = e.diasComProducao && e.diasComProducao > 0 ? e.diasComProducao : e.diasDoMes;
  const producaoDiaria = diasBase > 0 ? e.producaoMensalL / diasBase : 0;
  const vacasLactacao = e.rebanho.vaca_lactacao ?? 0;

  return {
    producaoMensalL: e.producaoMensalL,
    producaoDiariaL: producaoDiaria,
    diasConsiderados: diasBase,
    rebanhoTotal: totalRebanho(e.rebanho),
    totalVacas: totalVacas(e.rebanho),
    percVacasEmLactacao: percentualVacasEmLactacao(e.rebanho),
    percVacasNoRebanho: percentualVacasNoRebanho(e.rebanho),
    leitePorVacaLactacaoDia: vacasLactacao > 0 ? producaoDiaria / vacasLactacao : 0,
    leitePorMaoDeObraDia: e.maoDeObraPessoas > 0 ? producaoDiaria / e.maoDeObraPessoas : 0,
    leitePorAreaMes: e.areaHa > 0 ? e.producaoMensalL / e.areaHa : 0,
    leitePorAreaAno: e.areaHa > 0 ? (e.producaoMensalL * 12) / e.areaHa : 0,
    mortesNoMes: e.mortesNoMes ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Indicadores econômico-financeiros
// ---------------------------------------------------------------------------

/** Categorias de despesa exatamente como na planilha da Embrapa. */
export const CATEGORIAS_DESPESA = [
  'combustivel',
  'concentrados_sal',
  'energia_eletrica',
  'impostos',
  'leite_bezerras',
  'manutencao_benfeitorias',
  'mao_de_obra_eventual',
  'mao_de_obra_fixa',
  'material_consumo',
  'pasto',
  'reproducao',
  'sanidade_medicamentos',
  'telefone_internet',
  'volumoso',
  'outros',
] as const;
export type CategoriaDespesa = (typeof CATEGORIAS_DESPESA)[number];

export const ROTULO_DESPESA: Record<CategoriaDespesa, string> = {
  combustivel: 'Combustível',
  concentrados_sal: 'Concentrados e sal',
  energia_eletrica: 'Energia elétrica',
  impostos: 'Impostos',
  leite_bezerras: 'Leite para bezerras(os)',
  manutencao_benfeitorias: 'Manutenção de benfeitorias e equipamentos',
  mao_de_obra_eventual: 'Mão de obra eventual',
  mao_de_obra_fixa: 'Mão de obra fixa',
  material_consumo: 'Material de consumo',
  pasto: 'Pasto',
  reproducao: 'Reprodução',
  sanidade_medicamentos: 'Sanidade e medicamentos',
  telefone_internet: 'Telefone e internet',
  volumoso: 'Volumoso (cana, milho, feno, silagem, palma)',
  outros: 'Outros',
};

export const CATEGORIAS_RECEITA = ['venda_leite', 'venda_animais', 'outras_vendas'] as const;
export type CategoriaReceita = (typeof CATEGORIAS_RECEITA)[number];

export const ROTULO_RECEITA: Record<CategoriaReceita, string> = {
  venda_leite: 'Venda de leite',
  venda_animais: 'Venda de animais',
  outras_vendas: 'Outras vendas',
};

export interface EntradaIndicadoresFinanceiros {
  receitas: Partial<Record<CategoriaReceita, number>>;
  despesas: Partial<Record<CategoriaDespesa, number>>;
  /** Litros produzidos no mês — base do custo por litro. */
  producaoMensalL: number;
  precoRecebidoPorLitro: number;
  /** Quanto a mão de obra familiar deveria receber, se fosse remunerada. */
  maoDeObraFamiliar?: number;
  /** Quanto deveria ser guardado por mês para reposição e investimento. */
  reposicaoInvestimento?: number;
}

export interface IndicadoresFinanceiros {
  totalReceitas: number;
  totalDespesas: number;
  /** Vendas − despesas: a margem bruta do fluxo de caixa do mês. */
  margemBruta: number;
  custoPorLitro: number;
  diferencaPrecoCusto: number;
  maoDeObraFamiliar: number;
  reposicaoInvestimento: number;
  custoOperacionalTotal: number;
  custoOperacionalTotalPorLitro: number;
  margemLiquida: number;
}

export function indicadoresFinanceiros(
  e: EntradaIndicadoresFinanceiros,
): IndicadoresFinanceiros {
  const soma = (o: Record<string, number | undefined>) =>
    Object.values(o).reduce<number>((t, v) => t + (v ?? 0), 0);

  const totalReceitas = soma(e.receitas);
  const totalDespesas = soma(e.despesas);
  const margemBruta = totalReceitas - totalDespesas;
  const custoPorLitro = e.producaoMensalL > 0 ? totalDespesas / e.producaoMensalL : 0;

  const maoDeObraFamiliar = e.maoDeObraFamiliar ?? 0;
  const reposicaoInvestimento = e.reposicaoInvestimento ?? 0;
  const custoOperacionalTotal = totalDespesas + maoDeObraFamiliar + reposicaoInvestimento;

  return {
    totalReceitas,
    totalDespesas,
    margemBruta,
    custoPorLitro,
    diferencaPrecoCusto: e.precoRecebidoPorLitro - custoPorLitro,
    maoDeObraFamiliar,
    reposicaoInvestimento,
    custoOperacionalTotal,
    custoOperacionalTotalPorLitro:
      e.producaoMensalL > 0 ? custoOperacionalTotal / e.producaoMensalL : 0,
    margemLiquida: totalReceitas - custoOperacionalTotal,
  };
}

// ---------------------------------------------------------------------------
// Panorama por vaca (produção × gastos com remédios)
// ---------------------------------------------------------------------------

export interface EntradaPanoramaVaca {
  litrosNoPeriodo: number;
  precoPorLitro: number;
  custoTratamentos: number;
  /** Litros perdidos por carência de medicamento e por mastite clínica. */
  litrosDescartados: number;
}

export interface PanoramaVaca {
  receitaEstimada: number;
  custoTratamentos: number;
  perdaPorDescarte: number;
  margem: number;
  /** Margem por litro efetivamente aproveitado. */
  margemPorLitro: number;
}

export function panoramaVaca(e: EntradaPanoramaVaca): PanoramaVaca {
  const litrosAproveitados = Math.max(0, e.litrosNoPeriodo - e.litrosDescartados);
  const receitaEstimada = litrosAproveitados * e.precoPorLitro;
  const perdaPorDescarte = e.litrosDescartados * e.precoPorLitro;
  const margem = receitaEstimada - e.custoTratamentos;

  return {
    receitaEstimada,
    custoTratamentos: e.custoTratamentos,
    perdaPorDescarte,
    margem,
    margemPorLitro: litrosAproveitados > 0 ? margem / litrosAproveitados : 0,
  };
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

export function moeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function numero(v: number, casas = 1): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function percentual(v: number, casas = 1): string {
  return `${numero(v, casas)}%`;
}
