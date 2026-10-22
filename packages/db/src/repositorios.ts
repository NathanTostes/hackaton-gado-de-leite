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
import { agoraISO, consultar, consultarUm, emTransacao, executar, novoId } from './driver';
import { COLUNAS_CADASTRO } from './schema';
import { validarCadastroAnimal } from './cadastro';
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
       (id, nome, estado, cidade, pais, tipo_pasto, area_propria_ha, area_arrendada_ha, mao_de_obra_pessoas, preco_leite_litro,
        mao_de_obra_familiar_mes, reposicao_investimento_mes, gestacao_dias, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        p.id ?? novoId('prop'),
        p.nome ?? 'Minha propriedade',
        p.estado?.trim() || null,
        p.cidade?.trim() || null,
        p.pais?.trim() || null,
        p.tipo_pasto?.trim() || null,
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
    `UPDATE propriedade SET nome=?, estado=?, cidade=?, pais=?, tipo_pasto=?, area_propria_ha=?, area_arrendada_ha=?, mao_de_obra_pessoas=?,
     preco_leite_litro=?, mao_de_obra_familiar_mes=?, reposicao_investimento_mes=?, gestacao_dias=?,
     updated_at=? WHERE id=?`,
    [
      m.nome,
      m.estado?.trim() || null,
      m.cidade?.trim() || null,
      m.pais?.trim() || null,
      m.tipo_pasto?.trim() || null,
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
  /** Texto livre. Cada palavra precisa aparecer em algum campo do animal. */
  busca?: string;
  categorias?: CategoriaAnimal[];
  status?: StatusAnimal[];
  loteId?: string | null;
  /** Animais sem lote definido. */
  semLote?: boolean;
  sexo?: 'M' | 'F';
  delMin?: number;
  delMax?: number;
  idadeMinMeses?: number;
  idadeMaxMeses?: number;
  producaoMin?: number;
  producaoMax?: number;
  cmtPositivo?: boolean;
  /** Pior resultado de CMT no último exame igual ou acima deste grau. */
  cmtMinimo?: '1' | '2' | '3';
  peitoPerdido?: boolean;
  emCarencia?: boolean;
  prenhe?: boolean;
  /** Parto previsto dentro dos próximos N dias. */
  partoEmDias?: number;
  ordenarPor?: 'brinco' | 'nome' | 'producao' | 'del' | 'idade' | 'cmt' | 'lote' | 'parto' | 'alerta';
  decrescente?: boolean;
}

/**
 * Normaliza acento e caixa dentro do SQLite.
 *
 * `lower()` do SQLite só conhece ASCII e `LIKE` não ignora acento: sem isso,
 * procurar "holandes" não acha "Holandês" e "Mimosa" não acha "mimosa" se a
 * acentuação divergir. Trocar letra a letra é feio, mas é determinístico e não
 * exige extensão nenhuma — o mesmo código roda no navegador, no aparelho e nos
 * testes.
 */
const ACENTOS: [string, string][] = [
  ['á', 'a'], ['à', 'a'], ['â', 'a'], ['ã', 'a'], ['ä', 'a'],
  ['é', 'e'], ['è', 'e'], ['ê', 'e'], ['ë', 'e'],
  ['í', 'i'], ['ì', 'i'], ['î', 'i'], ['ï', 'i'],
  ['ó', 'o'], ['ò', 'o'], ['ô', 'o'], ['õ', 'o'], ['ö', 'o'],
  ['ú', 'u'], ['ù', 'u'], ['û', 'u'], ['ü', 'u'],
  ['ç', 'c'], ['ñ', 'n'],
  ['Á', 'a'], ['À', 'a'], ['Â', 'a'], ['Ã', 'a'], ['Ä', 'a'],
  ['É', 'e'], ['È', 'e'], ['Ê', 'e'], ['Ë', 'e'],
  ['Í', 'i'], ['Ì', 'i'], ['Î', 'i'], ['Ï', 'i'],
  ['Ó', 'o'], ['Ò', 'o'], ['Ô', 'o'], ['Õ', 'o'], ['Ö', 'o'],
  ['Ú', 'u'], ['Ù', 'u'], ['Û', 'u'], ['Ü', 'u'],
  ['Ç', 'c'], ['Ñ', 'n'],
];

function semAcentosSQL(expressao: string): string {
  return ACENTOS.reduce((sql, [de, para]) => `replace(${sql}, '${de}', '${para}')`, `lower(${expressao})`);
}

/** A mesma normalização, do lado do JavaScript, para o termo digitado. */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Campos varridos pela busca livre. */
const CAMPOS_BUSCA = [
  'a.brinco',
  'a.nome',
  'a.tatuagem',
  'a.raca',
  'a.pelagem_sinal',
  'a.categoria',
  'a.status',
  'a.procedencia',
  'a.numero_gta',
  'a.observacoes',
  'a.pai_nome',
  'a.mae_nome',
  'l.nome',
];

const EXPRESSAO_IDADE_MESES = `
  COALESCE(
    CAST((julianday('now') - julianday(a.data_nascimento)) / 30.44 AS INTEGER),
    a.idade_estimada_meses
      + CAST((julianday('now') - julianday(COALESCE(a.idade_estimada_em, a.created_at))) / 30.44 AS INTEGER)
  )`;

/**
 * Query única com os campos derivados que a lista precisa.
 * Correlacionadas e indexadas — evita N+1 no aparelho fraco.
 */
const SQL_ANIMAL_RESUMO = `
SELECT
  a.*,
  COALESCE(a.mae_nome, (SELECT p.brinco || COALESCE(' — ' || p.nome, '')
    FROM animal p WHERE p.id=a.mae_id)) AS mae_identificacao,
  COALESCE(a.pai_nome, (SELECT p.brinco || COALESCE(' — ' || p.nome, '')
    FROM animal p WHERE p.id=a.pai_id)) AS pai_identificacao,
  l.nome AS lote_nome,
  COALESCE(lac.data_parto, a.ultimo_parto_entrada) AS data_parto,
  COALESCE(lac.numero, a.numero_lactacoes_entrada) AS numero_lactacao,
  (SELECT ROUND(AVG(cl.litros_total), 2) FROM controle_leiteiro cl
     WHERE cl.animal_id = a.id AND cl.data >= date('now', '-90 day')) AS producao_media_dia,
  (SELECT c.data FROM exame_cmt c WHERE c.animal_id = a.id ORDER BY c.data DESC LIMIT 1) AS data_ultimo_cmt,
  (SELECT c.ad || '|' || COALESCE(c.ae,'') || '|' || COALESCE(c.pd,'') || '|' || COALESCE(c.pe,'')
     FROM exame_cmt c WHERE c.animal_id = a.id ORDER BY c.data DESC LIMIT 1) AS cmt_quartos,
  (SELECT COUNT(DISTINCT substr(c.data, 1, 7)) FROM exame_cmt c
     WHERE c.animal_id = a.id
       AND (COALESCE(lac.data_parto, a.ultimo_parto_entrada) IS NULL OR c.data >= COALESCE(lac.data_parto, a.ultimo_parto_entrada))
       AND (c.ad IN ('1','2','3') OR c.ae IN ('1','2','3')
            OR c.pd IN ('1','2','3') OR c.pe IN ('1','2','3'))) AS cmt_positivo_meses,
  (SELECT MAX(t.carencia_leite_ate) FROM tratamento t
     WHERE t.animal_id = a.id AND t.carencia_leite_ate >= date('now')) AS carencia_leite_ate,
  (SELECT COUNT(*) FROM exame_cmt c WHERE c.animal_id = a.id
     AND ('PP' IN (c.ad, c.ae, c.pd, c.pe))) AS qtd_pp,
  (SELECT cob.data_provavel_parto FROM cobertura cob
     WHERE cob.animal_id = a.id AND cob.confirmada_prenhe = 1
     ORDER BY cob.data DESC LIMIT 1) AS data_provavel_parto,
  ${EXPRESSAO_IDADE_MESES} AS idade_meses,
  ${semAcentosSQL(CAMPOS_BUSCA.map((campo) => `COALESCE(${campo}, '')`).join(` || ' ' || `))} AS texto_busca
FROM animal a
LEFT JOIN lote l ON l.id = a.lote_id
LEFT JOIN lactacao lac ON lac.id = (
  SELECT id FROM lactacao WHERE animal_id = a.id ORDER BY data_parto DESC LIMIT 1
)
WHERE a.deleted_at IS NULL
`;

interface LinhaResumo extends Animal {
  mae_identificacao: string | null;
  pai_identificacao: string | null;
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
  idade_meses: number | null;
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
    idade_meses: l.idade_meses,
  };
}

