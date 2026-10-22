/**
 * Esquema do banco local.
 *
 * Tudo roda offline, em SQLite: `expo-sqlite` nativo no Android e o mesmo módulo
 * compilado em WebAssembly no navegador. Nenhuma funcionalidade depende de rede.
 *
 * Convenções: `id TEXT PRIMARY KEY`, timestamps ISO, `deleted_at` para exclusão
 * lógica (prepara a sincronização em rede local, hoje apenas protótipo).
 */
export const SCHEMA_VERSAO = 4;

export const COLUNAS_MORTE = { hora: 'TEXT' } as const;
export const COLUNAS_RECEITA = { destinatario: 'TEXT' } as const;

export const COLUNAS_PROPRIEDADE = {
  estado: 'TEXT',
  cidade: 'TEXT',
  pais: 'TEXT',
  tipo_pasto: 'TEXT',
} as const;

export const COLUNAS_CADASTRO = {
  mae_nome: 'TEXT',
  idade_estimada_meses: 'INTEGER',
  idade_estimada_em: 'TEXT',
  peso_entrada: 'REAL',
  procedencia: 'TEXT',
  valor_aquisicao: 'REAL',
  numero_gta: 'TEXT',
  historico_sanitario: 'TEXT',
  situacao_reprodutiva: 'TEXT',
  ultimo_parto_entrada: 'TEXT',
  numero_lactacoes_entrada: 'INTEGER',
} as const;

