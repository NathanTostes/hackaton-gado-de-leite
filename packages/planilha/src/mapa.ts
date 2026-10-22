/**
 * O mapa entre a planilha e o banco.
 *
 * Uma aba por tabela, cabeçalho em português, e referência por aquilo que o
 * produtor conhece: o **brinco** do animal e o **nome** do lote, do medicamento
 * e da vacina — nunca o id interno. Quem preenche a planilha é gente, não o
 * sistema; id em planilha é convite a erro de digitação silencioso.
 *
 * Este arquivo é só descrição. Quem lê e escreve o arquivo `.xlsx` é
 * `arquivo.ts`; quem converte linha a linha é `conversao.ts`.
 */

export type TipoColuna = 'texto' | 'numero' | 'inteiro' | 'data' | 'booleano';

/** Referência a outra tabela, resolvida pelo nome que o produtor usa. */
export type Referencia = 'animal' | 'lote' | 'medicamento' | 'vacina';

export interface ColunaPlanilha {
  /** Coluna correspondente no banco. */
  coluna: string;
  /** Cabeçalho que aparece na planilha. */
  titulo: string;
  tipo: TipoColuna;
  obrigatoria?: boolean;
  referencia?: Referencia;
  /** Valores aceitos, quando a coluna é um domínio fechado. */
  valores?: readonly string[];
  exemplo?: string | number;
  nota?: string;
}

export interface AbaPlanilha {
  /** Nome da aba no arquivo (limite de 31 caracteres do Excel). */
  nome: string;
  tabela: string;
  descricao: string;
  colunas: ColunaPlanilha[];
  /** Tabela de uma linha só (a propriedade). */
  linhaUnica?: boolean;
  /** Colunas calculadas na importação, a partir das outras. */
  derivar?: (linha: Record<string, string | number | null>) => Record<string, string | number | null>;
}

const CATEGORIAS = [
  'vaca_lactacao',
  'vaca_seca',
  'novilha',
  'bezerra_1_2_anos',
  'bezerro_desmamado',
  'bezerro_mamando',
  'touro',
  'novilho',
  'boi_carro',
] as const;

const STATUS = [
  'saudavel',
  'suspeito',
  'em_tratamento',
  'em_carencia',
  'mastite_cronica',
  'quarentena',
  'descartado',
  'morto',
  'vendido',
] as const;

const RESULTADOS_CMT = ['N', 'T', '1', '2', '3', 'PP'] as const;

function numeroDe(coluna: string, titulo: string, exemplo?: number): ColunaPlanilha {
  return { coluna, titulo, tipo: 'numero', exemplo };
}

