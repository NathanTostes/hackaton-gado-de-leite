/**
 * A planilha de exemplo.
 *
 * O template em branco responde "quais são as colunas?"; ele não responde
 * "como eu preencho isso?". Esta é a resposta: uma propriedade pequena de
 * verdade — 10 vacas, dois lotes, três semanas de ordenha, CMT, CCS do tanque,
 * tratamento com carência, vacinação, cobertura e as contas do mês — para o
 * produtor abrir no Excel, ver o formato de cada célula e importar como está
 * para conhecer o app com dados dentro.
 *
 * As datas são relativas a uma data de referência (hoje, por padrão): a
 * planilha baixada em qualquer dia cai num período que o app mostra como
 * recente, em vez de um mês fixo que envelhece.
 *
 * As chaves de cada linha são os TÍTULOS das colunas, não os nomes de coluna do
 * banco — é exatamente o que `lerArquivo` devolve, então o exemplo passa pelo
 * mesmo caminho de importação que uma planilha preenchida à mão.
 */
import type { ConteudoPlanilha } from './arquivo';
import type { LinhaPlanilha } from './conversao';

/** Nome do arquivo sugerido no download. */
export const NOME_ARQUIVO_EXEMPLO = 'drmoo-planilha-de-exemplo.xlsx';

const LOTE_LACTACAO = 'Vacas em lactação';
const LOTE_SECAS = 'Vacas secas e pré-parto';
const LOTE_RECRIA = 'Recria';

/** Uma vaca do exemplo e a história que ela conta no app. */
interface VacaExemplo {
  brinco: string;
  nome: string;
  raca: string;
  nascimento: number;
  /** Dias desde o último parto. */
  del: number;
  lactacao: number;
  /** Média de litros por dia, dividida em manhã (60%) e tarde (40%). */
  mediaDia: number;
  seca?: boolean;
  /** CMT por quarto: anterior dir., anterior esq., post. dir., post. esq. */
  cmt?: [string, string, string, string];
  ccs?: number;
  observacoes?: string;
}

const ANOS = 365;

const VACAS: VacaExemplo[] = [
  { brinco: '101', nome: 'Mimosa', raca: 'Girolando', nascimento: 5 * ANOS, del: 95, lactacao: 3, mediaDia: 22, cmt: ['N', 'N', 'N', 'N'], ccs: 180000 },
  { brinco: '102', nome: 'Estrela', raca: 'Girolando', nascimento: 6 * ANOS, del: 140, lactacao: 4, mediaDia: 19.5, cmt: ['N', 'T', 'N', 'N'], ccs: 290000 },
  { brinco: '103', nome: 'Jurema', raca: 'Holandês', nascimento: 4 * ANOS, del: 48, lactacao: 2, mediaDia: 26, cmt: ['N', 'N', 'N', 'N'] },
  {
    brinco: '104',
    nome: 'Malhada',
    raca: 'Girolando',
    nascimento: 7 * ANOS,
    del: 210,
    lactacao: 5,
    mediaDia: 13,
    cmt: ['2', 'N', '3', 'T'],
    ccs: 1250000,
    observacoes: 'Quarto posterior direito endurecido; em tratamento de mastite.',
  },
  { brinco: '105', nome: 'Pintada', raca: 'Girolando', nascimento: 5 * ANOS, del: 165, lactacao: 3, mediaDia: 17, cmt: ['N', 'N', 'T', 'N'], ccs: 410000 },
  { brinco: '106', nome: 'Formosa', raca: 'Gir', nascimento: 6 * ANOS, del: 72, lactacao: 4, mediaDia: 20, cmt: ['N', 'N', 'N', 'N'] },
  { brinco: '107', nome: 'Bonita', raca: 'Holandês', nascimento: 4 * ANOS, del: 30, lactacao: 1, mediaDia: 24.5, cmt: ['N', 'N', 'N', 'N'], ccs: 150000 },
  {
    brinco: '108',
    nome: 'Lua',
    raca: 'Girolando',
    nascimento: 8 * ANOS,
    del: 275,
    lactacao: 6,
    mediaDia: 9,
    cmt: ['T', 'N', 'N', 'PP'],
    observacoes: 'Peito perdido no posterior esquerdo. Candidata a secagem.',
  },
  {
    brinco: '109',
    nome: 'Cravina',
    raca: 'Girolando',
    nascimento: 6 * ANOS,
    del: 320,
    lactacao: 4,
    mediaDia: 0,
    seca: true,
    observacoes: 'Secou há 35 dias. Parto previsto para o mês que vem.',
  },
  {
    brinco: '110',
    nome: 'Dourada',
    raca: 'Gir',
    nascimento: 5 * ANOS,
    del: 300,
    lactacao: 2,
    mediaDia: 0,
    seca: true,
    observacoes: 'Pré-parto, no lote das secas.',
  },
];