/**
 * ORDER BY da lista. O desempate é sempre o brinco: sem ele, animais com o
 * mesmo valor trocam de lugar entre consultas e a lista "pisca" ao filtrar.
 */
function montarOrdenacao(f: FiltrosRebanho): string {
  const dir = f.decrescente ? 'DESC' : 'ASC';
  switch (f.ordenarPor) {
    case 'producao':
      return `COALESCE(producao_media_dia, 0) ${f.decrescente === false ? 'ASC' : 'DESC'}, brinco`;
    case 'del':
      // Mais recém-parida primeiro = data de parto mais nova primeiro.
      return `data_parto IS NULL, data_parto ${f.decrescente ? 'ASC' : 'DESC'}, brinco`;
    case 'idade':
      return `idade_meses IS NULL, idade_meses ${dir}, brinco`;
    case 'nome':
      return `COALESCE(NULLIF(nome, ''), brinco) ${dir}`;
    case 'lote':
      return `lote_nome IS NULL, lote_nome ${dir}, brinco`;
    case 'parto':
      return `data_provavel_parto IS NULL, data_provavel_parto ${dir}, brinco`;
    case 'cmt':
      // Pior resultado primeiro: 3 > 2 > 1 > traço > sem exame.
      return `CASE
                WHEN cmt_quartos LIKE '%3%' THEN 0
                WHEN cmt_quartos LIKE '%2%' THEN 1
                WHEN cmt_quartos LIKE '%1%' THEN 2
                WHEN cmt_quartos LIKE '%T%' THEN 3
                WHEN cmt_quartos IS NULL THEN 5
                ELSE 4 END ${dir}, brinco`;
    case 'alerta':
      return `CASE status WHEN 'em_tratamento' THEN 0 WHEN 'em_carencia' THEN 1
              WHEN 'mastite_cronica' THEN 2 WHEN 'suspeito' THEN 3 WHEN 'quarentena' THEN 4 ELSE 5 END ${dir}, brinco`;
    default:
      return `brinco ${dir}`;
  }
}

