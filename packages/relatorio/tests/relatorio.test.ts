/**
 * Os relatórios viram PDF e saem da propriedade pelo WhatsApp: o que estiver
 * errado aqui chega ao veterinário como se fosse verdade. Daí os testes.
 */
import { describe, expect, it } from 'vitest';
import {
  escapar,
  graficoBarras,
  graficoLinha,
  graficoRosca,
  htmlEstatisticas,
  htmlProntuario,
  type DadosEstatisticas,
  type DadosProntuario,
} from '../src/index';

const GERADO_EM = '2026-10-22T09:30:00.000Z';

function prontuario(): DadosProntuario {
  return {
    propriedade: 'Sítio Boa Esperança',
    animal: {
      brinco: '101',
      nome: 'Mimosa',
      categoria: 'Vaca em lactação',
      raca: 'Girolando',
      idadeMeses: 62,
      del: 120,
      producaoMediaDia: 16.4,
      lote: 'Alta produção',
    },
    atendimento: {
      id: 'ate_1',
      dataHora: '2026-10-20T08:00:00.000Z',
      queixaPrincipal: 'Leite com grumos',
      kbVersao: '1.0.0',
      engineVersao: '1.0.0',
      motivoParada: 'conclusao',
    },
    hipoteses: [
      {
        id: 'mastite_clinica_g1',
        rotulo: 'Mastite clínica — grau 1',
        descricao: 'Alteração apenas no leite.',
        confianca: 'Muito provável',
        cf: 0.92,
        bandeiraVermelha: false,
        conduta: ['Ordenhar o quarto afetado por último.'],
        fontes: ['Embrapa, Mastite, p. 21'],
        status: 'validada',
      },
    ],
    bandeiraVermelha: null,
    respostas: [{ variavel: 'grumos_no_leite', rotulo: 'Há grumos no leite?', valor: 'sim', cf: 1 }],
    traco: 'R-MASTITE-01 disparou com CF 0,92',
    reproduz: true,
    geradoEm: GERADO_EM,
  };
}

describe('prontuário em HTML', () => {
  it('leva parecer, conduta, respostas e traço', () => {
    const html = htmlProntuario(prontuario());

    expect(html).toContain('Mastite clínica — grau 1');
    expect(html).toContain('Ordenhar o quarto afetado por último.');
    expect(html).toContain('Há grumos no leite?');
    expect(html).toContain('R-MASTITE-01 disparou com CF 0,92');
    expect(html).toContain('Embrapa, Mastite, p. 21');
  });

  it('destaca a bandeira vermelha no topo', () => {
    const d = prontuario();
    d.bandeiraVermelha = {
      id: 'suspeita_raiva',
      rotulo: 'Suspeita de raiva',
      descricao: 'Zoonose de notificação obrigatória.',
      confianca: 'Possível',
      cf: 0.6,
      bandeiraVermelha: true,
      conduta: ['Isolar o animal e acionar o serviço veterinário oficial.'],
      fontes: [],
      status: 'revisar',
    };

    const html = htmlProntuario(d);
    expect(html).toContain('BANDEIRA VERMELHA — Suspeita de raiva');
    expect(html).toContain('destaque alerta');
  });

  it('diz quando o recálculo diverge do gravado', () => {
    const d = prontuario();
    d.reproduz = false;
    expect(htmlProntuario(d)).toContain('difere do gravado');
  });

  it('não deixa texto do usuário virar HTML', () => {
    const d = prontuario();
    d.animal.nome = '<script>alert(1)</script>';
    const html = htmlProntuario(d);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapa aspas e e comercial', () => {
    expect(escapar('Lote "A" & Lote B')).toBe('Lote &quot;A&quot; &amp; Lote B');
  });
});