export const ABAS: AbaPlanilha[] = [
  {
    nome: 'Propriedade',
    tabela: 'propriedade',
    linhaUnica: true,
    descricao: 'Dados da fazenda. Uma linha só.',
    colunas: [
      { coluna: 'nome', titulo: 'Nome da propriedade', tipo: 'texto', obrigatoria: true, exemplo: 'Sítio Boa Esperança' },
      { coluna: 'estado', titulo: 'Estado (UF)', tipo: 'texto', exemplo: 'MG' },
      { coluna: 'cidade', titulo: 'Cidade', tipo: 'texto', exemplo: 'Juiz de Fora' },
      { coluna: 'pais', titulo: 'País', tipo: 'texto', exemplo: 'Brasil' },
      { coluna: 'tipo_pasto', titulo: 'Tipo de pasto', tipo: 'texto', exemplo: 'Braquiária' },
      numeroDe('area_propria_ha', 'Área própria (ha)', 28),
      numeroDe('area_arrendada_ha', 'Área arrendada (ha)', 20),
      { coluna: 'mao_de_obra_pessoas', titulo: 'Pessoas na mão de obra', tipo: 'inteiro', exemplo: 2 },
      numeroDe('preco_leite_litro', 'Preço recebido por litro (R$)', 1.07),
      numeroDe('mao_de_obra_familiar_mes', 'Mão de obra familiar (R$/mês)', 1500),
      numeroDe('reposicao_investimento_mes', 'Reposição de investimento (R$/mês)', 800),
      { coluna: 'gestacao_dias', titulo: 'Dias de gestação', tipo: 'inteiro', exemplo: 283 },
    ],
  },
  {
    nome: 'Lotes',
    tabela: 'lote',
    descricao: 'Grupos de manejo. O nome é o que identifica o lote nas outras abas.',
    colunas: [
      { coluna: 'nome', titulo: 'Lote', tipo: 'texto', obrigatoria: true, exemplo: 'Vacas em lactação' },
      { coluna: 'descricao', titulo: 'Descrição', tipo: 'texto' },
    ],
  },
  {
    nome: 'Animais',
    tabela: 'animal',
    descricao: 'O rebanho. O brinco identifica o animal nas demais abas e não pode repetir.',
    colunas: [
      { coluna: 'brinco', titulo: 'Brinco', tipo: 'texto', obrigatoria: true, exemplo: '101' },
      { coluna: 'nome', titulo: 'Nome', tipo: 'texto', exemplo: 'Mimosa' },
      { coluna: 'tatuagem', titulo: 'Tatuagem', tipo: 'texto' },
      { coluna: 'categoria', titulo: 'Categoria', tipo: 'texto', obrigatoria: true, valores: CATEGORIAS, exemplo: 'vaca_lactacao' },
      { coluna: 'sexo', titulo: 'Sexo (F/M)', tipo: 'texto', obrigatoria: true, valores: ['F', 'M'], exemplo: 'F' },
      { coluna: 'raca', titulo: 'Raça', tipo: 'texto', exemplo: 'Girolando' },
      { coluna: 'data_nascimento', titulo: 'Nascimento', tipo: 'data', exemplo: '2021-03-15' },
      numeroDe('peso_nascimento', 'Peso ao nascer (kg)'),
      numeroDe('peso_entrada', 'Peso na entrada (kg)'),
      { coluna: 'idade_estimada_meses', titulo: 'Idade estimada (meses)', tipo: 'inteiro' },
      { coluna: 'idade_estimada_em', titulo: 'Referência da idade estimada', tipo: 'data' },
      { coluna: 'pelagem_sinal', titulo: 'Pelagem / sinal', tipo: 'texto' },
      { coluna: 'pai_nome', titulo: 'Pai', tipo: 'texto' },
      { coluna: 'mae_nome', titulo: 'Mãe', tipo: 'texto' },
      { coluna: 'lote_id', titulo: 'Lote', tipo: 'texto', referencia: 'lote' },
      { coluna: 'status', titulo: 'Situação', tipo: 'texto', valores: STATUS, exemplo: 'saudavel' },
      { coluna: 'origem', titulo: 'Origem', tipo: 'texto', valores: ['nascimento', 'compra', 'transferencia', 'doacao'], exemplo: 'nascimento' },
      { coluna: 'data_entrada', titulo: 'Entrada no rebanho', tipo: 'data' },
      { coluna: 'data_saida', titulo: 'Data de saída', tipo: 'data' },
      { coluna: 'motivo_saida', titulo: 'Motivo de saída', tipo: 'texto' },
      { coluna: 'procedencia', titulo: 'Procedência', tipo: 'texto' },
      numeroDe('valor_aquisicao', 'Valor de aquisição (R$)'),
      { coluna: 'numero_gta', titulo: 'Número da GTA', tipo: 'texto' },
      { coluna: 'historico_sanitario', titulo: 'Histórico sanitário', tipo: 'texto' },
      { coluna: 'situacao_reprodutiva', titulo: 'Situação reprodutiva', tipo: 'texto' },
      { coluna: 'ultimo_parto_entrada', titulo: 'Último parto', tipo: 'data' },
      { coluna: 'numero_lactacoes_entrada', titulo: 'Lactações até hoje', tipo: 'inteiro' },
      { coluna: 'observacoes', titulo: 'Observações', tipo: 'texto' },
    ],
  },
  {
    nome: 'Lactacoes',
    tabela: 'lactacao',
    descricao: 'Partos e secagens. Uma linha por lactação do animal.',
    colunas: [
      { coluna: 'animal_id', titulo: 'Brinco', tipo: 'texto', obrigatoria: true, referencia: 'animal' },
      { coluna: 'numero', titulo: 'Número da lactação', tipo: 'inteiro', obrigatoria: true, exemplo: 3 },
      { coluna: 'data_parto', titulo: 'Data do parto', tipo: 'data', obrigatoria: true },
      { coluna: 'data_secagem_prevista', titulo: 'Secagem prevista', tipo: 'data' },
      { coluna: 'data_secagem_real', titulo: 'Secagem real', tipo: 'data' },
      { coluna: 'encerrada', titulo: 'Encerrada (sim/não)', tipo: 'booleano' },
    ],
  },
  {
    nome: 'ControleLeiteiro',
    tabela: 'controle_leiteiro',
    descricao: 'Pesagem de leite por vaca. O total é somado automaticamente.',
    derivar: (l) => ({
      litros_total: Number(l.litros_manha ?? 0) + Number(l.litros_tarde ?? 0),
    }),
    colunas: [
      { coluna: 'animal_id', titulo: 'Brinco', tipo: 'texto', obrigatoria: true, referencia: 'animal' },
      { coluna: 'data', titulo: 'Data', tipo: 'data', obrigatoria: true },
      numeroDe('litros_manha', 'Litros da manhã', 8.5),
      numeroDe('litros_tarde', 'Litros da tarde', 6.5),
      { coluna: 'observacoes', titulo: 'Observações', tipo: 'texto' },
    ],
  },
  {
    nome: 'ProducaoPropriedade',
    tabela: 'producao_propriedade',
    descricao: 'Destino do leite do dia na propriedade inteira. O total é somado automaticamente.',
    derivar: (l) => ({
      litros_total:
        Number(l.litros_vendidos ?? 0) +
        Number(l.litros_bezerros ?? 0) +
        Number(l.litros_consumo_doacao ?? 0) +
        Number(l.litros_derivados ?? 0),
    }),
    colunas: [
      { coluna: 'data', titulo: 'Data', tipo: 'data', obrigatoria: true },
      numeroDe('litros_vendidos', 'Vendido (L)'),
      numeroDe('litros_bezerros', 'Bezerros (L)'),
      numeroDe('litros_consumo_doacao', 'Consumo e doação (L)'),
      numeroDe('litros_derivados', 'Derivados (L)'),
    ],
  },
  {
    nome: 'ExamesCMT',
    tabela: 'exame_cmt',
    descricao: 'CMT por quarto mamário: N, T, 1, 2, 3 ou PP (peito perdido).',
    colunas: [
      { coluna: 'animal_id', titulo: 'Brinco', tipo: 'texto', obrigatoria: true, referencia: 'animal' },
      { coluna: 'data', titulo: 'Data', tipo: 'data', obrigatoria: true },
      { coluna: 'ad', titulo: 'Anterior direito', tipo: 'texto', valores: RESULTADOS_CMT },
      { coluna: 'ae', titulo: 'Anterior esquerdo', tipo: 'texto', valores: RESULTADOS_CMT },
      { coluna: 'pd', titulo: 'Posterior direito', tipo: 'texto', valores: RESULTADOS_CMT },
      { coluna: 'pe', titulo: 'Posterior esquerdo', tipo: 'texto', valores: RESULTADOS_CMT },
    ],
  },
  {
    nome: 'ExamesCCS',
    tabela: 'exame_ccs',
    descricao: 'Contagem de células somáticas. Deixe o brinco em branco quando for o tanque.',
    colunas: [
      { coluna: 'animal_id', titulo: 'Brinco', tipo: 'texto', referencia: 'animal' },
      { coluna: 'tanque', titulo: 'É do tanque (sim/não)', tipo: 'booleano' },
      { coluna: 'data', titulo: 'Data', tipo: 'data', obrigatoria: true },
      numeroDe('celulas_ml', 'Células por mL', 320000),
    ],
  },
  {
    nome: 'Medicamentos',
    tabela: 'medicamento',
    descricao: 'Estoque de medicamentos. O nome identifica o medicamento na aba de tratamentos.',
    colunas: [
      { coluna: 'nome', titulo: 'Medicamento', tipo: 'texto', obrigatoria: true },
      { coluna: 'principio_ativo', titulo: 'Princípio ativo', tipo: 'texto' },
      { coluna: 'apresentacao', titulo: 'Apresentação', tipo: 'texto' },
      numeroDe('custo_unidade', 'Custo por unidade (R$)'),
      { coluna: 'carencia_leite_dias', titulo: 'Carência leite (dias)', tipo: 'inteiro' },
      { coluna: 'carencia_carne_dias', titulo: 'Carência carne (dias)', tipo: 'inteiro' },
      numeroDe('estoque', 'Estoque'),
      { coluna: 'validade', titulo: 'Validade', tipo: 'data' },
    ],
  },
  {
    nome: 'Tratamentos',
    tabela: 'tratamento',
    descricao: 'Tratamentos aplicados. É esta aba que alimenta a análise de tratamentos × produção.',
    colunas: [
      { coluna: 'animal_id', titulo: 'Brinco', tipo: 'texto', obrigatoria: true, referencia: 'animal' },
      { coluna: 'medicamento_id', titulo: 'Medicamento', tipo: 'texto', referencia: 'medicamento' },
      { coluna: 'dose', titulo: 'Dose', tipo: 'texto' },
      { coluna: 'via', titulo: 'Via', tipo: 'texto' },
      { coluna: 'data_inicio', titulo: 'Início', tipo: 'data', obrigatoria: true },
      { coluna: 'data_fim', titulo: 'Fim', tipo: 'data' },
      { coluna: 'carencia_leite_ate', titulo: 'Carência do leite até', tipo: 'data' },
      { coluna: 'carencia_carne_ate', titulo: 'Carência da carne até', tipo: 'data' },
      { coluna: 'responsavel', titulo: 'Responsável', tipo: 'texto' },
      numeroDe('custo_total', 'Custo total (R$)'),
      { coluna: 'observacoes', titulo: 'Observações', tipo: 'texto' },
    ],
  },
  {
    nome: 'Vacinas',
    tabela: 'vacina',
    descricao: 'Vacinas usadas na propriedade.',
    colunas: [
      { coluna: 'nome', titulo: 'Vacina', tipo: 'texto', obrigatoria: true },
      { coluna: 'doenca_alvo', titulo: 'Doença alvo', tipo: 'texto' },
      { coluna: 'intervalo_meses', titulo: 'Intervalo (meses)', tipo: 'inteiro' },
      { coluna: 'obrigatoria', titulo: 'Obrigatória (sim/não)', tipo: 'booleano' },
    ],
  },
  {
    nome: 'Vacinacoes',
    tabela: 'vacinacao',
    descricao: 'Aplicações de vacina.',
    colunas: [
      { coluna: 'animal_id', titulo: 'Brinco', tipo: 'texto', obrigatoria: true, referencia: 'animal' },
      { coluna: 'vacina_id', titulo: 'Vacina', tipo: 'texto', obrigatoria: true, referencia: 'vacina' },
      { coluna: 'data', titulo: 'Data', tipo: 'data', obrigatoria: true },
      { coluna: 'lote', titulo: 'Lote da vacina', tipo: 'texto' },
      { coluna: 'responsavel', titulo: 'Responsável', tipo: 'texto' },
      numeroDe('custo', 'Custo (R$)'),
      { coluna: 'proxima_dose', titulo: 'Próxima dose', tipo: 'data' },
    ],
  },
  {
    nome: 'Coberturas',
    tabela: 'cobertura',
    descricao: 'Inseminações e montas.',
    colunas: [
      { coluna: 'animal_id', titulo: 'Brinco', tipo: 'texto', obrigatoria: true, referencia: 'animal' },
      { coluna: 'data', titulo: 'Data', tipo: 'data', obrigatoria: true },
      { coluna: 'touro_nome', titulo: 'Touro / sêmen', tipo: 'texto' },
      { coluna: 'tipo', titulo: 'Tipo', tipo: 'texto', valores: ['ia', 'monta', 'iatf'], exemplo: 'ia' },
      { coluna: 'numero_no_ciclo', titulo: 'Número no ciclo', tipo: 'inteiro' },
      { coluna: 'data_provavel_parto', titulo: 'Parto previsto', tipo: 'data' },
      { coluna: 'confirmada_prenhe', titulo: 'Prenhez confirmada (sim/não)', tipo: 'booleano' },
      { coluna: 'observacao', titulo: 'Observação', tipo: 'texto' },
    ],
  },
  {
    nome: 'Mortes',
    tabela: 'morte',
    descricao: 'Mortes registradas.',
    colunas: [
      { coluna: 'animal_id', titulo: 'Brinco', tipo: 'texto', obrigatoria: true, referencia: 'animal' },
      { coluna: 'data', titulo: 'Data', tipo: 'data', obrigatoria: true },
      { coluna: 'hora', titulo: 'Hora (HH:mm)', tipo: 'texto' },
      { coluna: 'categoria_na_morte', titulo: 'Categoria na morte', tipo: 'texto' },
      { coluna: 'causa', titulo: 'Causa', tipo: 'texto', obrigatoria: true },
      { coluna: 'orientacoes', titulo: 'Orientações', tipo: 'texto' },
    ],
  },
  {
    nome: 'Despesas',
    tabela: 'despesa',
    descricao: 'Despesas nas categorias da planilha da Embrapa.',
    colunas: [
      { coluna: 'data', titulo: 'Data', tipo: 'data', obrigatoria: true },
      { coluna: 'categoria', titulo: 'Categoria', tipo: 'texto', obrigatoria: true, exemplo: 'concentrado' },
      { coluna: 'descricao', titulo: 'Descrição', tipo: 'texto' },
      { coluna: 'valor', titulo: 'Valor (R$)', tipo: 'numero', obrigatoria: true },
      { coluna: 'animal_id', titulo: 'Brinco (se for de um animal)', tipo: 'texto', referencia: 'animal' },
    ],
  },
  {
    nome: 'Receitas',
    tabela: 'receita',
    descricao: 'Receitas nas categorias da planilha da Embrapa.',
    colunas: [
      { coluna: 'data', titulo: 'Data', tipo: 'data', obrigatoria: true },
      { coluna: 'categoria', titulo: 'Categoria', tipo: 'texto', obrigatoria: true, exemplo: 'leite' },
      { coluna: 'destinatario', titulo: 'Destinatário', tipo: 'texto' },
      { coluna: 'descricao', titulo: 'Descrição', tipo: 'texto' },
      { coluna: 'valor', titulo: 'Valor (R$)', tipo: 'numero', obrigatoria: true },
      { coluna: 'animal_id', titulo: 'Brinco (se for de um animal)', tipo: 'texto', referencia: 'animal' },
    ],
  },
  {
    nome: 'Eventos',
    tabela: 'evento_calendario',
    descricao: 'Calendário sanitário e de tarefas.',
    colunas: [
      { coluna: 'tipo', titulo: 'Tipo', tipo: 'texto', obrigatoria: true, exemplo: 'vacinacao' },
      { coluna: 'titulo', titulo: 'Título', tipo: 'texto', obrigatoria: true },
      { coluna: 'data', titulo: 'Data', tipo: 'data', obrigatoria: true },
      { coluna: 'animal_id', titulo: 'Brinco', tipo: 'texto', referencia: 'animal' },
      { coluna: 'lote_id', titulo: 'Lote', tipo: 'texto', referencia: 'lote' },
      { coluna: 'descricao', titulo: 'Descrição', tipo: 'texto' },
      { coluna: 'status', titulo: 'Situação', tipo: 'texto', valores: ['pendente', 'feito', 'concluido', 'atrasado', 'cancelado'] },
    ],
  },
];

export const ABA_POR_NOME = new Map(ABAS.map((a) => [a.nome, a]));

/** Nome da aba de instruções, montada a partir das descrições acima. */
export const ABA_INSTRUCOES = 'Leia-me';