export async function listarRebanho(f: FiltrosRebanho = {}): Promise<AnimalComResumo[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (f.categorias?.length) {
    where.push(`a.categoria IN (${f.categorias.map(() => '?').join(',')})`);
    params.push(...f.categorias);
  }
  if (f.status?.length) {
    where.push(`a.status IN (${f.status.map(() => '?').join(',')})`);
    params.push(...f.status);
  }
  if (!f.status?.length) where.push("a.status NOT IN ('morto','descartado','vendido')");
  if (f.loteId) {
    where.push('a.lote_id = ?');
    params.push(f.loteId);
  }
  if (f.semLote) {
    where.push('a.lote_id IS NULL');
  }
  if (f.sexo) {
    where.push('a.sexo = ?');
    params.push(f.sexo);
  }

  // Filtros sobre colunas derivadas precisam ficar fora do WHERE base.
  const having: string[] = [];

  // Busca por palavras: cada termo precisa aparecer em algum campo do animal,
  // então "holandesa lactação" encontra a vaca holandesa em lactação, e não
  // tudo que tem uma coisa ou outra. Acento e caixa já vêm normalizados na
  // coluna `texto_busca`.
  for (const termo of normalizarBusca(f.busca ?? '').split(/\s+/).filter(Boolean)) {
    having.push('texto_busca LIKE ?');
    params.push(`%${termo}%`);
  }

  if (f.delMin !== undefined) {
    having.push("CAST(julianday('now') - julianday(data_parto) AS INTEGER) >= ?");
    params.push(f.delMin);
  }
  if (f.delMax !== undefined) {
    having.push("CAST(julianday('now') - julianday(data_parto) AS INTEGER) <= ?");
    params.push(f.delMax);
  }
  if (f.idadeMinMeses !== undefined) {
    having.push('idade_meses >= ?');
    params.push(f.idadeMinMeses);
  }
  if (f.idadeMaxMeses !== undefined) {
    having.push('idade_meses IS NOT NULL AND idade_meses <= ?');
    params.push(f.idadeMaxMeses);
  }
  if (f.producaoMin !== undefined) {
    having.push('COALESCE(producao_media_dia, 0) >= ?');
    params.push(f.producaoMin);
  }
  if (f.producaoMax !== undefined) {
    having.push('COALESCE(producao_media_dia, 0) <= ?');
    params.push(f.producaoMax);
  }
  if (f.cmtPositivo) {
    having.push("(cmt_quartos LIKE '%1%' OR cmt_quartos LIKE '%2%' OR cmt_quartos LIKE '%3%')");
  }
  if (f.cmtMinimo) {
    // '3' só casa com 3; '2' casa com 2 e 3; '1' com 1, 2 e 3.
    const graus = ['1', '2', '3'].filter((g) => g >= f.cmtMinimo!);
    having.push(`(${graus.map(() => 'cmt_quartos LIKE ?').join(' OR ')})`);
    params.push(...graus.map((g) => `%${g}%`));
  }
  if (f.peitoPerdido) {
    having.push('qtd_pp > 0');
  }
  if (f.emCarencia) {
    having.push('carencia_leite_ate IS NOT NULL');
  }
  if (f.prenhe) {
    having.push('data_provavel_parto IS NOT NULL');
  }
  if (f.partoEmDias !== undefined) {
    having.push("data_provavel_parto IS NOT NULL AND data_provavel_parto BETWEEN date('now') AND date('now', ?)");
    params.push(`+${f.partoEmDias} day`);
  }

  const ordem = montarOrdenacao(f);

  const sql = `
    SELECT * FROM (${SQL_ANIMAL_RESUMO} ${where.length ? `AND ${where.join(' AND ')}` : ''})
    ${having.length ? `WHERE ${having.join(' AND ')}` : ''}
    ORDER BY ${ordem}
  `;

  const linhas = await consultar<LinhaResumo>(sql, params);
  const ref = hoje();
  return linhas.map((l) => montarResumo(l, ref));
}