function estatisticas(): DadosEstatisticas {
  return {
    propriedade: { nome: 'Sítio Boa Esperança', areaTotalHa: 48, pessoas: 2, precoLeiteLitro: 1.07 },
    periodo: { de: '22/09/2026', ate: '22/10/2026', rotuloMes: 'setembro de 2026' },
    producaoDiaria: [
      { rotulo: '20/10', valor: 480 },
      { rotulo: '21/10', valor: 502 },
      { rotulo: '22/10', valor: 495 },
    ],
    composicaoRebanho: [
      { rotulo: 'Vacas em lactação', valor: 32 },
      { rotulo: 'Vacas secas', valor: 10 },
    ],
    rebanhoTotal: 42,
    indicadoresTecnicos: [{ rotulo: 'Produção mensal', valor: '14.500 L' }],
    mastite: {
      percentualClinica: 3.1,
      percentualSubclinica: 18,
      metaClinica: 2,
      metaSubclinica: 20,
      vacasTestadas: 32,
      vacasPositivas: 6,
      diasDesdeUltimoCMT: 12,
      cronicas: [{ brinco: '105', nome: 'Jurema', meses: 4 }],
    },
    diagnosticos: {
      atendimentos: 9,
      porGrupo: [
        { rotulo: 'Mastite', valor: 5 },
        { rotulo: 'Metabólicas', valor: 2 },
      ],
      porDoenca: [{ rotulo: 'Cetose', valor: 2 }],
      bandeirasVermelhas: ['Suspeita de raiva (1)'],
    },
    tratamentosVsLeite: {
      receita: 12000,
      tratamentos: 850,
      descarte: 420,
      margem: 11150,
      litros: 11214,
      porVaca: [
        { brinco: '101', nome: 'Mimosa', litros: 1500, custoTratamentos: 120, perdaPorDescarte: 60, margem: 1485 },
        { brinco: '105', nome: 'Jurema', litros: 900, custoTratamentos: 400, perdaPorDescarte: 210, margem: 230 },
      ],
    },
    contextoEconomico: {
      margemBruta: 5400,
      margemLiquida: 3100,
      custoPorLitro: 0.82,
      totalDespesas: 9100,
      despesasPorCategoria: [{ rotulo: 'Concentrado', valor: 4200 }],
      mesFechado: true,
    },
    geradoEm: GERADO_EM,
  };
}

describe('relatório de estatísticas', () => {
  it('reúne produção, rebanho, úbere, diagnósticos e a relação tratamentos × leite', () => {
    const html = htmlEstatisticas(estatisticas());

    expect(html).toContain('Produção de leite');
    expect(html).toContain('Composição do rebanho');
    expect(html).toContain('Saúde do úbere');
    expect(html).toContain('Diagnósticos por grupo de doença');
    expect(html).toContain('Tratamentos médicos × produção de leite');
    expect(html).toContain('Jurema');
  });

  it('deixa explícito o recorte da análise de lucro', () => {
    const html = htmlEstatisticas(estatisticas());
    expect(html).toContain('Apenas o leite que cada vaca produziu');
    expect(html).toContain('Não faz parte da análise de lucro acima');
  });

  it('alerta quando a mastite clínica passa da meta', () => {
    expect(htmlEstatisticas(estatisticas())).toContain('Mastite clínica acima da meta');
  });

  it('sai inteiro mesmo sem dado nenhum', () => {
    const vazio: DadosEstatisticas = {
      ...estatisticas(),
      producaoDiaria: [],
      composicaoRebanho: [],
      indicadoresTecnicos: [],
      diagnosticos: { atendimentos: 0, porGrupo: [], porDoenca: [], bandeirasVermelhas: [] },
      tratamentosVsLeite: { receita: 0, tratamentos: 0, descarte: 0, margem: 0, litros: 0, porVaca: [] },
      contextoEconomico: null,
      mastite: { ...estatisticas().mastite, cronicas: [] },
    };

    const html = htmlEstatisticas(vazio);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Sem dados para o período.');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
  });
});

describe('gráficos em SVG', () => {
  it('a linha precisa de pelo menos dois pontos', () => {
    expect(graficoLinha([{ rotulo: 'a', valor: 1 }])).toContain('Sem dados');
    expect(graficoLinha([{ rotulo: 'a', valor: 1 }, { rotulo: 'b', valor: 2 }])).toContain('<svg');
  });

  it('as barras cabem no trilho, mesmo com um valor dominante', () => {
    const svg = graficoBarras([
      { rotulo: 'Concentrado', valor: 10000 },
      { rotulo: 'Sal mineral', valor: 50 },
    ]);
    expect(svg).toContain('Concentrado');
    expect(svg).toContain('Sal mineral');
    expect(svg).not.toContain('NaN');
  });

  it('a rosca fecha 100% com uma fatia só', () => {
    const svg = graficoRosca([{ rotulo: 'Vacas', valor: 10 }]);
    expect(svg).toContain('100.0%');
    expect(svg).not.toContain('NaN');
  });

  it('sem total não desenha rosca', () => {
    expect(graficoRosca([{ rotulo: 'Vacas', valor: 0 }])).toContain('Sem dados');
  });
});
