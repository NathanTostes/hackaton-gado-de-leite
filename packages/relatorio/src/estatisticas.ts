/**
 * Relatório completo da propriedade — todos os gráficos e estatísticas num PDF.
 *
 * É o documento que o produtor leva para o banco, para o técnico da cooperativa
 * ou para a reunião da associação: produção, rebanho, saúde do úbere,
 * diagnósticos por grupo de doença, a relação tratamentos × leite e o contexto
 * econômico — cada bloco dizendo de onde veio o número.
 */
import { moeda, numero, percentual } from '@drmoo/domain';
import { graficoBarras, graficoLinha, graficoRosca, type PontoSerie } from './graficos';
import { cartao, cartoes, destaque, documento, escapar, tabela } from './html';

export interface DadosEstatisticas {
  propriedade: {
    nome: string;
    areaTotalHa: number;
    pessoas: number;
    precoLeiteLitro: number;
  } | null;
  periodo: { de: string; ate: string; rotuloMes: string };

  producaoDiaria: PontoSerie[];
  composicaoRebanho: PontoSerie[];
  rebanhoTotal: number;

  indicadoresTecnicos: { rotulo: string; valor: string; nota?: string }[];

  mastite: {
    percentualClinica: number;
    percentualSubclinica: number;
    metaClinica: number;
    metaSubclinica: number;
    vacasTestadas: number;
    vacasPositivas: number;
    diasDesdeUltimoCMT: number | null;
    cronicas: { brinco: string; nome: string | null; meses: number }[];
  };

  diagnosticos: {
    atendimentos: number;
    porGrupo: PontoSerie[];
    porDoenca: PontoSerie[];
    bandeirasVermelhas: string[];
  };

  tratamentosVsLeite: {
    receita: number;
    tratamentos: number;
    descarte: number;
    margem: number;
    litros: number;
    porVaca: {
      brinco: string;
      nome: string | null;
      litros: number;
      custoTratamentos: number;
      perdaPorDescarte: number;
      margem: number;
    }[];
  };

  contextoEconomico: {
    margemBruta: number;
    margemLiquida: number;
    custoPorLitro: number;
    totalDespesas: number;
    despesasPorCategoria: PontoSerie[];
    mesFechado: boolean;
  } | null;

  geradoEm: string;
}