export const DDL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS propriedade (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  estado TEXT,
  cidade TEXT,
  pais TEXT,
  tipo_pasto TEXT,
  area_propria_ha REAL NOT NULL DEFAULT 0,
  area_arrendada_ha REAL NOT NULL DEFAULT 0,
  mao_de_obra_pessoas INTEGER NOT NULL DEFAULT 1,
  preco_leite_litro REAL NOT NULL DEFAULT 0,
  mao_de_obra_familiar_mes REAL NOT NULL DEFAULT 0,
  reposicao_investimento_mes REAL NOT NULL DEFAULT 0,
  gestacao_dias INTEGER NOT NULL DEFAULT 283,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lote (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS animal (
  id TEXT PRIMARY KEY,
  brinco TEXT NOT NULL UNIQUE,
  nome TEXT,
  tatuagem TEXT,
  categoria TEXT NOT NULL,
  sexo TEXT NOT NULL,
  raca TEXT,
  data_nascimento TEXT,
  peso_nascimento REAL,
  pelagem_sinal TEXT,
  pai_id TEXT REFERENCES animal(id),
  mae_id TEXT REFERENCES animal(id),
  pai_nome TEXT,
  mae_nome TEXT,
  idade_estimada_meses INTEGER,
  idade_estimada_em TEXT,
  peso_entrada REAL,
  procedencia TEXT,
  valor_aquisicao REAL,
  numero_gta TEXT,
  historico_sanitario TEXT,
  situacao_reprodutiva TEXT,
  ultimo_parto_entrada TEXT,
  numero_lactacoes_entrada INTEGER,
  lote_id TEXT REFERENCES lote(id),
  status TEXT NOT NULL DEFAULT 'saudavel',
  origem TEXT NOT NULL DEFAULT 'nascimento',
  data_entrada TEXT,
  data_saida TEXT,
  motivo_saida TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_animal_categoria ON animal(categoria);
CREATE INDEX IF NOT EXISTS ix_animal_status ON animal(status);
CREATE INDEX IF NOT EXISTS ix_animal_lote ON animal(lote_id);

CREATE TABLE IF NOT EXISTS lactacao (
  id TEXT PRIMARY KEY,
  animal_id TEXT NOT NULL REFERENCES animal(id),
  numero INTEGER NOT NULL,
  data_parto TEXT NOT NULL,
  data_secagem_prevista TEXT,
  data_secagem_real TEXT,
  encerrada INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_lactacao_animal ON lactacao(animal_id);

CREATE TABLE IF NOT EXISTS controle_leiteiro (
  id TEXT PRIMARY KEY,
  animal_id TEXT NOT NULL REFERENCES animal(id),
  data TEXT NOT NULL,
  litros_manha REAL NOT NULL DEFAULT 0,
  litros_tarde REAL NOT NULL DEFAULT 0,
  litros_total REAL NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_controle_animal_data ON controle_leiteiro(animal_id, data);

CREATE TABLE IF NOT EXISTS producao_propriedade (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL UNIQUE,
  litros_vendidos REAL NOT NULL DEFAULT 0,
  litros_bezerros REAL NOT NULL DEFAULT 0,
  litros_consumo_doacao REAL NOT NULL DEFAULT 0,
  litros_derivados REAL NOT NULL DEFAULT 0,
  litros_total REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_producao_data ON producao_propriedade(data);

CREATE TABLE IF NOT EXISTS cobertura (
  id TEXT PRIMARY KEY,
  animal_id TEXT NOT NULL REFERENCES animal(id),
  data TEXT NOT NULL,
  touro_nome TEXT,
  tipo TEXT NOT NULL,
  numero_no_ciclo INTEGER NOT NULL DEFAULT 1,
  data_provavel_parto TEXT,
  confirmada_prenhe INTEGER NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_cobertura_animal ON cobertura(animal_id);

CREATE TABLE IF NOT EXISTS morte (
  id TEXT PRIMARY KEY,
  animal_id TEXT NOT NULL REFERENCES animal(id),
  data TEXT NOT NULL,
  hora TEXT,
  categoria_na_morte TEXT,
  causa TEXT NOT NULL,
  orientacoes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Núcleo do sistema especialista
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS atendimento (
  id TEXT PRIMARY KEY,
  animal_id TEXT NOT NULL REFERENCES animal(id),
  data_hora TEXT NOT NULL,
  queixa_principal TEXT,
  kb_versao TEXT NOT NULL,
  engine_versao TEXT NOT NULL,
  fatos_iniciais TEXT NOT NULL,
  respostas TEXT NOT NULL,
  conclusoes TEXT NOT NULL,
  traco TEXT NOT NULL,
  conduta_check TEXT,
  motivo_parada TEXT,
  status TEXT NOT NULL DEFAULT 'concluido',
  observacoes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_atendimento_animal ON atendimento(animal_id, data_hora);

CREATE TABLE IF NOT EXISTS fato_registrado (
  id TEXT PRIMARY KEY,
  atendimento_id TEXT NOT NULL REFERENCES atendimento(id),
  variavel TEXT NOT NULL,
  valor TEXT NOT NULL,
  cf REAL NOT NULL,
  origem TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_fato_variavel ON fato_registrado(variavel);

CREATE TABLE IF NOT EXISTS exame_cmt (
  id TEXT PRIMARY KEY,
  animal_id TEXT NOT NULL REFERENCES animal(id),
  data TEXT NOT NULL,
  ad TEXT, ae TEXT, pd TEXT, pe TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_cmt_animal_data ON exame_cmt(animal_id, data);

CREATE TABLE IF NOT EXISTS exame_ccs (
  id TEXT PRIMARY KEY,
  animal_id TEXT REFERENCES animal(id),
  tanque INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL,
  celulas_ml REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS caso_mastite (
  id TEXT PRIMARY KEY,
  animal_id TEXT NOT NULL REFERENCES animal(id),
  quartos INTEGER NOT NULL DEFAULT 1,
  tipo TEXT NOT NULL,
  grau INTEGER,
  data_inicio TEXT NOT NULL,
  data_fim TEXT,
  atendimento_id TEXT REFERENCES atendimento(id),
  desfecho TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_caso_mastite_data ON caso_mastite(data_inicio);

-- ---------------------------------------------------------------------------
-- Sanidade
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS medicamento (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  principio_ativo TEXT,
  apresentacao TEXT,
  custo_unidade REAL NOT NULL DEFAULT 0,
  carencia_leite_dias INTEGER NOT NULL DEFAULT 0,
  carencia_carne_dias INTEGER NOT NULL DEFAULT 0,
  estoque REAL NOT NULL DEFAULT 0,
  validade TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tratamento (
  id TEXT PRIMARY KEY,
  animal_id TEXT NOT NULL REFERENCES animal(id),
  medicamento_id TEXT REFERENCES medicamento(id),
  atendimento_id TEXT REFERENCES atendimento(id),
  dose TEXT,
  via TEXT,
  data_inicio TEXT NOT NULL,
  data_fim TEXT,
  carencia_leite_ate TEXT,
  carencia_carne_ate TEXT,
  responsavel TEXT,
  custo_total REAL NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_tratamento_animal ON tratamento(animal_id);
CREATE INDEX IF NOT EXISTS ix_tratamento_carencia ON tratamento(carencia_leite_ate);

CREATE TABLE IF NOT EXISTS vacina (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  doenca_alvo TEXT,
  intervalo_meses INTEGER,
  obrigatoria INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vacinacao (
  id TEXT PRIMARY KEY,
  animal_id TEXT NOT NULL REFERENCES animal(id),
  vacina_id TEXT NOT NULL REFERENCES vacina(id),
  data TEXT NOT NULL,
  lote TEXT,
  responsavel TEXT,
  custo REAL NOT NULL DEFAULT 0,
  proxima_dose TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_vacinacao_animal ON vacinacao(animal_id);

CREATE TABLE IF NOT EXISTS evento_calendario (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  animal_id TEXT REFERENCES animal(id),
  lote_id TEXT REFERENCES lote(id),
  titulo TEXT NOT NULL,
  descricao TEXT,
  data TEXT NOT NULL,
  recorrencia TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  origem TEXT NOT NULL DEFAULT 'manual',
  referencia_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_evento_data ON evento_calendario(data, status);

-- ---------------------------------------------------------------------------
-- Financeiro (categorias da planilha Embrapa)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS despesa (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT,
  valor REAL NOT NULL,
  animal_id TEXT REFERENCES animal(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_despesa_data ON despesa(data, categoria);

CREATE TABLE IF NOT EXISTS receita (
  id TEXT PRIMARY KEY,
  destinatario TEXT,
  data TEXT NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT,
  valor REAL NOT NULL,
  animal_id TEXT REFERENCES animal(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_receita_data ON receita(data, categoria);

CREATE TABLE IF NOT EXISTS meta_app (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
`;