export interface LoteComContagem {
  id: string;
  nome: string;
  animais: number;
}

/** Lotes da propriedade, com quantos animais vivos cada um tem. */
export async function listarLotes(): Promise<LoteComContagem[]> {
  return consultar<LoteComContagem>(
    `SELECT l.id, l.nome,
            (SELECT COUNT(*) FROM animal a WHERE a.lote_id = l.id AND a.deleted_at IS NULL AND a.status NOT IN ('morto','descartado','vendido')) AS animais
     FROM lote l ORDER BY l.nome`,
  );
}

export async function obterAnimal(id: string): Promise<AnimalComResumo | null> {
  const linha = await consultarUm<LinhaResumo>(`${SQL_ANIMAL_RESUMO} AND a.id = ?`, [id]);
  return linha ? montarResumo(linha, hoje()) : null;
}

const CAMPOS_ANIMAL = [
  'brinco', 'nome', 'tatuagem', 'categoria', 'sexo', 'raca', 'data_nascimento',
  'peso_nascimento', 'pelagem_sinal', 'pai_id', 'mae_id', 'pai_nome', 'lote_id',
  'status', 'origem', 'data_entrada', 'observacoes', ...Object.keys(COLUNAS_CADASTRO),
] as (keyof Animal)[];

export async function salvarAnimal(a: Partial<Animal> & { brinco: string }): Promise<string> {
  const atual = a.id ? await obterAnimal(a.id) : null;
  if (a.id && !atual) throw new Error('Animal não encontrado.');
  const dados = {
    categoria: 'vaca_lactacao', sexo: 'F', status: 'saudavel', origem: 'nascimento',
    data_entrada: hoje(), ...atual, ...a, brinco: a.brinco.trim(),
  } as Animal;
  validarCadastroAnimal(dados);
  const duplicado = await consultarUm<{ id: string }>(
    'SELECT id FROM animal WHERE brinco=? AND id<>?', [dados.brinco, a.id ?? ''],
  );
  if (duplicado) throw new Error('Já existe um animal com este brinco.');
  const agora = agoraISO();
  const valores = CAMPOS_ANIMAL.map((campo) => dados[campo] ?? null);
  if (a.id) {
    await executar(
      `UPDATE animal SET ${CAMPOS_ANIMAL.map((campo) => `${campo}=?`).join(',')}, updated_at=? WHERE id=?`,
      [...valores, agora, a.id],
    );
    // Ajusta somente lembretes de entrada ainda pendentes; preserva o histórico concluído.
    if (dados.data_entrada && dados.data_entrada !== atual?.data_entrada) {
      await executar(
        `UPDATE evento_calendario SET data=?, updated_at=? WHERE animal_id=?
         AND tipo='quarentena' AND origem='regra' AND status IN ('pendente','atrasado')`,
        [somarDias(dados.data_entrada, 30), agora, a.id],
      );
      await executar(
        `UPDATE evento_calendario SET data=?, updated_at=? WHERE animal_id=?
         AND tipo='exame_cmt' AND origem='regra' AND titulo LIKE 'CMT antes de entrar%'
         AND status IN ('pendente','atrasado')`,
        [somarDias(dados.data_entrada, 28), agora, a.id],
      );
    }
    if (dados.data_nascimento && dados.data_nascimento !== atual?.data_nascimento) {
      for (const [tipo, data] of [
        ['consulta', dados.data_nascimento], ['desmame', somarDias(dados.data_nascimento, 60)],
      ]) {
        await executar(
          `UPDATE evento_calendario SET data=?, updated_at=? WHERE animal_id=? AND tipo=?
           AND ((tipo='consulta' AND origem='regra' AND titulo LIKE 'Conferir colostragem%')
             OR (tipo='desmame' AND origem='automatico')) AND status IN ('pendente','atrasado')`,
          [data!, agora, a.id, tipo!],
        );
      }
    }
    if (dados.sexo !== 'F' || dados.categoria !== 'vaca_lactacao') {
      await executar(
        `UPDATE evento_calendario SET status='cancelado', updated_at=? WHERE animal_id=?
         AND tipo='exame_cmt' AND origem='regra' AND titulo LIKE 'CMT antes de entrar%'
         AND status IN ('pendente','atrasado')`, [agora, a.id],
      );
    }
    return a.id;
  }
  const id = novoId('ani');
  await executar(
    `INSERT INTO animal (id,${CAMPOS_ANIMAL.join(',')},created_at,updated_at)
     VALUES (${Array(CAMPOS_ANIMAL.length + 3).fill('?').join(',')})`,
    [id, ...valores, agora, agora],
  );
  return id;
}