export function htmlEstatisticas(d: DadosEstatisticas): string {
  const t = d.tratamentosVsLeite;
  const piores = [...t.porVaca].sort((a, b) => a.margem - b.margem).slice(0, 10);

  const corpo = `
    <h2>Produção de leite</h2>
    <div class="secao">
      ${cartoes([
        cartao(
          'Produção no período',
          `${numero(d.producaoDiaria.reduce((s, p) => s + p.valor, 0), 0)} L`,
          `${d.periodo.de} a ${d.periodo.ate}`,
        ),
        cartao(
          'Média diária',
          `${numero(
            d.producaoDiaria.length
              ? d.producaoDiaria.reduce((s, p) => s + p.valor, 0) / d.producaoDiaria.length
              : 0,
            1,
          )} L`,
        ),
        d.propriedade ? cartao('Preço recebido', moeda(d.propriedade.precoLeiteLitro), 'por litro') : '',
      ].filter(Boolean))}
      ${graficoLinha(d.producaoDiaria, { unidade: 'litros por dia' })}
    </div>

    <h2>Composição do rebanho</h2>
    <div class="secao">
      ${graficoRosca(d.composicaoRebanho)}
    </div>

    <h2>Indicadores técnicos</h2>
    <div class="secao">
      ${tabela(
        [
          { titulo: 'Indicador', valor: (i: { rotulo: string }) => i.rotulo },
          { titulo: 'Valor', numero: true, valor: (i: { valor: string }) => i.valor },
          { titulo: 'Referência', valor: (i: { nota?: string }) => i.nota ?? '—' },
        ],
        d.indicadoresTecnicos,
      )}
      <p class="nota">Fórmulas conforme EMBRAPA, "Administrando a propriedade leiteira" (2016).</p>
    </div>

    <div class="quebra"></div>
    <h2>Saúde do úbere</h2>
    <div class="secao">
      ${cartoes([
        cartao(
          'Mastite clínica no mês',
          percentual(d.mastite.percentualClinica),
          `meta ≤ ${d.mastite.metaClinica}%`,
        ),
        cartao(
          'Mastite subclínica',
          percentual(d.mastite.percentualSubclinica),
          `${d.mastite.vacasPositivas} de ${d.mastite.vacasTestadas} testadas · meta ≤ ${d.mastite.metaSubclinica}%`,
        ),
        cartao(
          'Último CMT',
          d.mastite.diasDesdeUltimoCMT === null ? 'sem registro' : `há ${d.mastite.diasDesdeUltimoCMT} dia(s)`,
          'recomendado: mensal',
        ),
      ])}
      ${
        d.mastite.percentualClinica > d.mastite.metaClinica
          ? destaque(
              'Mastite clínica acima da meta',
              'O resultado esperado em um rebanho não deve passar de 2% ao mês (Embrapa, Mastite, p. 38).',
              'alerta',
            )
          : ''
      }
      <h3>Vacas com mastite crônica</h3>
      ${tabela(
        [
          { titulo: 'Brinco', valor: (v: { brinco: string }) => v.brinco },
          { titulo: 'Nome', valor: (v: { nome: string | null }) => v.nome ?? '—' },
          { titulo: 'Meses positivos', numero: true, valor: (v: { meses: number }) => String(v.meses) },
        ],
        d.mastite.cronicas,
        'Nenhuma vaca com CMT positivo por três meses ou mais.',
      )}
    </div>

    <h2>Diagnósticos por grupo de doença</h2>
    <div class="secao">
      <p class="nota">
        ${escapar(String(d.diagnosticos.atendimentos))} atendimento(s) concluído(s) no período.
        O sistema diagnostica muito além da mastite — metabólicas, pós-parto, digestivas,
        locomotor, parasitárias, de bezerras e as de notificação obrigatória.
      </p>
      ${
        d.diagnosticos.bandeirasVermelhas.length
          ? destaque('Bandeiras vermelhas no período', d.diagnosticos.bandeirasVermelhas.join(' · '), 'alerta')
          : ''
      }
      ${graficoBarras(d.diagnosticos.porGrupo, { formatar: (v) => `${v}` })}
      <h3>Por condição</h3>
      ${graficoBarras(d.diagnosticos.porDoenca, { formatar: (v) => `${v}`, cor: '#4A6572' })}
    </div>

    <div class="quebra"></div>
    <h2>Tratamentos médicos × produção de leite</h2>
    <div class="secao">
      ${destaque(
        'O que esta análise considera',
        'Apenas o leite que cada vaca produziu e o que foi gasto para tratá-la (remédios e o leite descartado na carência). Terra, alimentação, mão de obra e demais custos da propriedade não entram nesta conta.',
      )}
      ${cartoes([
        cartao('Leite aproveitado', moeda(t.receita), `${numero(t.litros, 0)} L no período`),
        cartao('Gasto com tratamentos', moeda(t.tratamentos)),
        cartao('Leite perdido na carência', moeda(t.descarte)),
        cartao('Resultado da relação', moeda(t.margem), 'receita do leite − tratamentos'),
      ])}
      <h3>Vacas em que o tratamento mais pesou</h3>
      ${tabela(
        [
          { titulo: 'Brinco', valor: (v: (typeof piores)[number]) => v.brinco },
          { titulo: 'Nome', valor: (v: (typeof piores)[number]) => v.nome ?? '—' },
          { titulo: 'Litros', numero: true, valor: (v: (typeof piores)[number]) => numero(v.litros, 0) },
          {
            titulo: 'Tratamentos',
            numero: true,
            valor: (v: (typeof piores)[number]) => moeda(v.custoTratamentos),
          },
          {
            titulo: 'Descarte',
            numero: true,
            valor: (v: (typeof piores)[number]) => moeda(v.perdaPorDescarte),
          },
          { titulo: 'Resultado', numero: true, valor: (v: (typeof piores)[number]) => moeda(v.margem) },
        ],
        piores,
        'Nenhuma vaca em lactação com dados no período.',
      )}
      ${graficoBarras(
        [...t.porVaca]
          .filter((v) => v.custoTratamentos > 0)
          .sort((a, b) => b.custoTratamentos - a.custoTratamentos)
          .slice(0, 12)
          .map((v) => ({ rotulo: v.brinco, valor: v.custoTratamentos })),
        { formatar: moeda, cor: '#B3261E' },
      )}
    </div>

    ${
      d.contextoEconomico
        ? `<h2>Contexto econômico da propriedade — ${escapar(d.periodo.rotuloMes)}</h2>
    <div class="secao">
      <p class="nota">
        Acompanhamento geral nas categorias da Embrapa. Não faz parte da análise de lucro acima.
        ${d.contextoEconomico.mesFechado ? '' : 'Mês ainda em andamento: números parciais.'}
      </p>
      ${cartoes([
        cartao('Margem bruta', moeda(d.contextoEconomico.margemBruta)),
        cartao('Margem líquida', moeda(d.contextoEconomico.margemLiquida)),
        cartao('Custo por litro', moeda(d.contextoEconomico.custoPorLitro)),
        cartao('Total de despesas', moeda(d.contextoEconomico.totalDespesas)),
      ])}
      ${graficoBarras(d.contextoEconomico.despesasPorCategoria, { formatar: moeda })}
    </div>`
        : ''
    }`;

  return documento(
    {
      titulo: 'Relatório de estatísticas da propriedade',
      subtitulo: `Período de ${d.periodo.de} a ${d.periodo.ate}`,
      propriedade: d.propriedade?.nome ?? null,
      geradoEm: d.geradoEm,
    },
    corpo,
  );
}
