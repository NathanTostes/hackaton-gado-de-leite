/**
 * Repositórios: toda a SQL do Dr. Moo vive aqui.
 *
 * Decisão de desempenho (specsDrMoo.md §10): agregação é feita em SQL, nunca em
 * JavaScript. O aparelho-alvo tem 2 GB de RAM — percorrer o rebanho inteiro em JS
 * para calcular um indicador é exatamente o que trava o app no curral.
 */
import {
  LIMITE_CCS_INDIVIDUAL,
  del as calcularDel,
  dataProvavelParto,
  diasNoMes,
  hoje,
  indicadoresFinanceiros,
  indicadoresTecnicos,
  panoramaVaca,
  percentualMastiteClinica,
  percentualMastiteSubclinica,
  piorCMT,
  somarDias,
  type CategoriaAnimal,
  type ComposicaoRebanho,
  type IndicadoresFinanceiros,
  type IndicadoresTecnicos,
  type PanoramaVaca,
  type ResultadoCMT,
} from '@drmoo/domain';
import { agoraISO, consultar, consultarUm, executar, novoId } from './driver';
import type {
  Animal,
  AnimalComResumo,
  Atendimento,
  EventoComAnimal,
  ExameCMT,
  Lancamento,
  Medicamento,
  Propriedade,
  StatusAnimal,
  TipoEvento,
  Tratamento,
} from './tipos';

// ---------------------------------------------------------------------------
// Propriedade
// ---------------------------------------------------------------------------

export async function obterPropriedade(): Promise<Propriedade | null> {
  return consultarUm<Propriedade>('SELECT * FROM propriedade LIMIT 1');
}