/** Cadastro e lembretes são gravados juntos; editar não cria eventos duplicados. */
export async function registrarEntradaAnimal(
  animal: Partial<Animal> & { brinco: string },
  modo: 'novo' | 'nascimento',
): Promise<string> {
  let id = '';
  await emTransacao(async () => {
    if (!animal.id && modo === 'nascimento' && !animal.data_nascimento) {
      throw new Error('Informe a data de nascimento.');
    }
    id = await salvarAnimal(animal);
    if (animal.id) return;
    if (modo === 'nascimento') {
      await criarEvento({
        tipo: 'consulta', animalId: id, titulo: `Conferir colostragem — ${animal.brinco}`,
        descricao: 'Verificar se recebeu colostro de boa qualidade nas primeiras 6 horas.',
        data: animal.data_nascimento!, origem: 'regra',
      });
      await criarEvento({
        tipo: 'desmame', animalId: id, titulo: `Desmame previsto — ${animal.brinco}`,
        data: somarDias(animal.data_nascimento!, 60), origem: 'automatico',
      });
    } else {
      const entrada = animal.data_entrada ?? hoje();
      await criarEvento({
        tipo: 'quarentena', animalId: id, titulo: `Fim da quarentena — ${animal.brinco}`,
        descricao: 'Revisar os exames de entrada antes de liberar para o rebanho.',
        data: somarDias(entrada, 30), origem: 'regra',
      });
      if (animal.sexo === 'F' && animal.categoria === 'vaca_lactacao') {
        await criarEvento({
          tipo: 'exame_cmt', animalId: id,
          titulo: `CMT antes de entrar na ordenha — ${animal.brinco}`,
          data: somarDias(entrada, 28), origem: 'regra',
        });
      }
    }
  });
  return id;
}

