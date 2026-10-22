/**
 * Dados de demonstração — a propriedade do Sr. João.
 *
 * O rebanho, a área, o preço do leite e a estrutura de despesas vêm do exemplo
 * da cartilha "Administrando a propriedade leiteira" (Embrapa, 2016): 48 ha
 * (28 próprios + 20 arrendados), 2 pessoas na mão de obra, R$ 1,07/L e um rebanho
 * de 91 animais com a distribuição impressa na p. 45.
 *
 * O gerador é determinístico (PRNG com semente fixa): a demonstração de sexta-feira
 * mostra exatamente o mesmo rebanho que o ensaio de quinta.
 */
import { somarDias, hoje, type CategoriaAnimal } from '@drmoo/domain';
import { agoraISO, apagarTudo, consultarUm, emTransacao, executar, novoId } from './driver';

/** PRNG determinístico (mulberry32). */
function prng(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function bancoVazio(): Promise<boolean> {
  const r = await consultarUm<{ n: number }>('SELECT COUNT(*) AS n FROM animal');
  return (r?.n ?? 0) === 0;
}

/** Composição exata do rebanho do Sr. João em janeiro (cartilha, p. 45). */
const REBANHO: { categoria: CategoriaAnimal; quantidade: number; sexo: 'M' | 'F' }[] = [
  { categoria: 'touro', quantidade: 3, sexo: 'M' },
  { categoria: 'bezerro_mamando', quantidade: 4, sexo: 'F' },
  { categoria: 'bezerro_desmamado', quantidade: 13, sexo: 'F' },
  { categoria: 'bezerra_1_2_anos', quantidade: 16, sexo: 'F' },
  { categoria: 'novilha', quantidade: 13, sexo: 'F' },
  { categoria: 'vaca_seca', quantidade: 10, sexo: 'F' },
  { categoria: 'vaca_lactacao', quantidade: 32, sexo: 'F' },
];

const NOMES = [
  'Mimosa', 'Estrela', 'Pérola', 'Jurema', 'Bonita', 'Malhada', 'Preciosa', 'Aurora',
  'Serena', 'Gaivota', 'Formosa', 'Lua', 'Ametista', 'Canela', 'Dália', 'Esmeralda',
  'Flor', 'Guria', 'Hortência', 'Íris', 'Jade', 'Kiara', 'Linda', 'Maravilha',
  'Nina', 'Oliva', 'Paçoca', 'Quitéria', 'Rosa', 'Safira', 'Tulipa', 'Violeta',
];

const RACAS = ['Girolando', 'Holandesa', 'Jersey', 'Girolando', 'Girolando'];

const PELAGENS = [
  'P e B (preto e branco)',
  'B e P (branca e preta)',
  'Vermelha e branca',
  'P e B com mancha na barriga',
];

/** Categorias de despesa de janeiro do Sr. João (cartilha, p. 32-39). */
const DESPESAS_CARTILHA: { categoria: string; descricao: string; valor: number }[] = [
  { categoria: 'combustivel', descricao: 'Diesel para o trator', valor: 110 },
  { categoria: 'concentrados_sal', descricao: 'Concentrado para vacas e sal mineral', valor: 7351 + 201 },
  { categoria: 'energia_eletrica', descricao: 'Energia da atividade leiteira (metade da conta)', valor: 163 },
  { categoria: 'impostos', descricao: 'ITR e impostos municipais', valor: 281 + 100 },
  { categoria: 'leite_bezerras', descricao: 'Leite fornecido às bezerras (3,5 L × 4 × 31 dias)', valor: 464.38 },
  { categoria: 'manutencao_benfeitorias', descricao: 'Reparo de pneu do trator', valor: 95 },
  { categoria: 'mao_de_obra_eventual', descricao: 'Serviços gerais (3 diárias de R$ 60)', valor: 180 },
  { categoria: 'material_consumo', descricao: 'Cordas, pregos e vassouras', valor: 33 + 28 + 45 },
  { categoria: 'pasto', descricao: 'Conserto de cercas e calcário', valor: 290 + 21 },
  { categoria: 'reproducao', descricao: 'Botijão de nitrogênio e doses de sêmen', valor: 120 + 269 },
  { categoria: 'sanidade_medicamentos', descricao: 'Veterinário, medicamentos, vacinas e curativos', valor: 450 + 72 + 402 + 48 },
  { categoria: 'telefone_internet', descricao: 'Telefonia e internet (metade da conta)', valor: 40 },
  { categoria: 'volumoso', descricao: 'Limpeza do canavial', valor: 35 },
  { categoria: 'outros', descricao: 'Inscrição no Torneio Leiteiro', valor: 25 },
];

const MEDICAMENTOS = [
  { nome: 'Mastite intramamária (lactação)', principio: 'Cefalexina + gentamicina', apres: 'Bisnaga 10 g', custo: 18.5, carenciaLeite: 4, carenciaCarne: 10, estoque: 24 },
  { nome: 'Antibiótico sistêmico', principio: 'Oxitetraciclina LA', apres: 'Frasco 50 mL', custo: 62.0, carenciaLeite: 7, carenciaCarne: 28, estoque: 6 },
  { nome: 'Anti-inflamatório', principio: 'Flunixin meglumine', apres: 'Frasco 50 mL', custo: 78.0, carenciaLeite: 3, carenciaCarne: 12, estoque: 4 },
  { nome: 'Cálcio injetável', principio: 'Borogluconato de cálcio', apres: 'Frasco 500 mL', custo: 23.0, carenciaLeite: 0, carenciaCarne: 0, estoque: 10 },
  { nome: 'Carrapaticida', principio: 'Cipermetrina + clorpirifós', apres: 'Frasco 1 L', custo: 95.0, carenciaLeite: 0, carenciaCarne: 5, estoque: 3 },
  // Ampliação da gama: cobre as hipóteses que o motor passou a diagnosticar
  // (hipomagnesemia, sarna/dermatofitose, deficiência de fósforo, reprodutivas,
  // cetose e intoxicação) e que antes não tinham nenhum item correspondente
  // no estoque — a conduta dizia "procure o veterinário" sem o produto existir
  // no cadastro da propriedade.
  { nome: 'Magnésio injetável', principio: 'Sulfato de magnésio', apres: 'Frasco 500 mL', custo: 31.0, carenciaLeite: 0, carenciaCarne: 0, estoque: 6 },
  { nome: 'Endectocida (vermífugo e carrapaticida)', principio: 'Ivermectina 1%', apres: 'Frasco 500 mL', custo: 68.0, carenciaLeite: 0, carenciaCarne: 35, estoque: 5 },
  { nome: 'Antifúngico/antissárnico tópico', principio: 'Enxofre + iodo tópico', apres: 'Frasco 1 L', custo: 42.0, carenciaLeite: 0, carenciaCarne: 0, estoque: 4 },
  { nome: 'Suplemento fosfatado injetável', principio: 'Fósforo orgânico + vitaminas ADE', apres: 'Frasco 100 mL', custo: 36.0, carenciaLeite: 0, carenciaCarne: 0, estoque: 8 },
  { nome: 'Energético oral (cetose)', principio: 'Propilenoglicol', apres: 'Frasco 1 L', custo: 29.0, carenciaLeite: 0, carenciaCarne: 0, estoque: 10 },
  { nome: 'Hormônio reprodutivo', principio: 'Prostaglandina F2alfa (dinoprost)', apres: 'Frasco 20 mL', custo: 54.0, carenciaLeite: 0, carenciaCarne: 0, estoque: 3 },
  { nome: 'Antibiótico intrauterino', principio: 'Cefapirina benzatina', apres: 'Bisnaga uterina', custo: 26.0, carenciaLeite: 4, carenciaCarne: 8, estoque: 6 },
  { nome: 'Soro de reidratação oral', principio: 'Eletrólitos + glicose', apres: 'Sachê 80 g', custo: 7.5, carenciaLeite: 0, carenciaCarne: 0, estoque: 30 },
  { nome: 'Carvão ativado veterinário', principio: 'Carvão ativado', apres: 'Frasco 500 g', custo: 45.0, carenciaLeite: 0, carenciaCarne: 0, estoque: 2 },
];

const VACINAS = [
  { nome: 'Febre aftosa', doenca: 'Febre aftosa', intervalo: 6, obrigatoria: 1 },
  { nome: 'Raiva', doenca: 'Raiva dos herbívoros', intervalo: 12, obrigatoria: 1 },
  { nome: 'Brucelose (B19)', doenca: 'Brucelose', intervalo: 0, obrigatoria: 1 },
  { nome: 'Clostridioses', doenca: 'Carbúnculo, botulismo', intervalo: 12, obrigatoria: 0 },
  // Cobrem causas infecciosas de repetição de cio e de problema respiratório
  // que o motor passou a diagnosticar (grupos reprodutivas e parasitárias).
  { nome: 'Leptospirose', doenca: 'Leptospirose (aborto e repetição de cio)', intervalo: 6, obrigatoria: 0 },
  { nome: 'IBR/BVD', doenca: 'Rinotraqueíte e diarreia viral bovina', intervalo: 12, obrigatoria: 0 },
];

export async function semear(): Promise<void> {
  await emTransacao(semearDados);
}

/** Recria a demonstração sem perder os dados anteriores se o seed falhar. */
export async function recriarDemonstracao(): Promise<void> {
  await apagarTudo(semearDados);
}

async function semearDados(): Promise<void> {
  const r = prng(20261021);
  const hj = hoje();
  const agora = agoraISO();
  const ins = (sql: string, p: (string | number | null)[]) => executar(sql, p);

  // -----------------------------------------------------------------------
  // Propriedade e lotes
  // -----------------------------------------------------------------------
  const propId = novoId('prop');
  await ins(
    `INSERT INTO propriedade (id, nome, area_propria_ha, area_arrendada_ha, mao_de_obra_pessoas,
      preco_leite_litro, mao_de_obra_familiar_mes, reposicao_investimento_mes, gestacao_dias,
      created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [propId, 'Sítio Boa Esperança', 28, 20, 2, 1.07, 2640, 4000, 283, agora, agora],
  );

  const lotes = [
    { id: novoId('lot'), nome: 'Lote 1 — alta produção' },
    { id: novoId('lot'), nome: 'Lote 2 — média produção' },
    { id: novoId('lot'), nome: 'Lote 3 — fim de lactação' },
    { id: novoId('lot'), nome: 'Bezerreiro' },
    { id: novoId('lot'), nome: 'Recria' },
  ];
  for (const l of lotes) {
    await ins('INSERT INTO lote (id, nome, created_at, updated_at) VALUES (?,?,?,?)', [
      l.id, l.nome, agora, agora,
    ]);
  }

  // -----------------------------------------------------------------------
  // Rebanho
  // -----------------------------------------------------------------------
  interface AnimalSeed {
    id: string;
    brinco: string;
    categoria: CategoriaAnimal;
    del?: number;
    lactacao?: number;
    mediaDia?: number;
  }
  const criados: AnimalSeed[] = [];
  let numeroBrinco = 100;
  let indiceNome = 0;

  for (const grupo of REBANHO) {
    for (let i = 0; i < grupo.quantidade; i++) {
      const id = novoId('ani');
      const brinco = String(++numeroBrinco);
      const ehVacaLeite = grupo.categoria === 'vaca_lactacao';
      const nome = grupo.categoria.startsWith('vaca') ? NOMES[indiceNome++ % NOMES.length]! : null;

      const idadeDias =
        grupo.categoria === 'bezerro_mamando'
          ? 5 + Math.floor(r() * 50)
          : grupo.categoria === 'bezerro_desmamado'
            ? 70 + Math.floor(r() * 290)
            : grupo.categoria === 'bezerra_1_2_anos'
              ? 366 + Math.floor(r() * 364)
              : grupo.categoria === 'novilha'
                ? 740 + Math.floor(r() * 300)
                : 1100 + Math.floor(r() * 2200);

      const lote =
        grupo.categoria === 'bezerro_mamando'
          ? lotes[3]!.id
          : grupo.categoria === 'bezerro_desmamado' || grupo.categoria === 'bezerra_1_2_anos'
            ? lotes[4]!.id
            : ehVacaLeite
              ? lotes[Math.floor(r() * 3)]!.id
              : lotes[2]!.id;

      await ins(
        `INSERT INTO animal (id, brinco, nome, categoria, sexo, raca, data_nascimento,
          peso_nascimento, pelagem_sinal, lote_id, status, origem, data_entrada, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          brinco,
          nome,
          grupo.categoria,
          grupo.sexo,
          RACAS[Math.floor(r() * RACAS.length)]!,
          somarDias(hj, -idadeDias),
          30 + Math.round(r() * 15),
          PELAGENS[Math.floor(r() * PELAGENS.length)]!,
          lote,
          'saudavel',
          'nascimento',
          somarDias(hj, -idadeDias),
          agora,
          agora,
        ],
      );

      const seed: AnimalSeed = { id, brinco, categoria: grupo.categoria };

      if (ehVacaLeite) {
        const del = 10 + Math.floor(r() * 280);
        const numero = 1 + Math.floor(r() * 5);
        // Curva de lactação simplificada: pico por volta dos 60 DEL.
        const mediaDia = Math.max(
          6,
          Math.round((26 - Math.abs(del - 60) * 0.045) * (0.85 + r() * 0.3) * 10) / 10,
        );
        const dataParto = somarDias(hj, -del);
        await ins(
          `INSERT INTO lactacao (id, animal_id, numero, data_parto, data_secagem_prevista,
            encerrada, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
          [novoId('lac'), id, numero, dataParto, somarDias(dataParto, 305), 0, agora, agora],
        );
        Object.assign(seed, { del, lactacao: numero, mediaDia });
      }

      criados.push(seed);
    }
  }

  const vacasLeite = criados.filter((a) => a.categoria === 'vaca_lactacao');

  // -----------------------------------------------------------------------
  // Controle leiteiro mensal (últimos 6 meses) e produção diária (90 dias)
  // -----------------------------------------------------------------------
  for (const vaca of vacasLeite) {
    for (let mesAtras = 0; mesAtras < 6; mesAtras++) {
      const data = somarDias(hj, -mesAtras * 30 - 2);
      const base = (vaca.mediaDia ?? 18) * (1 + mesAtras * 0.02);
      const manha = Math.round(base * 0.58 * 10) / 10;
      const tarde = Math.round((base - manha) * 10) / 10;
      await ins(
        `INSERT INTO controle_leiteiro (id, animal_id, data, litros_manha, litros_tarde,
          litros_total, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
        [novoId('ctl'), vaca.id, data, manha, tarde, Math.round((manha + tarde) * 10) / 10, agora, agora],
      );
    }
  }

  const producaoBaseDia = vacasLeite.reduce((t, v) => t + (v.mediaDia ?? 18), 0);
  for (let d = 90; d >= 0; d--) {
    const data = somarDias(hj, -d);
    const total = Math.round(producaoBaseDia * (0.94 + r() * 0.12));
    const bezerros = 28 + Math.round(r() * 4);
    const consumo = 8 + Math.round(r() * 3);
    const derivados = 65 + Math.round(r() * 10);
    await ins(
      `INSERT INTO producao_propriedade (id, data, litros_vendidos, litros_bezerros,
        litros_consumo_doacao, litros_derivados, litros_total, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        novoId('pro'),
        data,
        total - bezerros - consumo - derivados,
        bezerros,
        consumo,
        derivados,
        total,
        agora,
        agora,
      ],
    );
  }

  // -----------------------------------------------------------------------
  // CMT mensal (últimos 4 meses) — a maioria negativa, algumas crônicas
  // -----------------------------------------------------------------------
  const cronicas = vacasLeite.slice(0, 3);
  for (const vaca of vacasLeite) {
    const ehCronica = cronicas.includes(vaca);
    for (let mesAtras = 0; mesAtras < 4; mesAtras++) {
      const data = somarDias(hj, -mesAtras * 30 - 3);
      const sorteio = () => {
        if (ehCronica) return r() < 0.6 ? '2' : '1';
        const x = r();
        if (x < 0.76) return 'N';
        if (x < 0.88) return 'T';
        if (x < 0.95) return '1';
        return '2';
      };
      await ins(
        `INSERT INTO exame_cmt (id, animal_id, data, ad, ae, pd, pe, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          novoId('cmt'),
          vaca.id,
          data,
          ehCronica && mesAtras === 0 ? sorteio() : sorteio(),
          r() < 0.9 ? 'N' : sorteio(),
          sorteio(),
          r() < 0.9 ? 'N' : 'T',
          agora,
          agora,
        ],
      );
    }
    if (ehCronica) {
      await ins('UPDATE animal SET status=?, updated_at=? WHERE id=?', [
        'mastite_cronica',
        agora,
        vaca.id,
      ]);
    }
  }

  // CCS individual para um punhado de vacas
  for (const vaca of vacasLeite.slice(0, 8)) {
    await ins(
      `INSERT INTO exame_ccs (id, animal_id, tanque, data, celulas_ml, created_at, updated_at)
       VALUES (?,?,0,?,?,?,?)`,
      [
        novoId('ccs'),
        vaca.id,
        somarDias(hj, -12),
        Math.round(80000 + r() * 420000),
        agora,
        agora,
      ],
    );
  }

  // -----------------------------------------------------------------------
  // Medicamentos e vacinas
  // -----------------------------------------------------------------------
  const medIds: string[] = [];
  for (const m of MEDICAMENTOS) {
    const id = novoId('med');
    medIds.push(id);
    await ins(
      `INSERT INTO medicamento (id, nome, principio_ativo, apresentacao, custo_unidade,
        carencia_leite_dias, carencia_carne_dias, estoque, validade, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, m.nome, m.principio, m.apres, m.custo, m.carenciaLeite, m.carenciaCarne,
        m.estoque, somarDias(hj, 120 + Math.floor(r() * 400)), agora, agora,
      ],
    );
  }

  const vacIds: string[] = [];
  for (const v of VACINAS) {
    const id = novoId('vac');
    vacIds.push(id);
    await ins(
      `INSERT INTO vacina (id, nome, doenca_alvo, intervalo_meses, obrigatoria, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?)`,
      [id, v.nome, v.doenca, v.intervalo, v.obrigatoria, agora, agora],
    );
  }

  // -----------------------------------------------------------------------
  // Casos plantados para a demonstração
  // -----------------------------------------------------------------------

  // (a) Vaca em carência de antibiótico — leite não pode ir para o tanque.
  const emCarencia = vacasLeite[5]!;
  const inicioTrat = somarDias(hj, -2);
  await ins(
    `INSERT INTO tratamento (id, animal_id, medicamento_id, dose, via, data_inicio, data_fim,
      carencia_leite_ate, carencia_carne_ate, responsavel, custo_total, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      novoId('tra'), emCarencia.id, medIds[0]!, '1 bisnaga por quarto, 2× ao dia',
      'Intramamária', inicioTrat, somarDias(hj, 1), somarDias(hj, 5), somarDias(hj, 11),
      'Sr. João', 74.0, agora, agora,
    ],
  );
  await ins('UPDATE animal SET status=?, updated_at=? WHERE id=?', ['em_carencia', agora, emCarencia.id]);
  await ins(
    `INSERT INTO evento_calendario (id, tipo, animal_id, titulo, descricao, data, status, origem,
      created_at, updated_at) VALUES (?,?,?,?,?,?,'pendente','automatico',?,?)`,
    [
      novoId('evt'), 'medicacao', emCarencia.id,
      `Fim da carência — ${emCarencia.brinco}`,
      'O leite volta a poder ir para o tanque.', somarDias(hj, 5), agora, agora,
    ],
  );

  // (b) Caso de mastite clínica grau 1 em aberto.
  const g1 = vacasLeite[9]!;
  await ins(
    `INSERT INTO caso_mastite (id, animal_id, quartos, tipo, grau, data_inicio, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [novoId('mas'), g1.id, 1, 'clinica', 1, somarDias(hj, -4), agora, agora],
  );
  await ins('UPDATE animal SET status=?, updated_at=? WHERE id=?', ['em_tratamento', agora, g1.id]);

  // (c) Dois casos clínicos fechados no mês — alimentam o % de mastite clínica.
  for (const [indice, dados] of [
    [14, { quartos: 2, dias: 5 }],
    [21, { quartos: 1, dias: 9 }],
  ] as const) {
    const vaca = vacasLeite[indice]!;
    await ins(
      `INSERT INTO caso_mastite (id, animal_id, quartos, tipo, grau, data_inicio, data_fim,
        desfecho, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        novoId('mas'), vaca.id, dados.quartos, 'clinica', 2,
        somarDias(hj, -dados.dias - 3), somarDias(hj, -3), 'curado', agora, agora,
      ],
    );
  }

  // (d) Bezerra recém-nascida pendente de colostro.
  const bezerra = criados.find((a) => a.categoria === 'bezerro_mamando')!;
  await ins('UPDATE animal SET data_nascimento=?, data_entrada=?, updated_at=? WHERE id=?', [
    somarDias(hj, -2), somarDias(hj, -2), agora, bezerra.id,
  ]);
  await ins(
    `INSERT INTO evento_calendario (id, tipo, animal_id, titulo, descricao, data, status, origem,
      created_at, updated_at) VALUES (?,?,?,?,?,?,'pendente','regra',?,?)`,
    [
      novoId('evt'), 'consulta', bezerra.id,
      `Conferir colostragem — bezerra ${bezerra.brinco}`,
      'Verificar se recebeu colostro de boa qualidade nas primeiras horas de vida.',
      hj, agora, agora,
    ],
  );

  // -----------------------------------------------------------------------
  // Calendário sanitário e rotinas
  // -----------------------------------------------------------------------
  await ins(
    `INSERT INTO evento_calendario (id, tipo, titulo, descricao, data, recorrencia, status, origem,
      created_at, updated_at) VALUES (?,?,?,?,?,?,'pendente','regra',?,?)`,
    [
      novoId('evt'), 'exame_cmt', 'CMT mensal de todo o rebanho',
      'Teste de CMT em todos os quartos das vacas em lactação, antes da ordenha.',
      somarDias(hj, 3), 'mensal', agora, agora,
    ],
  );
  await ins(
    `INSERT INTO evento_calendario (id, tipo, titulo, descricao, data, status, origem,
      created_at, updated_at) VALUES (?,?,?,?,?,'pendente','regra',?,?)`,
    [
      novoId('evt'), 'vacinacao', 'Vacinação contra febre aftosa',
      'Etapa obrigatória conforme calendário oficial do estado.',
      somarDias(hj, -2), agora, agora, // vencido de propósito: aparece como atraso
    ],
  );
  await ins(
    `INSERT INTO evento_calendario (id, tipo, titulo, descricao, data, status, origem,
      created_at, updated_at) VALUES (?,?,?,?,?,'pendente','regra',?,?)`,
    [
      novoId('evt'), 'manejo', 'Controle estratégico de carrapatos',
      'Orientação da cartilha para prevenir tristeza parasitária.',
      somarDias(hj, 6), agora, agora,
    ],
  );

  // -----------------------------------------------------------------------
  // Financeiro: estrutura de despesas do Sr. João nos últimos 3 meses
  // -----------------------------------------------------------------------
  for (let mesAtras = 0; mesAtras < 3; mesAtras++) {
    const dia = somarDias(hj, -mesAtras * 30 - 5);
    const variacao = mesAtras === 0 ? 1 : 0.92 + r() * 0.16;

    for (const d of DESPESAS_CARTILHA) {
      await ins(
        `INSERT INTO despesa (id, data, categoria, descricao, valor, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?)`,
        [novoId('des'), dia, d.categoria, d.descricao, Math.round(d.valor * variacao * 100) / 100, agora, agora],
      );
    }

    await ins(
      `INSERT INTO receita (id, data, categoria, descricao, valor, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?)`,
      [novoId('rec'), dia, 'venda_leite', 'Venda de leite para a indústria', Math.round(19137 * variacao * 100) / 100, agora, agora],
    );
    if (mesAtras === 0) {
      await ins(
        `INSERT INTO receita (id, data, categoria, descricao, valor, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?)`,
        [novoId('rec'), dia, 'venda_animais', 'Venda de duas novilhas a R$ 1.600 cada', 3200, agora, agora],
      );
      await ins(
        `INSERT INTO receita (id, data, categoria, descricao, valor, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?)`,
        [novoId('rec'), dia, 'outras_vendas', 'Venda de 1 tonelada de esterco', 200, agora, agora],
      );
    }
  }

  // Mortes registradas (causas reais citadas na cartilha, p. 23)
  const bezerraMorta = criados.filter((a) => a.categoria === 'bezerro_desmamado')[0]!;
  await ins(
    `INSERT INTO morte (id, animal_id, data, categoria_na_morte, causa, orientacoes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      novoId('mor'), bezerraMorta.id, somarDias(hj, -40), 'Bezerra', 'Diarreia',
      'Verifique se o leite fornecido para as bezerras está em boa qualidade higiênica e limpe o bezerreiro.',
      agora, agora,
    ],
  );
  await ins('UPDATE animal SET status=?, updated_at=? WHERE id=?', ['morto', agora, bezerraMorta.id]);
}