export async function salvarPropriedade(p: Partial<Propriedade>): Promise<void> {
  const atual = await obterPropriedade();
  const agora = agoraISO();
  if (!atual) {
    await executar(
      `INSERT INTO propriedade
       (id, nome, area_propria_ha, area_arrendada_ha, mao_de_obra_pessoas, preco_leite_litro,
        mao_de_obra_familiar_mes, reposicao_investimento_mes, gestacao_dias, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        p.id ?? novoId('prop'),
        p.nome ?? 'Minha propriedade',
        p.area_propria_ha ?? 0,
        p.area_arrendada_ha ?? 0,
        p.mao_de_obra_pessoas ?? 1,
        p.preco_leite_litro ?? 0,
        p.mao_de_obra_familiar_mes ?? 0,
        p.reposicao_investimento_mes ?? 0,
        p.gestacao_dias ?? 283,
        agora,
        agora,
      ],
    );
    return;
  }
  const m = { ...atual, ...p };
  await executar(
    `UPDATE propriedade SET nome=?, area_propria_ha=?, area_arrendada_ha=?, mao_de_obra_pessoas=?,
     preco_leite_litro=?, mao_de_obra_familiar_mes=?, reposicao_investimento_mes=?, gestacao_dias=?,
     updated_at=? WHERE id=?`,
    [
      m.nome,
      m.area_propria_ha,
      m.area_arrendada_ha,
      m.mao_de_obra_pessoas,
      m.preco_leite_litro,
      m.mao_de_obra_familiar_mes,
      m.reposicao_investimento_mes,
      m.gestacao_dias,
      agora,
      atual.id,
    ],
  );
}

// ---------------------------------------------------------------------------
// Rebanho
// ---------------------------------------------------------------------------

export interface FiltrosRebanho {
  busca?: string;
  categorias?: CategoriaAnimal[];
  status?: StatusAnimal[];
  loteId?: string | null;
  delMin?: number;
  delMax?: number;
  producaoMin?: number;
  cmtPositivo?: boolean;
  emCarencia?: boolean;
  ordenarPor?: 'brinco' | 'producao' | 'del' | 'alerta';
}

/**
 * Query única com os campos derivados que a lista precisa.
 * Correlacionadas e indexadas — evita N+1 no aparelho fraco.
 */
const SQL_ANIMAL_RESUMO = `
SELECT
  a.*,
  l.nome AS lote_nome,
  lac.data_parto,
  lac.numero AS numero_lactacao,
  (SELECT ROUND(AVG(cl.litros_total), 2) FROM controle_leiteiro cl
     WHERE cl.animal_id = a.id AND cl.data >= date('now', '-90 day')) AS producao_media_dia,
  (SELECT c.data FROM exame_cmt c WHERE c.animal_id = a.id ORDER BY c.data DESC LIMIT 1) AS data_ultimo_cmt,
  (SELECT c.ad || '|' || COALESCE(c.ae,'') || '|' || COALESCE(c.pd,'') || '|' || COALESCE(c.pe,'')
     FROM exame_cmt c WHERE c.animal_id = a.id ORDER BY c.data DESC LIMIT 1) AS cmt_quartos,
  (SELECT COUNT(DISTINCT substr(c.data, 1, 7)) FROM exame_cmt c
     WHERE c.animal_id = a.id
       AND (lac.data_parto IS NULL OR c.data >= lac.data_parto)
       AND (c.ad IN ('1','2','3') OR c.ae IN ('1','2','3')
            OR c.pd IN ('1','2','3') OR c.pe IN ('1','2','3'))) AS cmt_positivo_meses,
  (SELECT MAX(t.carencia_leite_ate) FROM tratamento t
     WHERE t.animal_id = a.id AND t.carencia_leite_ate >= date('now')) AS carencia_leite_ate,
  (SELECT COUNT(*) FROM exame_cmt c WHERE c.animal_id = a.id
     AND ('PP' IN (c.ad, c.ae, c.pd, c.pe))) AS qtd_pp,
  (SELECT cob.data_provavel_parto FROM cobertura cob
     WHERE cob.animal_id = a.id AND cob.confirmada_prenhe = 1
     ORDER BY cob.data DESC LIMIT 1) AS data_provavel_parto
FROM animal a
LEFT JOIN lote l ON l.id = a.lote_id
LEFT JOIN lactacao lac ON lac.id = (
  SELECT id FROM lactacao WHERE animal_id = a.id ORDER BY data_parto DESC LIMIT 1
)
WHERE a.deleted_at IS NULL
`;

interface LinhaResumo extends Animal {
  lote_nome: string | null;
  data_parto: string | null;
  numero_lactacao: number | null;
  producao_media_dia: number | null;
  data_ultimo_cmt: string | null;
  cmt_quartos: string | null;
  cmt_positivo_meses: number | null;
  carencia_leite_ate: string | null;
  qtd_pp: number | null;
  data_provavel_parto: string | null;
}

function montarResumo(l: LinhaResumo, referencia: string): AnimalComResumo {
  const quartos = (l.cmt_quartos ?? '').split('|').map((q) => (q === '' ? null : (q as ResultadoCMT)));
  return {
    ...l,
    lote_nome: l.lote_nome,
    data_parto: l.data_parto,
    numero_lactacao: l.numero_lactacao,
    del: l.data_parto ? calcularDel(l.data_parto, referencia) : null,
    producao_media_dia: l.producao_media_dia,
    ultimo_cmt: piorCMT(quartos),
    data_ultimo_cmt: l.data_ultimo_cmt,
    cmt_positivo_meses: l.cmt_positivo_meses ?? 0,
    carencia_leite_ate: l.carencia_leite_ate,
    tem_peito_perdido: (l.qtd_pp ?? 0) > 0,
    data_provavel_parto: l.data_provavel_parto,
  };
}

export async function listarRebanho(f: FiltrosRebanho = {}): Promise<AnimalComResumo[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (f.busca?.trim()) {
    // Atenção: em SQLite, aspas duplas são IDENTIFICADORES, não literais de
    // texto. `COALESCE(a.nome, "")` procura uma coluna chamada "" e falha.
    where.push(
      `(a.brinco LIKE ? OR COALESCE(a.nome, '') LIKE ? OR COALESCE(a.tatuagem, '') LIKE ?)`,
    );
    const t = `%${f.busca.trim()}%`;
    params.push(t, t, t);
  }
  if (f.categorias?.length) {
    where.push(`a.categoria IN (${f.categorias.map(() => '?').join(',')})`);
    params.push(...f.categorias);
  }
  if (f.status?.length) {
    where.push(`a.status IN (${f.status.map(() => '?').join(',')})`);
    params.push(...f.status);
  }
  if (f.loteId) {
    where.push('a.lote_id = ?');
    params.push(f.loteId);
  }

  // Filtros sobre colunas derivadas precisam ficar fora do WHERE base.
  const having: string[] = [];
  if (f.delMin !== undefined) {
    having.push("CAST(julianday('now') - julianday(data_parto) AS INTEGER) >= ?");
    params.push(f.delMin);
  }
  if (f.delMax !== undefined) {
    having.push("CAST(julianday('now') - julianday(data_parto) AS INTEGER) <= ?");
    params.push(f.delMax);
  }
  if (f.producaoMin !== undefined) {
    having.push('COALESCE(producao_media_dia, 0) >= ?');
    params.push(f.producaoMin);
  }
  if (f.cmtPositivo) {
    having.push("(cmt_quartos LIKE '%1%' OR cmt_quartos LIKE '%2%' OR cmt_quartos LIKE '%3%')");
  }
  if (f.emCarencia) {
    having.push('carencia_leite_ate IS NOT NULL');
  }

  const ordem =
    f.ordenarPor === 'producao'
      ? 'COALESCE(producao_media_dia, 0) DESC'
      : f.ordenarPor === 'del'
        ? 'data_parto DESC'
        : f.ordenarPor === 'alerta'
          ? `CASE status WHEN 'em_tratamento' THEN 0 WHEN 'em_carencia' THEN 1
             WHEN 'mastite_cronica' THEN 2 WHEN 'quarentena' THEN 3 ELSE 4 END, brinco`
          : 'brinco';

  const sql = `
    SELECT * FROM (${SQL_ANIMAL_RESUMO} ${where.length ? `AND ${where.join(' AND ')}` : ''})
    ${having.length ? `WHERE ${having.join(' AND ')}` : ''}
    ORDER BY ${ordem}
  `;

  const linhas = await consultar<LinhaResumo>(sql, params);
  const ref = hoje();
  return linhas.map((l) => montarResumo(l, ref));
}

export async function obterAnimal(id: string): Promise<AnimalComResumo | null> {
  const linha = await consultarUm<LinhaResumo>(`${SQL_ANIMAL_RESUMO} AND a.id = ?`, [id]);
  return linha ? montarResumo(linha, hoje()) : null;
}

export async function salvarAnimal(a: Partial<Animal> & { brinco: string }): Promise<string> {
  const agora = agoraISO();
  if (a.id) {
    await executar(
      `UPDATE animal SET brinco=?, nome=?, tatuagem=?, categoria=?, sexo=?, raca=?,
       data_nascimento=?, peso_nascimento=?, pelagem_sinal=?, mae_id=?, pai_nome=?, lote_id=?,
       status=?, origem=?, data_entrada=?, observacoes=?, updated_at=? WHERE id=?`,
      [
        a.brinco,
        a.nome ?? null,
        a.tatuagem ?? null,
        a.categoria ?? 'vaca_lactacao',
        a.sexo ?? 'F',
        a.raca ?? null,
        a.data_nascimento ?? null,
        a.peso_nascimento ?? null,
        a.pelagem_sinal ?? null,
        a.mae_id ?? null,
        a.pai_nome ?? null,
        a.lote_id ?? null,
        a.status ?? 'saudavel',
        a.origem ?? 'nascimento',
        a.data_entrada ?? null,
        a.observacoes ?? null,
        agora,
        a.id,
      ],
    );
    return a.id;
  }

  const id = novoId('ani');
  await executar(
    `INSERT INTO animal
     (id, brinco, nome, tatuagem, categoria, sexo, raca, data_nascimento, peso_nascimento,
      pelagem_sinal, mae_id, pai_nome, lote_id, status, origem, data_entrada, observacoes,
      created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      a.brinco,
      a.nome ?? null,
      a.tatuagem ?? null,
      a.categoria ?? 'vaca_lactacao',
      a.sexo ?? 'F',
      a.raca ?? null,
      a.data_nascimento ?? null,
      a.peso_nascimento ?? null,
      a.pelagem_sinal ?? null,
      a.mae_id ?? null,
      a.pai_nome ?? null,
      a.lote_id ?? null,
      a.status ?? 'saudavel',
      a.origem ?? 'nascimento',
      a.data_entrada ?? hoje(),
      a.observacoes ?? null,
      agora,
      agora,
    ],
  );
  return id;
}

export async function atualizarStatus(animalId: string, status: StatusAnimal): Promise<void> {
  await executar('UPDATE animal SET status=?, updated_at=? WHERE id=?', [
    status,
    agoraISO(),
    animalId,
  ]);
}

export async function composicaoRebanho(): Promise<ComposicaoRebanho> {
  const linhas = await consultar<{ categoria: CategoriaAnimal; n: number }>(
    `SELECT categoria, COUNT(*) AS n FROM animal
     WHERE deleted_at IS NULL AND status NOT IN ('morto','descartado')
     GROUP BY categoria`,
  );
  const c: ComposicaoRebanho = {};
  for (const l of linhas) c[l.categoria] = l.n;
  return c;
}

// ---------------------------------------------------------------------------
// Produção
// ---------------------------------------------------------------------------

export interface ProducaoDoMes {
  litros: number;
  /** Dias com lançamento. Num mês em andamento é menor que o mês inteiro. */
  dias: number;
}

export async function producaoMensal(ano: number, mes: number): Promise<ProducaoDoMes> {
  const prefixo = `${ano}-${String(mes).padStart(2, '0')}`;
  const r = await consultarUm<{ total: number | null; dias: number | null }>(
    `SELECT SUM(litros_total) AS total, COUNT(*) AS dias
     FROM producao_propriedade WHERE substr(data,1,7) = ?`,
    [prefixo],
  );
  return { litros: r?.total ?? 0, dias: r?.dias ?? 0 };
}

/** Um mês é "fechado" quando já tem lançamento em todos os seus dias. */
export function mesFechado(p: ProducaoDoMes, ano: number, mes: number): boolean {
  return p.dias >= diasNoMes(ano, mes);
}

export async function serieProducaoDiaria(dias = 30): Promise<{ data: string; litros: number }[]> {
  return consultar<{ data: string; litros: number }>(
    `SELECT data, litros_total AS litros FROM producao_propriedade
     WHERE data >= date('now', ?) ORDER BY data`,
    [`-${dias} day`],
  );
}

export async function controleLeiteiroDoAnimal(
  animalId: string,
): Promise<{ data: string; litros_total: number; observacoes: string | null }[]> {
  return consultar(
    `SELECT data, litros_total, observacoes FROM controle_leiteiro
     WHERE animal_id = ? ORDER BY data DESC LIMIT 24`,
    [animalId],
  );
}

// ---------------------------------------------------------------------------
// Mastite
// ---------------------------------------------------------------------------

export async function lancarCMT(
  animalId: string,
  data: string,
  q: { ad: ResultadoCMT | null; ae: ResultadoCMT | null; pd: ResultadoCMT | null; pe: ResultadoCMT | null },
): Promise<void> {
  const agora = agoraISO();
  const existente = await consultarUm<{ id: string }>(
    'SELECT id FROM exame_cmt WHERE animal_id=? AND data=?',
    [animalId, data],
  );
  if (existente) {
    await executar('UPDATE exame_cmt SET ad=?, ae=?, pd=?, pe=?, updated_at=? WHERE id=?', [
      q.ad,
      q.ae,
      q.pd,
      q.pe,
      agora,
      existente.id,
    ]);
    return;
  }
  await executar(
    `INSERT INTO exame_cmt (id, animal_id, data, ad, ae, pd, pe, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [novoId('cmt'), animalId, data, q.ad, q.ae, q.pd, q.pe, agora, agora],
  );
}

export async function historicoCMT(animalId: string): Promise<ExameCMT[]> {
  return consultar<ExameCMT>(
    'SELECT * FROM exame_cmt WHERE animal_id=? ORDER BY data DESC LIMIT 12',
    [animalId],
  );
}

export async function ultimaCCS(animalId: string): Promise<number | null> {
  const r = await consultarUm<{ celulas_ml: number }>(
    'SELECT celulas_ml FROM exame_ccs WHERE animal_id=? ORDER BY data DESC LIMIT 1',
    [animalId],
  );
  return r?.celulas_ml ?? null;
}

export interface PainelMastite {
  percentualClinica: number;
  percentualSubclinica: number;
  vacasTestadas: number;
  vacasPositivas: number;
  diasDesdeUltimoCMT: number | null;
  cronicas: { id: string; brinco: string; nome: string | null; meses: number }[];
}

export async function painelMastite(ano: number, mes: number): Promise<PainelMastite> {
  const prefixo = `${ano}-${String(mes).padStart(2, '0')}`;

  const casos = await consultar<{ quartos: number; dias: number }>(
    `SELECT quartos,
            CAST(julianday(COALESCE(data_fim, date('now'))) - julianday(data_inicio) AS INTEGER) + 1 AS dias
     FROM caso_mastite
     WHERE tipo = 'clinica' AND substr(data_inicio,1,7) = ?`,
    [prefixo],
  );

  const vacas = await consultarUm<{ n: number }>(
    `SELECT COUNT(*) AS n FROM animal
     WHERE categoria='vaca_lactacao' AND deleted_at IS NULL AND status NOT IN ('morto','descartado')`,
  );

  const testes = await consultarUm<{ testadas: number; positivas: number }>(
    `SELECT COUNT(DISTINCT animal_id) AS testadas,
            COUNT(DISTINCT CASE WHEN ad IN ('1','2','3') OR ae IN ('1','2','3')
                                  OR pd IN ('1','2','3') OR pe IN ('1','2','3')
                             THEN animal_id END) AS positivas
     FROM exame_cmt WHERE substr(data,1,7) = ?`,
    [prefixo],
  );

  const ultimo = await consultarUm<{ dias: number | null }>(
    `SELECT CAST(julianday('now') - julianday(MAX(data)) AS INTEGER) AS dias FROM exame_cmt`,
  );

  const cronicas = await consultar<{ id: string; brinco: string; nome: string | null; meses: number }>(
    `SELECT a.id, a.brinco, a.nome,
            COUNT(DISTINCT substr(c.data,1,7)) AS meses
     FROM animal a
     JOIN exame_cmt c ON c.animal_id = a.id
     WHERE a.deleted_at IS NULL
       AND (c.ad IN ('1','2','3') OR c.ae IN ('1','2','3')
            OR c.pd IN ('1','2','3') OR c.pe IN ('1','2','3'))
     GROUP BY a.id
     HAVING meses >= 3
     ORDER BY meses DESC`,
  );

  return {
    percentualClinica: percentualMastiteClinica(casos, diasNoMes(ano, mes), vacas?.n ?? 0),
    percentualSubclinica: percentualMastiteSubclinica(
      testes?.positivas ?? 0,
      testes?.testadas ?? 0,
    ),
    vacasTestadas: testes?.testadas ?? 0,
    vacasPositivas: testes?.positivas ?? 0,
    diasDesdeUltimoCMT: ultimo?.dias ?? null,
    cronicas,
  };
}

// ---------------------------------------------------------------------------
// Atendimentos (prontuário)
// ---------------------------------------------------------------------------

export async function salvarAtendimento(a: Omit<Atendimento, 'id'> & { id?: string }): Promise<string> {
  const id = a.id ?? novoId('ate');
  const agora = agoraISO();
  await executar(
    `INSERT INTO atendimento
     (id, animal_id, data_hora, queixa_principal, kb_versao, engine_versao, fatos_iniciais,
      respostas, conclusoes, traco, conduta_check, motivo_parada, status, observacoes,
      created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      a.animal_id,
      a.data_hora,
      a.queixa_principal,
      a.kb_versao,
      a.engine_versao,
      a.fatos_iniciais,
      a.respostas,
      a.conclusoes,
      a.traco,
      a.conduta_check,
      a.motivo_parada,
      a.status,
      a.observacoes,
      agora,
      agora,
    ],
  );
  return id;
}

export async function atendimentosDoAnimal(animalId: string): Promise<Atendimento[]> {
  return consultar<Atendimento>(
    'SELECT * FROM atendimento WHERE animal_id=? ORDER BY data_hora DESC',
    [animalId],
  );
}

export async function obterAtendimento(id: string): Promise<Atendimento | null> {
  return consultarUm<Atendimento>('SELECT * FROM atendimento WHERE id=?', [id]);
}

export async function atendimentosRecentes(limite = 10): Promise<
  (Atendimento & { brinco: string; animal_nome: string | null })[]
> {
  return consultar(
    `SELECT at.*, a.brinco, a.nome AS animal_nome
     FROM atendimento at JOIN animal a ON a.id = at.animal_id
     ORDER BY at.data_hora DESC LIMIT ?`,
    [limite],
  );
}

export async function registrarCasoMastite(c: {
  animalId: string;
  quartos: number;
  tipo: 'clinica' | 'subclinica';
  grau: number | null;
  dataInicio: string;
  atendimentoId: string | null;
}): Promise<void> {
  const agora = agoraISO();
  await executar(
    `INSERT INTO caso_mastite
     (id, animal_id, quartos, tipo, grau, data_inicio, atendimento_id, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [novoId('mas'), c.animalId, c.quartos, c.tipo, c.grau, c.dataInicio, c.atendimentoId, agora, agora],
  );
}

// ---------------------------------------------------------------------------
// Sanidade
// ---------------------------------------------------------------------------

export async function listarMedicamentos(): Promise<Medicamento[]> {
  return consultar<Medicamento>('SELECT * FROM medicamento ORDER BY nome');
}

export async function salvarMedicamento(m: Omit<Medicamento, 'id'> & { id?: string }): Promise<string> {
  const id = m.id ?? novoId('med');
  const agora = agoraISO();
  await executar(
    `INSERT INTO medicamento
     (id, nome, principio_ativo, apresentacao, custo_unidade, carencia_leite_dias,
      carencia_carne_dias, estoque, validade, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET nome=excluded.nome, custo_unidade=excluded.custo_unidade,
       carencia_leite_dias=excluded.carencia_leite_dias, estoque=excluded.estoque,
       updated_at=excluded.updated_at`,
    [
      id,
      m.nome,
      m.principio_ativo,
      m.apresentacao,
      m.custo_unidade,
      m.carencia_leite_dias,
      m.carencia_carne_dias,
      m.estoque,
      m.validade,
      agora,
      agora,
    ],
  );
  return id;
}

/**
 * Registrar uma aplicação dispara três efeitos automáticos: bloqueio de carência,
 * evento de fim de tratamento no calendário e lançamento em "Sanidade e medicamentos".
 */
export async function registrarTratamento(t: {
  animalId: string;
  medicamentoId: string | null;
  atendimentoId?: string | null;
  dose?: string;
  via?: string;
  dataInicio: string;
  dias: number;
  carenciaLeiteDias: number;
  carenciaCarneDias: number;
  custoTotal: number;
  responsavel?: string;
  descricao: string;
}): Promise<string> {
  const id = novoId('tra');
  const agora = agoraISO();
  const dataFim = somarDias(t.dataInicio, Math.max(0, t.dias - 1));
  const carenciaLeiteAte = somarDias(dataFim, t.carenciaLeiteDias);
  const carenciaCarneAte = somarDias(dataFim, t.carenciaCarneDias);

  await executar(
    `INSERT INTO tratamento
     (id, animal_id, medicamento_id, atendimento_id, dose, via, data_inicio, data_fim,
      carencia_leite_ate, carencia_carne_ate, responsavel, custo_total, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      t.animalId,
      t.medicamentoId,
      t.atendimentoId ?? null,
      t.dose ?? null,
      t.via ?? null,
      t.dataInicio,
      dataFim,
      carenciaLeiteAte,
      carenciaCarneAte,
      t.responsavel ?? null,
      t.custoTotal,
      agora,
      agora,
    ],
  );

  await atualizarStatus(t.animalId, 'em_carencia');

  await criarEvento({
    tipo: 'medicacao',
    animalId: t.animalId,
    titulo: `Fim da carência — ${t.descricao}`,
    descricao: `O leite volta a poder ir para o tanque a partir de ${carenciaLeiteAte}.`,
    data: carenciaLeiteAte,
    origem: 'automatico',
    referenciaId: id,
  });

  await lancarDespesa({
    data: t.dataInicio,
    categoria: 'sanidade_medicamentos',
    descricao: t.descricao,
    valor: t.custoTotal,
    animalId: t.animalId,
  });

  return id;
}

export async function tratamentosDoAnimal(animalId: string): Promise<Tratamento[]> {
  return consultar<Tratamento>(
    'SELECT * FROM tratamento WHERE animal_id=? ORDER BY data_inicio DESC',
    [animalId],
  );
}

export async function vacasEmCarencia(): Promise<AnimalComResumo[]> {
  return listarRebanho({ emCarencia: true });
}

// ---------------------------------------------------------------------------
// Calendário
// ---------------------------------------------------------------------------

export async function criarEvento(e: {
  tipo: TipoEvento;
  animalId?: string | null;
  loteId?: string | null;
  titulo: string;
  descricao?: string | null;
  data: string;
  recorrencia?: string | null;
  origem?: 'manual' | 'regra' | 'automatico';
  referenciaId?: string | null;
}): Promise<string> {
  const id = novoId('evt');
  const agora = agoraISO();
  await executar(
    `INSERT INTO evento_calendario
     (id, tipo, animal_id, lote_id, titulo, descricao, data, recorrencia, status, origem,
      referencia_id, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?, 'pendente', ?,?,?,?)`,
    [
      id,
      e.tipo,
      e.animalId ?? null,
      e.loteId ?? null,
      e.titulo,
      e.descricao ?? null,
      e.data,
      e.recorrencia ?? null,
      e.origem ?? 'manual',
      e.referenciaId ?? null,
      agora,
      agora,
    ],
  );
  return id;
}

export async function listarEventos(de: string, ate: string): Promise<EventoComAnimal[]> {
  return consultar<EventoComAnimal>(
    `SELECT e.*, a.brinco, a.nome AS animal_nome
     FROM evento_calendario e LEFT JOIN animal a ON a.id = e.animal_id
     WHERE e.data BETWEEN ? AND ? AND e.status <> 'cancelado'
     ORDER BY e.data, e.tipo`,
    [de, ate],
  );
}

export async function eventosPendentes(limite = 20): Promise<EventoComAnimal[]> {
  return consultar<EventoComAnimal>(
    `SELECT e.*, a.brinco, a.nome AS animal_nome
     FROM evento_calendario e LEFT JOIN animal a ON a.id = e.animal_id
     WHERE e.status = 'pendente' AND e.data <= date('now', '+7 day')
     ORDER BY e.data LIMIT ?`,
    [limite],
  );
}

export async function concluirEvento(id: string): Promise<void> {
  await executar('UPDATE evento_calendario SET status=?, updated_at=? WHERE id=?', [
    'feito',
    agoraISO(),
    id,
  ]);
}

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------

export async function lancarDespesa(d: {
  data: string;
  categoria: string;
  descricao?: string;
  valor: number;
  animalId?: string | null;
}): Promise<void> {
  const agora = agoraISO();
  await executar(
    `INSERT INTO despesa (id, data, categoria, descricao, valor, animal_id, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [novoId('des'), d.data, d.categoria, d.descricao ?? null, d.valor, d.animalId ?? null, agora, agora],
  );
}

export async function lancarReceita(r: {
  data: string;
  categoria: string;
  descricao?: string;
  valor: number;
  animalId?: string | null;
}): Promise<void> {
  const agora = agoraISO();
  await executar(
    `INSERT INTO receita (id, data, categoria, descricao, valor, animal_id, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [novoId('rec'), r.data, r.categoria, r.descricao ?? null, r.valor, r.animalId ?? null, agora, agora],
  );
}

export async function lancamentosDoMes(
  ano: number,
  mes: number,
): Promise<{ despesas: Lancamento[]; receitas: Lancamento[] }> {
  const prefixo = `${ano}-${String(mes).padStart(2, '0')}`;
  const [despesas, receitas] = await Promise.all([
    consultar<Lancamento>(
      'SELECT * FROM despesa WHERE substr(data,1,7)=? ORDER BY data DESC',
      [prefixo],
    ),
    consultar<Lancamento>(
      'SELECT * FROM receita WHERE substr(data,1,7)=? ORDER BY data DESC',
      [prefixo],
    ),
  ]);
  return { despesas, receitas };
}

export interface ResumoMensal {
  tecnicos: IndicadoresTecnicos;
  financeiros: IndicadoresFinanceiros;
  despesasPorCategoria: { categoria: string; total: number }[];
  /**
   * Falso enquanto o mês está em andamento. Num mês parcial, a produção é
   * parcial mas as despesas lançadas podem já ser do mês inteiro — e aí o custo
   * por litro fica artificialmente alto. A interface precisa avisar.
   */
  fechado: boolean;
  diasComProducao: number;
}

export async function resumoMensal(ano: number, mes: number): Promise<ResumoMensal> {
  const prefixo = `${ano}-${String(mes).padStart(2, '0')}`;
  const propriedade = await obterPropriedade();
  const rebanho = await composicaoRebanho();
  const producao = await producaoMensal(ano, mes);

  const despesas = await consultar<{ categoria: string; total: number }>(
    'SELECT categoria, SUM(valor) AS total FROM despesa WHERE substr(data,1,7)=? GROUP BY categoria ORDER BY total DESC',
    [prefixo],
  );
  const receitas = await consultar<{ categoria: string; total: number }>(
    'SELECT categoria, SUM(valor) AS total FROM receita WHERE substr(data,1,7)=? GROUP BY categoria',
    [prefixo],
  );

  const mapa = <T extends { categoria: string; total: number }>(l: T[]) =>
    Object.fromEntries(l.map((x) => [x.categoria, x.total]));

  const areaHa = (propriedade?.area_propria_ha ?? 0) + (propriedade?.area_arrendada_ha ?? 0);

  return {
    tecnicos: indicadoresTecnicos({
      producaoMensalL: producao.litros,
      diasDoMes: diasNoMes(ano, mes),
      diasComProducao: producao.dias,
      rebanho,
      maoDeObraPessoas: propriedade?.mao_de_obra_pessoas ?? 1,
      areaHa,
    }),
    financeiros: indicadoresFinanceiros({
      receitas: mapa(receitas),
      despesas: mapa(despesas),
      producaoMensalL: producao.litros,
      precoRecebidoPorLitro: propriedade?.preco_leite_litro ?? 0,
      maoDeObraFamiliar: propriedade?.mao_de_obra_familiar_mes ?? 0,
      reposicaoInvestimento: propriedade?.reposicao_investimento_mes ?? 0,
    }),
    despesasPorCategoria: despesas,
    fechado: mesFechado(producao, ano, mes),
    diasComProducao: producao.dias,
  };
}

export interface LinhaPanoramaVaca extends PanoramaVaca {
  animalId: string;
  brinco: string;
  nome: string | null;
  litros: number;
}

/** Produção da vaca × gastos com remédios — o argumento econômico da anamnese. */
export async function panoramaPorVaca(dias = 90): Promise<LinhaPanoramaVaca[]> {
  const propriedade = await obterPropriedade();
  const preco = propriedade?.preco_leite_litro ?? 0;

  const linhas = await consultar<{
    id: string;
    brinco: string;
    nome: string | null;
    litros: number | null;
    custo: number | null;
    dias_descarte: number | null;
    media_dia: number | null;
  }>(
    `SELECT a.id, a.brinco, a.nome,
       (SELECT SUM(cl.litros_total) FROM controle_leiteiro cl
          WHERE cl.animal_id = a.id AND cl.data >= date('now', ?)) AS litros,
       (SELECT SUM(t.custo_total) FROM tratamento t
          WHERE t.animal_id = a.id AND t.data_inicio >= date('now', ?)) AS custo,
       (SELECT SUM(CAST(julianday(COALESCE(t.carencia_leite_ate, t.data_fim))
                        - julianday(t.data_inicio) AS INTEGER) + 1)
          FROM tratamento t
          WHERE t.animal_id = a.id AND t.data_inicio >= date('now', ?)) AS dias_descarte,
       (SELECT AVG(cl.litros_total) FROM controle_leiteiro cl
          WHERE cl.animal_id = a.id AND cl.data >= date('now', ?)) AS media_dia
     FROM animal a
     WHERE a.categoria = 'vaca_lactacao' AND a.deleted_at IS NULL`,
    [`-${dias} day`, `-${dias} day`, `-${dias} day`, `-${dias} day`],
  );

  return linhas
    .map((l) => {
      const mediaDia = l.media_dia ?? 0;
      const litrosDescartados = (l.dias_descarte ?? 0) * mediaDia;
      const p = panoramaVaca({
        litrosNoPeriodo: l.litros ?? 0,
        precoPorLitro: preco,
        custoTratamentos: l.custo ?? 0,
        litrosDescartados,
      });
      return { ...p, animalId: l.id, brinco: l.brinco, nome: l.nome, litros: l.litros ?? 0 };
    })
    .sort((a, b) => b.margem - a.margem);
}

export { LIMITE_CCS_INDIVIDUAL, dataProvavelParto };