export async function atualizarStatus(animalId: string, status: StatusAnimal): Promise<void> {
  await executar('UPDATE animal SET status=?, updated_at=? WHERE id=?', [
    status,
    agoraISO(),
    animalId,
  ]);
}

/**
 * A triagem indica suspeita, não confirma doença nem inicia tratamento.
 * Só sai de saudável: uma consulta inconclusiva não equivale a alta clínica.
 * Chamado dentro da transação que grava o prontuário e seus exames.
 */
export async function atualizarStatusAposTriagem(
  animalId: string,
  hipoteses: readonly { id: string; grupo: string; cf: number }[],
  bandeiraVermelha = false,
): Promise<void> {
  const suspeita = bandeiraVermelha || hipoteses.some((h) =>
    h.id !== 'sem_alteracao' && h.grupo !== 'rebanho' && Number.isFinite(h.cf) && h.cf > 0,
  );
  if (!suspeita) return;
  await executar(
    "UPDATE animal SET status='suspeito', updated_at=? WHERE id=? AND status='saudavel' AND deleted_at IS NULL",
    [agoraISO(), animalId],
  );
}

export async function composicaoRebanho(): Promise<ComposicaoRebanho> {
  const linhas = await consultar<{ categoria: CategoriaAnimal; n: number }>(
    `SELECT categoria, COUNT(*) AS n FROM animal
     WHERE deleted_at IS NULL AND status NOT IN ('morto','descartado','vendido')
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

/**
 * Lança (ou corrige) a produção de leite de uma vaca num dia: um lançamento
 * por animal+data, como a ficha de controle leiteiro da Embrapa — manhã e
 * tarde somadas no total que alimenta a média de produção e os gráficos.
 */
export async function registrarControleLeiteiro(
  animalId: string,
  data: string,
  litrosManha: number,
  litrosTarde: number,
  observacoes: string | null = null,
): Promise<void> {
  const agora = agoraISO();
  const litrosTotal = litrosManha + litrosTarde;
  const existente = await consultarUm<{ id: string }>(
    'SELECT id FROM controle_leiteiro WHERE animal_id=? AND data=?',
    [animalId, data],
  );
  if (existente) {
    await executar(
      `UPDATE controle_leiteiro
       SET litros_manha=?, litros_tarde=?, litros_total=?, observacoes=?, updated_at=?
       WHERE id=?`,
      [litrosManha, litrosTarde, litrosTotal, observacoes, agora, existente.id],
    );
    return;
  }
  await executar(
    `INSERT INTO controle_leiteiro
       (id, animal_id, data, litros_manha, litros_tarde, litros_total, observacoes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [novoId('controle'), animalId, data, litrosManha, litrosTarde, litrosTotal, observacoes, agora, agora],
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
  const inicioMes = `${prefixo}-01`;
  const fimMes = somarDias(inicioMes, diasNoMes(ano, mes) - 1);
  const referencia = hoje();

  const casos = await consultar<{ quartos: number; dias: number }>(
    `SELECT quartos,
            CAST(julianday(MIN(COALESCE(data_fim, ?), ?))
               - julianday(MAX(data_inicio, ?)) AS INTEGER) + 1 AS dias
     FROM caso_mastite
     WHERE tipo = 'clinica' AND data_inicio <= ?
       AND COALESCE(data_fim, ?) >= ?
       AND COALESCE(data_fim, ?) >= data_inicio`,
    [referencia, fimMes, inicioMes, fimMes, referencia, inicioMes, referencia],
  );

  const vacas = await consultarUm<{ n: number }>(
    `SELECT COUNT(*) AS n FROM animal
     WHERE categoria='vaca_lactacao' AND deleted_at IS NULL AND status NOT IN ('morto','descartado','vendido')`,
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

// ---------------------------------------------------------------------------
// Panorama de diagnósticos — todas as doenças, não só mastite
// ---------------------------------------------------------------------------

/** Uma hipótese como ficou gravada no atendimento (saída do motor). */
interface ConclusaoGravada {
  id: string;
  rotulo: string;
  grupo: string;
  cf: number;
  confianca: string;
  bandeiraVermelha: boolean;
}

export interface OcorrenciaDiagnostico {
  atendimentoId: string;
  animalId: string;
  brinco: string;
  nome: string | null;
  em: string;
  confianca: string;
  cf: number;
}

export interface DiagnosticoDoRebanho {
  id: string;
  rotulo: string;
  grupo: string;
  total: number;
  ultimaEm: string;
  bandeiraVermelha: boolean;
  ocorrencias: OcorrenciaDiagnostico[];
}

export interface PanoramaDiagnosticos {
  desde: string;
  /** Atendimentos concluídos no período. */
  atendimentos: number;
  /** Atendimentos que terminaram sem hipótese acima do limiar. */
  semConclusao: number;
  porGrupo: { grupo: string; total: number }[];
  diagnosticos: DiagnosticoDoRebanho[];
  bandeirasVermelhas: DiagnosticoDoRebanho[];
}

/** Abaixo disso a hipótese é dúvida, não diagnóstico — não entra na contagem. */
const CF_MINIMO_DIAGNOSTICO = 0.5;

/**
 * O que o rebanho teve, por doença e por grupo, segundo os atendimentos.
 *
 * Lê as conclusões gravadas pelo motor — qualquer uma das 28 hipóteses da base,
 * de hipocalcemia a laminite — e não só os casos de mastite, que têm tabela
 * própria por causa do CMT. Sem isto, a tela de saúde só sabia falar de úbere.
 *
 * O JSON é interpretado em JavaScript porque SQLite sem a extensão JSON1 não o
 * lê; o custo é limitado pela janela de dias, não pelo tamanho do histórico.
 */
export async function panoramaDiagnosticos(dias = 180): Promise<PanoramaDiagnosticos> {
  const desde = somarDias(hoje(), -dias);
  const linhas = await consultar<{
    id: string;
    animal_id: string;
    data_hora: string;
    conclusoes: string;
    brinco: string;
    animal_nome: string | null;
  }>(
    `SELECT at.id, at.animal_id, at.data_hora, at.conclusoes, a.brinco, a.nome AS animal_nome
     FROM atendimento at JOIN animal a ON a.id = at.animal_id
     WHERE at.status = 'concluido' AND date(at.data_hora) >= ?
     ORDER BY at.data_hora DESC`,
    [desde],
  );

  const porId = new Map<string, DiagnosticoDoRebanho>();
  let semConclusao = 0;

  for (const linha of linhas) {
    let conclusoes: ConclusaoGravada[] = [];
    try {
      const bruto: unknown = JSON.parse(linha.conclusoes || '[]');
      conclusoes = Array.isArray(bruto) ? (bruto as ConclusaoGravada[]) : [];
    } catch {
      // Atendimento gravado por uma versão anterior: conta como sem conclusão
      // em vez de derrubar o painel inteiro.
    }

    const relevantes = conclusoes.filter(
      (c) => c && c.id && c.id !== 'sem_alteracao' && (c.cf ?? 0) >= CF_MINIMO_DIAGNOSTICO,
    );
    if (!relevantes.length) {
      semConclusao += 1;
      continue;
    }

    for (const c of relevantes) {
      const atual = porId.get(c.id) ?? {
        id: c.id,
        rotulo: c.rotulo ?? c.id,
        grupo: c.grupo ?? 'triagem',
        total: 0,
        ultimaEm: linha.data_hora,
        bandeiraVermelha: Boolean(c.bandeiraVermelha),
        ocorrencias: [],
      };
      atual.total += 1;
      atual.bandeiraVermelha = atual.bandeiraVermelha || Boolean(c.bandeiraVermelha);
      if (linha.data_hora > atual.ultimaEm) atual.ultimaEm = linha.data_hora;
      atual.ocorrencias.push({
        atendimentoId: linha.id,
        animalId: linha.animal_id,
        brinco: linha.brinco,
        nome: linha.animal_nome,
        em: linha.data_hora,
        confianca: c.confianca ?? '',
        cf: c.cf ?? 0,
      });
      porId.set(c.id, atual);
    }
  }

  const diagnosticos = [...porId.values()].sort(
    (a, b) => b.total - a.total || (a.ultimaEm < b.ultimaEm ? 1 : -1),
  );

  const grupos = new Map<string, number>();
  for (const d of diagnosticos) grupos.set(d.grupo, (grupos.get(d.grupo) ?? 0) + d.total);

  return {
    desde,
    atendimentos: linhas.length,
    semConclusao,
    porGrupo: [...grupos.entries()]
      .map(([grupo, total]) => ({ grupo, total }))
      .sort((a, b) => b.total - a.total),
    diagnosticos,
    bandeirasVermelhas: diagnosticos.filter((d) => d.bandeiraVermelha),
  };
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

  await emTransacao(async () => {
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

    await criarEvento({ tipo: 'medicacao', animalId: t.animalId,
      titulo: `Início do tratamento — ${t.descricao}`, data: t.dataInicio,
      descricao: 'Data de início registrada para o tratamento.', origem: 'automatico', referenciaId: id });
    if (dataFim !== t.dataInicio) await criarEvento({ tipo: 'medicacao', animalId: t.animalId,
      titulo: `Fim do tratamento — ${t.descricao}`, data: dataFim,
      descricao: 'Data de fim registrada para o tratamento.', origem: 'automatico', referenciaId: id });

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

/** Eventos vinculados ao atendimento, incluindo os já concluídos. */
export async function eventosDoAtendimento(atendimentoId: string): Promise<EventoComAnimal[]> {
  return consultar<EventoComAnimal>(
    `SELECT e.*, a.brinco, a.nome AS animal_nome, at.id AS atendimento_id
     FROM evento_calendario e LEFT JOIN animal a ON a.id=e.animal_id
     JOIN atendimento at ON at.id=e.referencia_id
     WHERE e.referencia_id=? AND e.status <> 'cancelado' ORDER BY e.data, e.titulo`, [atendimentoId],
  );
}

export async function listarEventos(de: string, ate: string): Promise<EventoComAnimal[]> {
  return consultar<EventoComAnimal>(
    `SELECT e.*, a.brinco, a.nome AS animal_nome, at.id AS atendimento_id
     FROM evento_calendario e LEFT JOIN animal a ON a.id = e.animal_id
     LEFT JOIN atendimento at ON at.id = e.referencia_id
     WHERE ((e.data BETWEEN ? AND ?) OR (e.data < ? AND e.status IN ('pendente','atrasado')))
       AND e.status <> 'cancelado'
     ORDER BY e.data, e.tipo`,
    [de, ate, de],
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