/** Datas no formato que a importação lê sem ambiguidade. */
function iso(referencia: Date, diasAtras: number): string {
  const d = new Date(referencia.getTime() - diasAtras * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

function umaCasa(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Pesagens de leite das três últimas semanas.
 *
 * A variação é determinística (uma onda, não um sorteio): a planilha baixada
 * hoje e a baixada amanhã contam a mesma história, e o gráfico de produção não
 * sai uma linha reta.
 */
function controleLeiteiro(hoje: Date): LinhaPlanilha[] {
  const linhas: LinhaPlanilha[] = [];
  const diasDePesagem = [1, 8, 15];
  for (const [indiceVaca, vaca] of VACAS.entries()) {
    if (vaca.seca) continue;
    for (const [indiceDia, diasAtras] of diasDePesagem.entries()) {
      const variacao = 1 + 0.06 * Math.sin(indiceVaca + indiceDia * 1.7);
      const total = vaca.mediaDia * variacao;
      linhas.push({
        Brinco: vaca.brinco,
        Data: iso(hoje, diasAtras),
        'Litros da manhã': umaCasa(total * 0.6),
        'Litros da tarde': umaCasa(total * 0.4),
        Observações: '',
      });
    }
  }
  return linhas;
}

/** Leite do dia na propriedade inteira, na semana passada. */
function producaoPropriedade(hoje: Date): LinhaPlanilha[] {
  const somaDasVacas = VACAS.reduce((s, v) => s + v.mediaDia, 0);
  return [1, 2, 3, 4, 5, 6, 7].map((diasAtras) => {
    const total = somaDasVacas * (1 + 0.04 * Math.sin(diasAtras));
    const bezerros = 12;
    const consumo = 6;
    const derivados = diasAtras === 3 ? 20 : 0;
    return {
      Data: iso(hoje, diasAtras),
      'Vendido (L)': umaCasa(Math.max(total - bezerros - consumo - derivados, 0)),
      'Bezerros (L)': bezerros,
      'Consumo e doação (L)': consumo,
      'Derivados (L)': derivados,
    };
  });
}

/**
 * Monta o conteúdo do exemplo.
 *
 * `hoje` é parâmetro para os testes — e porque "hoje" dentro de uma função pura
 * é exatamente o tipo de coisa que quebra a suíte à meia-noite.
 */
export function conteudoExemplo(hoje: Date = new Date()): ConteudoPlanilha {
  const d = (diasAtras: number) => iso(hoje, diasAtras);

  return {
    Propriedade: [
      {
        'Nome da propriedade': 'Sítio Boa Esperança (exemplo)',
        'Área própria (ha)': 28,
        'Área arrendada (ha)': 12,
        'Pessoas na mão de obra': 2,
        'Preço recebido por litro (R$)': 2.35,
        'Mão de obra familiar (R$/mês)': 1800,
        'Reposição de investimento (R$/mês)': 900,
        'Dias de gestação': 283,
      },
    ],

    Lotes: [
      { Lote: LOTE_LACTACAO, Descrição: 'Vacas sendo ordenhadas duas vezes ao dia' },
      { Lote: LOTE_SECAS, Descrição: 'Vacas secas e em pré-parto' },
      { Lote: LOTE_RECRIA, Descrição: 'Bezerras e novilhas' },
    ],

    Animais: [
      ...VACAS.map((vaca) => ({
        Brinco: vaca.brinco,
        Nome: vaca.nome,
        Tatuagem: '',
        Categoria: vaca.seca ? 'vaca_seca' : 'vaca_lactacao',
        'Sexo (F/M)': 'F',
        Raça: vaca.raca,
        Nascimento: d(vaca.nascimento),
        'Peso ao nascer (kg)': '',
        'Peso na entrada (kg)': '',
        'Idade estimada (meses)': '',
        'Referência da idade estimada': '',
        'Pelagem / sinal': '',
        Pai: '',
        Mãe: '',
        Lote: vaca.seca ? LOTE_SECAS : LOTE_LACTACAO,
        Situação: vaca.brinco === '104' ? 'em_tratamento' : 'saudavel',
        Origem: 'nascimento',
        'Entrada no rebanho': d(vaca.nascimento),
        Procedência: '',
        'Valor de aquisição (R$)': '',
        'Número da GTA': '',
        'Histórico sanitário': '',
        'Situação reprodutiva': vaca.seca ? 'prenhe' : '',
        'Último parto': d(vaca.del),
        'Lactações até hoje': vaca.lactacao,
        Observações: vaca.observacoes ?? '',
      })),
      {
        Brinco: '201',
        Nome: 'Serena',
        Categoria: 'novilha',
        'Sexo (F/M)': 'F',
        Raça: 'Girolando',
        Nascimento: d(2 * ANOS),
        Lote: LOTE_RECRIA,
        Situação: 'saudavel',
        Origem: 'nascimento',
        'Entrada no rebanho': d(2 * ANOS),
        Observações: 'Apta para a primeira cobertura.',
      },
      {
        Brinco: '202',
        Nome: 'Aurora',
        Categoria: 'novilha',
        'Sexo (F/M)': 'F',
        Raça: 'Holandês',
        Nascimento: d(Math.round(1.8 * ANOS)),
        Lote: LOTE_RECRIA,
        Situação: 'saudavel',
        Origem: 'compra',
        'Entrada no rebanho': d(120),
        Procedência: 'Fazenda São Vicente',
        'Valor de aquisição (R$)': 4200,
        'Número da GTA': 'GTA-2026-004512',
        Observações: 'Comprada com GTA; cumpriu quarentena.',
      },
      {
        Brinco: '301',
        Nome: 'Bela',
        Categoria: 'bezerra_1_2_anos',
        'Sexo (F/M)': 'F',
        Raça: 'Girolando',
        Nascimento: d(400),
        Lote: LOTE_RECRIA,
        Situação: 'saudavel',
        Origem: 'nascimento',
        'Entrada no rebanho': d(400),
        Mãe: 'Mimosa',
      },
      {
        Brinco: '302',
        Nome: 'Trovão',
        Categoria: 'bezerro_mamando',
        'Sexo (F/M)': 'M',
        Raça: 'Girolando',
        Nascimento: d(30),
        Lote: LOTE_RECRIA,
        Situação: 'saudavel',
        Origem: 'nascimento',
        'Entrada no rebanho': d(30),
        Mãe: 'Bonita',
        Observações: 'Filho do parto mais recente; será vendido desmamado.',
      },
    ],

    Lactacoes: VACAS.map((vaca) => ({
      Brinco: vaca.brinco,
      'Número da lactação': vaca.lactacao,
      'Data do parto': d(vaca.del),
      'Secagem prevista': d(vaca.del - 305),
      'Secagem real': vaca.seca ? d(35) : '',
      'Encerrada (sim/não)': vaca.seca ? 'sim' : 'não',
    })),

    ControleLeiteiro: controleLeiteiro(hoje),
    ProducaoPropriedade: producaoPropriedade(hoje),

    ExamesCMT: VACAS.filter((v) => v.cmt).map((vaca) => ({
      Brinco: vaca.brinco,
      Data: d(5),
      'Anterior direito': vaca.cmt![0],
      'Anterior esquerdo': vaca.cmt![1],
      'Posterior direito': vaca.cmt![2],
      'Posterior esquerdo': vaca.cmt![3],
    })),

    ExamesCCS: [
      // Sem brinco e marcado como tanque: é a CCS do leite entregue.
      { Brinco: '', 'É do tanque (sim/não)': 'sim', Data: d(40), 'Células por mL': 540000 },
      { Brinco: '', 'É do tanque (sim/não)': 'sim', Data: d(10), 'Células por mL': 620000 },
      ...VACAS.filter((v) => v.ccs).map((vaca) => ({
        Brinco: vaca.brinco,
        'É do tanque (sim/não)': 'não',
        Data: d(10),
        'Células por mL': vaca.ccs!,
      })),
    ],

    Medicamentos: [
      {
        Medicamento: 'Mastijet Fort',
        'Princípio ativo': 'Tetraciclina + neomicina + bacitracina',
        Apresentação: 'Bisnaga intramamária 8 g',
        'Custo por unidade (R$)': 18.5,
        'Carência leite (dias)': 4,
        'Carência carne (dias)': 21,
        Estoque: 12,
        Validade: d(-400),
      },
      {
        Medicamento: 'Oxitetraciclina LA',
        'Princípio ativo': 'Oxitetraciclina 20%',
        Apresentação: 'Frasco 50 mL',
        'Custo por unidade (R$)': 62,
        'Carência leite (dias)': 5,
        'Carência carne (dias)': 28,
        Estoque: 2,
        Validade: d(-300),
      },
      {
        Medicamento: 'Ivermectina 1%',
        'Princípio ativo': 'Ivermectina',
        Apresentação: 'Frasco 500 mL',
        'Custo por unidade (R$)': 95,
        'Carência leite (dias)': 0,
        'Carência carne (dias)': 35,
        Estoque: 1,
        Validade: d(-500),
      },
    ],

    Tratamentos: [
      {
        Brinco: '104',
        Medicamento: 'Mastijet Fort',
        Dose: '1 bisnaga por quarto, 12/12 h',
        Via: 'intramamária',
        Início: d(2),
        Fim: d(-1),
        'Carência do leite até': d(-5),
        'Carência da carne até': d(-22),
        Responsável: 'João (produtor)',
        'Custo total (R$)': 74,
        Observações: 'Mastite clínica no posterior direito. Leite descartado.',
      },
      {
        Brinco: '105',
        Medicamento: 'Oxitetraciclina LA',
        Dose: '20 mL',
        Via: 'intramuscular',
        Início: d(45),
        Fim: d(45),
        'Carência do leite até': d(40),
        'Carência da carne até': d(17),
        Responsável: 'Veterinário',
        'Custo total (R$)': 62,
        Observações: 'Casco com ferida infeccionada.',
      },
    ],

    Vacinas: [
      { Vacina: 'Febre aftosa', 'Doença alvo': 'Febre aftosa', 'Intervalo (meses)': 6, 'Obrigatória (sim/não)': 'sim' },
      { Vacina: 'Brucelose B19', 'Doença alvo': 'Brucelose', 'Intervalo (meses)': 0, 'Obrigatória (sim/não)': 'sim' },
      { Vacina: 'Clostridiose polivalente', 'Doença alvo': 'Carbúnculo e demais clostridioses', 'Intervalo (meses)': 12, 'Obrigatória (sim/não)': 'não' },
    ],

    Vacinacoes: [
      { Brinco: '101', Vacina: 'Febre aftosa', Data: d(100), 'Lote da vacina': 'AFT-2026-11', Responsável: 'João (produtor)', 'Custo (R$)': 3.5, 'Próxima dose': d(-80) },
      { Brinco: '102', Vacina: 'Febre aftosa', Data: d(100), 'Lote da vacina': 'AFT-2026-11', Responsável: 'João (produtor)', 'Custo (R$)': 3.5, 'Próxima dose': d(-80) },
      { Brinco: '103', Vacina: 'Febre aftosa', Data: d(100), 'Lote da vacina': 'AFT-2026-11', Responsável: 'João (produtor)', 'Custo (R$)': 3.5, 'Próxima dose': d(-80) },
      { Brinco: '201', Vacina: 'Brucelose B19', Data: d(560), 'Lote da vacina': 'B19-2025-03', Responsável: 'Veterinário', 'Custo (R$)': 12, 'Próxima dose': '' },
      { Brinco: '301', Vacina: 'Clostridiose polivalente', Data: d(330), 'Lote da vacina': 'CLO-2026-02', Responsável: 'João (produtor)', 'Custo (R$)': 4.2, 'Próxima dose': d(35) },
    ],

    Coberturas: [
      { Brinco: '109', Data: d(250), 'Touro / sêmen': 'Girolando — touro Vulcão', Tipo: 'ia', 'Número no ciclo': 1, 'Parto previsto': d(-33), 'Prenhez confirmada (sim/não)': 'sim', Observação: '' },
      { Brinco: '110', Data: d(230), 'Touro / sêmen': 'Gir — touro Marajá', Tipo: 'iatf', 'Número no ciclo': 2, 'Parto previsto': d(-53), 'Prenhez confirmada (sim/não)': 'sim', Observação: '' },
      { Brinco: '103', Data: d(20), 'Touro / sêmen': 'Holandês — touro Nobre', Tipo: 'ia', 'Número no ciclo': 1, 'Parto previsto': d(-263), 'Prenhez confirmada (sim/não)': 'não', Observação: 'Aguardando diagnóstico de gestação.' },
      { Brinco: '201', Data: d(12), 'Touro / sêmen': 'Girolando — touro Vulcão', Tipo: 'ia', 'Número no ciclo': 1, 'Parto previsto': d(-271), 'Prenhez confirmada (sim/não)': 'não', Observação: 'Primeira cobertura da novilha.' },
    ],

    // Nenhuma morte no exemplo — a aba sai só com o cabeçalho, para o produtor
    // ver onde registrar quando acontecer.
    Mortes: [],

    Despesas: [
      { Data: d(25), Categoria: 'concentrados_sal', Descrição: 'Ração 18% — 1 t', 'Valor (R$)': 2150, 'Brinco (se for de um animal)': '' },
      { Data: d(22), Categoria: 'sanidade_medicamentos', Descrição: 'Bisnagas para mastite', 'Valor (R$)': 222, 'Brinco (se for de um animal)': '104' },
      { Data: d(18), Categoria: 'energia_eletrica', Descrição: 'Conta de luz da sala de ordenha', 'Valor (R$)': 310, 'Brinco (se for de um animal)': '' },
      { Data: d(15), Categoria: 'mao_de_obra_fixa', Descrição: 'Diarista — 12 diárias', 'Valor (R$)': 1440, 'Brinco (se for de um animal)': '' },
      { Data: d(10), Categoria: 'volumoso', Descrição: 'Silagem de milho', 'Valor (R$)': 1800, 'Brinco (se for de um animal)': '' },
      { Data: d(7), Categoria: 'reproducao', Descrição: 'Doses de sêmen e botijão', 'Valor (R$)': 380, 'Brinco (se for de um animal)': '' },
      { Data: d(5), Categoria: 'combustivel', Descrição: 'Diesel do trator', 'Valor (R$)': 420, 'Brinco (se for de um animal)': '' },
    ],

    Receitas: [
      { Data: d(20), Categoria: 'venda_leite', Descrição: 'Leite entregue na primeira quinzena', 'Valor (R$)': 6180, 'Brinco (se for de um animal)': '' },
      { Data: d(5), Categoria: 'venda_leite', Descrição: 'Leite entregue na segunda quinzena', 'Valor (R$)': 5940, 'Brinco (se for de um animal)': '' },
      { Data: d(12), Categoria: 'venda_animais', Descrição: 'Bezerro desmamado', 'Valor (R$)': 1100, 'Brinco (se for de um animal)': '' },
      { Data: d(3), Categoria: 'outras_vendas', Descrição: 'Queijo artesanal na feira', 'Valor (R$)': 240, 'Brinco (se for de um animal)': '' },
    ],

    Eventos: [
      { Tipo: 'vacinacao', Título: 'Aftosa — etapa de maio', Data: d(-80), Brinco: '', Lote: LOTE_LACTACAO, Descrição: 'Vacinar todo o rebanho.', Situação: 'pendente' },
      { Tipo: 'secagem', Título: 'Secar a vaca Lua (108)', Data: d(-15), Brinco: '108', Lote: '', Descrição: 'Lactação longa e peito perdido.', Situação: 'pendente' },
      { Tipo: 'cmt', Título: 'CMT do lote em lactação', Data: d(-25), Brinco: '', Lote: LOTE_LACTACAO, Descrição: 'Repetir o teste a cada 30 dias.', Situação: 'pendente' },
      { Tipo: 'parto', Título: 'Parto previsto — Cravina (109)', Data: d(-33), Brinco: '109', Lote: LOTE_SECAS, Descrição: 'Separar no piquete maternidade.', Situação: 'pendente' },
    ],
  };
}
