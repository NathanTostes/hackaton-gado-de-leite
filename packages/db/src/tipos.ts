import type { CategoriaAnimal, CategoriaDespesa, CategoriaReceita, ResultadoCMT } from '@drmoo/domain';

export type StatusAnimal =
  | 'saudavel'
  | 'suspeito'
  | 'em_tratamento'
  | 'em_carencia'
  | 'mastite_cronica'
  | 'quarentena'
  | 'descartado'
  | 'morto'
  | 'vendido';

export const ROTULO_STATUS: Record<StatusAnimal, string> = {
  saudavel: 'Saudável',
  suspeito: 'Suspeita clínica',
  em_tratamento: 'Em tratamento',
  em_carencia: 'Em carência',
  mastite_cronica: 'Mastite crônica',
  quarentena: 'Quarentena',
  descartado: 'Descartado',
  morto: 'Morto',
  vendido: 'Vendido',
};

export interface Propriedade {
  id: string;
  nome: string;
  estado: string | null;
  cidade: string | null;
  pais: string | null;
  tipo_pasto: string | null;
  area_propria_ha: number;
  area_arrendada_ha: number;
  mao_de_obra_pessoas: number;
  preco_leite_litro: number;
  mao_de_obra_familiar_mes: number;
  reposicao_investimento_mes: number;
  gestacao_dias: number;
}

export interface Animal {
  id: string;
  brinco: string;
  nome: string | null;
  tatuagem: string | null;
  categoria: CategoriaAnimal;
  sexo: 'M' | 'F';
  raca: string | null;
  data_nascimento: string | null;
  peso_nascimento: number | null;
  pelagem_sinal: string | null;
  pai_id: string | null;
  mae_id: string | null;
  pai_nome: string | null;
  mae_nome: string | null;
  idade_estimada_meses: number | null;
  idade_estimada_em: string | null;
  peso_entrada: number | null;
  procedencia: string | null;
  valor_aquisicao: number | null;
  numero_gta: string | null;
  historico_sanitario: string | null;
  situacao_reprodutiva: string | null;
  ultimo_parto_entrada: string | null;
  numero_lactacoes_entrada: number | null;
  lote_id: string | null;
  status: StatusAnimal;
  origem: 'nascimento' | 'compra' | 'transferencia';
  data_entrada: string | null;
  data_saida: string | null;
  motivo_saida: string | null;
  observacoes: string | null;
}

/** Animal com os campos derivados que a lista e a ficha precisam exibir. */
export interface AnimalComResumo extends Animal {
  mae_identificacao: string | null;
  pai_identificacao: string | null;
  lote_nome: string | null;
  data_parto: string | null;
  numero_lactacao: number | null;
  del: number | null;
  producao_media_dia: number | null;
  ultimo_cmt: ResultadoCMT | null;
  data_ultimo_cmt: string | null;
  cmt_positivo_meses: number;
  carencia_leite_ate: string | null;
  tem_peito_perdido: boolean;
  data_provavel_parto: string | null;
  /** Idade em meses: pela data de nascimento ou, na falta dela, pela estimativa do cadastro. */
  idade_meses: number | null;
}

export interface ExameCMT {
  id: string;
  animal_id: string;
  data: string;
  ad: ResultadoCMT | null;
  ae: ResultadoCMT | null;
  pd: ResultadoCMT | null;
  pe: ResultadoCMT | null;
}

export interface Atendimento {
  id: string;
  animal_id: string;
  data_hora: string;
  queixa_principal: string | null;
  kb_versao: string;
  engine_versao: string;
  fatos_iniciais: string;
  respostas: string;
  conclusoes: string;
  traco: string;
  conduta_check: string | null;
  motivo_parada: string | null;
  status: 'rascunho' | 'concluido';
  observacoes: string | null;
}

export interface Medicamento {
  id: string;
  nome: string;
  principio_ativo: string | null;
  apresentacao: string | null;
  custo_unidade: number;
  carencia_leite_dias: number;
  carencia_carne_dias: number;
  estoque: number;
  validade: string | null;
}

export interface Tratamento {
  id: string;
  animal_id: string;
  medicamento_id: string | null;
  atendimento_id: string | null;
  dose: string | null;
  via: string | null;
  data_inicio: string;
  data_fim: string | null;
  carencia_leite_ate: string | null;
  carencia_carne_ate: string | null;
  responsavel: string | null;
  custo_total: number;
  observacoes: string | null;
}

export type TipoEvento =
  | 'vacinacao'
  | 'medicacao'
  | 'consulta'
  | 'exame_cmt'
  | 'exame_ccs'
  | 'secagem'
  | 'parto_previsto'
  | 'desmame'
  | 'quarentena'
  | 'reavaliacao'
  | 'manejo';

export const ROTULO_EVENTO: Record<TipoEvento, string> = {
  vacinacao: 'Vacinação',
  medicacao: 'Medicação',
  consulta: 'Consulta de rotina',
  exame_cmt: 'Teste de CMT',
  exame_ccs: 'Coleta para CCS',
  secagem: 'Secagem',
  parto_previsto: 'Parto previsto',
  desmame: 'Desmame',
  quarentena: 'Quarentena',
  reavaliacao: 'Reavaliação clínica',
  manejo: 'Manejo sanitário',
};

export const ICONE_EVENTO: Record<TipoEvento, string> = {
  vacinacao: 'vaccines',
  medicacao: 'medication',
  consulta: 'medical-services',
  exame_cmt: 'science',
  exame_ccs: 'biotech',
  secagem: 'water-drop',
  parto_previsto: 'child-care',
  desmame: 'restaurant',
  quarentena: 'shield',
  reavaliacao: 'event-repeat',
  manejo: 'pest-control',
};

export interface EventoCalendario {
  id: string;
  tipo: TipoEvento;
  animal_id: string | null;
  lote_id: string | null;
  titulo: string;
  descricao: string | null;
  data: string;
  recorrencia: string | null;
  status: 'pendente' | 'feito' | 'atrasado' | 'cancelado';
  origem: 'manual' | 'regra' | 'automatico';
  referencia_id: string | null;
}

export interface EventoComAnimal extends EventoCalendario {
  atendimento_id?: string | null;
  brinco: string | null;
  animal_nome: string | null;
}

export interface Lancamento {
  id: string;
  data: string;
  categoria: string;
  descricao: string | null;
  valor: number;
  animal_id: string | null;
}

export type { CategoriaAnimal, CategoriaDespesa, CategoriaReceita, ResultadoCMT };
