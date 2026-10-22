/**
 * Estatísticas da propriedade — tudo plotado numa tela só, e o mesmo conteúdo
 * em PDF.
 *
 * É a visão que o produtor leva para fora: produção, rebanho, saúde do úbere,
 * diagnósticos por grupo de doença, a relação tratamentos × leite e o contexto
 * econômico. Na tela, os gráficos são os mesmos componentes do resto do app; no
 * PDF, SVG gerado por `@drmoo/relatorio` a partir dos MESMOS números — nada é
 * recalculado para o papel.
 */
import { useState } from 'react';
import { Platform, View } from 'react-native';
import {
  composicaoRebanho,
  listarRebanho,
  obterPropriedade,
  painelMastite,
  panoramaDiagnosticos,
  panoramaPorVaca,
  resumoMensal,
  serieProducaoDiaria,
} from '@drmoo/db';
import {
  METAS,
  ROTULO_CATEGORIA,
  ROTULO_DESPESA,
  formatarBR,
  moeda,
  numero,
  percentual,
  type CategoriaAnimal,
  type CategoriaDespesa,
} from '@drmoo/domain';
import { ROTULO_GRUPO } from '@drmoo/knowledge';
import { htmlEstatisticas } from '@drmoo/relatorio';
import {
  Acoes,
  Alerta,
  Botao,
  CabecalhoPagina,
  Cartao,
  Carregando,
  Chip,
  Espaco,
  Grade,
  Kpi,
  Linha,
  Separador,
  Tela,
  TituloSecao,
  Txt,
} from '../src/componentes/base';
import { GraficoBarras, GraficoLinha } from '../src/componentes/graficos';
import { entregarPdf } from '../src/arquivos';
import { useDados } from '../src/hooks';
import { useTema } from '../src/tema';

const DIAS_PRODUCAO = 30;
const DIAS_DIAGNOSTICOS = 180;
const DIAS_PANORAMA = 90;

export default function Estatisticas() {
  const { c, espaco } = useTema();
  const [exportando, setExportando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const agora = new Date();
  // Mês anterior: o mês em curso tem produção parcial e distorce o custo.
  const referencia = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const ano = referencia.getFullYear();
  const mes = referencia.getMonth() + 1;

  const { dados, carregando } = useDados(async () => {
    const [propriedade, serie, composicao, mastite, diagnosticos, porVaca, resumo, rebanho] = await Promise.all([
      obterPropriedade(),
      serieProducaoDiaria(DIAS_PRODUCAO),
      composicaoRebanho(),
      painelMastite(ano, mes),
      panoramaDiagnosticos(DIAS_DIAGNOSTICOS),
      panoramaPorVaca(DIAS_PANORAMA),
      resumoMensal(ano, mes),
      listarRebanho(),
    ]);
    return { propriedade, serie, composicao, mastite, diagnosticos, porVaca, resumo, rebanho };
  }, [ano, mes]);

  if (carregando || !dados) return <Carregando />;
  const { propriedade, serie, composicao, mastite, diagnosticos, porVaca, resumo, rebanho } = dados;

  const producao = serie.map((p) => ({ rotulo: formatarBR(p.data).slice(0, 5), valor: p.litros }));
  const totalProduzido = serie.reduce((t, p) => t + p.litros, 0);

  const categorias = Object.entries(composicao)
    .filter(([, total]) => typeof total === 'number' && total > 0)
    .map(([categoria, total]) => ({
      rotulo: ROTULO_CATEGORIA[categoria as CategoriaAnimal] ?? categoria,
      valor: Number(total),
    }));

  const relacao = porVaca.reduce(
    (t, v) => ({
      receita: t.receita + v.receitaEstimada,
      tratamentos: t.tratamentos + v.custoTratamentos,
      descarte: t.descarte + v.perdaPorDescarte,
      margem: t.margem + v.margem,
      litros: t.litros + v.litros,
    }),
    { receita: 0, tratamentos: 0, descarte: 0, margem: 0, litros: 0 },
  );

  const despesas = resumo.despesasPorCategoria.map((d) => ({
    rotulo: ROTULO_DESPESA[d.categoria as CategoriaDespesa] ?? d.categoria,
    valor: d.total,
  }));

  const custoPorVaca = [...porVaca]
    .filter((v) => v.custoTratamentos > 0)
    .sort((a, b) => b.custoTratamentos - a.custoTratamentos)
    .slice(0, 10)
    .map((v) => ({ rotulo: v.brinco, valor: v.custoTratamentos }));

  const indicadores = [
    { rotulo: 'Produção mensal', valor: `${numero(resumo.tecnicos.producaoMensalL, 0)} L` },
    { rotulo: 'Produção diária', valor: `${numero(resumo.tecnicos.producaoDiariaL, 0)} L` },
    { rotulo: 'Rebanho total', valor: String(resumo.tecnicos.rebanhoTotal) },
    { rotulo: 'Total de vacas', valor: String(resumo.tecnicos.totalVacas) },
    {
      rotulo: '% de vacas em lactação',
      valor: percentual(resumo.tecnicos.percVacasEmLactacao),
      nota: 'ideal ~83%',
    },
    {
      rotulo: '% de vacas no rebanho',
      valor: percentual(resumo.tecnicos.percVacasNoRebanho),
      nota: 'referência ~50%',
    },
    {
      rotulo: 'Leite / vaca em lactação / dia',
      valor: `${numero(resumo.tecnicos.leitePorVacaLactacaoDia)} L`,
    },
    { rotulo: 'Leite / mão de obra / dia', valor: `${numero(resumo.tecnicos.leitePorMaoDeObraDia, 0)} L` },
    { rotulo: 'Leite / área / mês', valor: `${numero(resumo.tecnicos.leitePorAreaMes, 0)} L/ha` },
    { rotulo: 'Leite / área / ano', valor: `${numero(resumo.tecnicos.leitePorAreaAno, 0)} L/ha` },
  ];

  const exportar = async () => {
    setExportando(true);
    setAviso(null);
    try {
      const html = htmlEstatisticas({
        propriedade: propriedade
          ? {
              nome: propriedade.nome,
              areaTotalHa: propriedade.area_propria_ha + propriedade.area_arrendada_ha,
              pessoas: propriedade.mao_de_obra_pessoas,
              precoLeiteLitro: propriedade.preco_leite_litro,
            }
          : null,
        periodo: {
          de: serie[0] ? formatarBR(serie[0].data) : '—',
          ate: serie.at(-1) ? formatarBR(serie.at(-1)!.data) : '—',
          rotuloMes: referencia.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        },
        producaoDiaria: producao,
        composicaoRebanho: categorias,
        rebanhoTotal: rebanho.length,
        indicadoresTecnicos: indicadores,
        mastite: {
          percentualClinica: mastite.percentualClinica,
          percentualSubclinica: mastite.percentualSubclinica,
          metaClinica: METAS.mastiteClinica,
          metaSubclinica: METAS.mastiteSubclinica,
          vacasTestadas: mastite.vacasTestadas,
          vacasPositivas: mastite.vacasPositivas,
          diasDesdeUltimoCMT: mastite.diasDesdeUltimoCMT,
          cronicas: mastite.cronicas.map((v) => ({ brinco: v.brinco, nome: v.nome, meses: v.meses })),
        },
        diagnosticos: {
          atendimentos: diagnosticos.atendimentos,
          porGrupo: diagnosticos.porGrupo.map((g) => ({
            rotulo: ROTULO_GRUPO[g.grupo] ?? g.grupo,
            valor: g.total,
          })),
          porDoenca: diagnosticos.diagnosticos.map((d) => ({ rotulo: d.rotulo, valor: d.total })),
          bandeirasVermelhas: diagnosticos.bandeirasVermelhas.map((d) => `${d.rotulo} (${d.total})`),
        },
        tratamentosVsLeite: {
          ...relacao,
          porVaca: porVaca.map((v) => ({
            brinco: v.brinco,
            nome: v.nome,
            litros: v.litros,
            custoTratamentos: v.custoTratamentos,
            perdaPorDescarte: v.perdaPorDescarte,
            margem: v.margem,
          })),
        },
        contextoEconomico: {
          margemBruta: resumo.financeiros.margemBruta,
          margemLiquida: resumo.financeiros.margemLiquida,
          custoPorLitro: resumo.financeiros.custoPorLitro,
          totalDespesas: resumo.financeiros.totalDespesas,
          despesasPorCategoria: despesas,
          mesFechado: resumo.fechado,
        },
        geradoEm: new Date().toISOString(),
      });

      const destino = await entregarPdf({
        html,
        nome: `estatisticas-${propriedade?.nome?.replace(/\s+/g, '-').toLowerCase() ?? 'propriedade'}-${agora
          .toISOString()
          .slice(0, 10)}.pdf`,
        titulo: 'Estatísticas da propriedade — Dr. Moo',
      });

      setAviso(
        destino === 'impressao'
          ? 'Abrimos a janela de impressão: escolha "Salvar como PDF".'
          : destino === 'compartilhado'
            ? 'PDF gerado. Escolha o WhatsApp (ou outro aplicativo) para enviar.'
            : 'PDF gerado e salvo neste aparelho.',
      );
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e));
    } finally {
      setExportando(false);
    }
  };

  return (
    <Tela>
      <CabecalhoPagina
        titulo="Estatísticas da propriedade"
        subtitulo="Todos os gráficos e indicadores num lugar só — e no PDF"
      />

      <Acoes>
        <Botao
          titulo={
            exportando
              ? 'Gerando PDF…'
              : Platform.OS === 'web'
                ? 'Baixar estatísticas em PDF'
                : 'Enviar estatísticas em PDF'
          }
          icone={Platform.OS === 'web' ? 'download' : 'share'}
          grande
          desabilitado={exportando}
          aoTocar={() => void exportar()}
        />
      </Acoes>
      {aviso && (
        <>
          <Espaco h={espaco.sm} />
          <Alerta tipo="info" icone="picture-as-pdf" titulo="Exportação" texto={aviso} />
        </>
      )}

      {/* ---------------- Produção ---------------- */}
      <TituloSecao icone="water-drop">{`Produção dos últimos ${DIAS_PRODUCAO} dias`}</TituloSecao>
      <Cartao>
        <Grade minimo={200}>
          <Kpi rotulo="Total no período" valor={`${numero(totalProduzido, 0)} L`} />
          <Kpi
            rotulo="Média diária"
            valor={`${numero(serie.length ? totalProduzido / serie.length : 0)} L`}
          />
          <Kpi rotulo="Preço recebido" valor={moeda(propriedade?.preco_leite_litro ?? 0)} meta="por litro" />
        </Grade>
        <Espaco h={espaco.sm} />
        <GraficoLinha valores={serie.map((p) => p.litros)} altura={110} />
      </Cartao>

      {/* ---------------- Rebanho ---------------- */}
      <TituloSecao icone="pets">Composição do rebanho</TituloSecao>
      <Cartao>
        <GraficoBarras itens={categorias} formatar={(v) => `${v}`} />
        <Separador />
        <Linha entre>
          <Txt v="corpoForte">Total de animais</Txt>
          <Txt v="corpoForte">{rebanho.length}</Txt>
        </Linha>
      </Cartao>

      {/* ---------------- Saúde do úbere ---------------- */}
      <TituloSecao icone="coronavirus">Saúde do úbere</TituloSecao>
      <Grade minimo={240}>
        <Kpi
          rotulo="Mastite clínica no mês"
          valor={percentual(mastite.percentualClinica)}
          meta={`meta ≤ ${METAS.mastiteClinica}%`}
          bom={mastite.percentualClinica <= METAS.mastiteClinica}
        />
        <Kpi
          rotulo="Mastite subclínica"
          valor={percentual(mastite.percentualSubclinica)}
          meta={`${mastite.vacasPositivas} de ${mastite.vacasTestadas} testadas`}
          bom={mastite.percentualSubclinica <= METAS.mastiteSubclinica}
        />
      </Grade>

      {/* ---------------- Diagnósticos ---------------- */}
      <TituloSecao icone="medical-information">{`Diagnósticos (${DIAS_DIAGNOSTICOS} dias)`}</TituloSecao>
      <Cartao>
        {diagnosticos.diagnosticos.length === 0 ? (
          <Txt v="label" cor={c.textoSecundario}>
            Nenhum atendimento concluído no período.
          </Txt>
        ) : (
          <>
            <Linha gap={6} style={{ flexWrap: 'wrap' }}>
              {diagnosticos.porGrupo.map((g) => (
                <Chip key={g.grupo} texto={`${ROTULO_GRUPO[g.grupo] ?? g.grupo}: ${g.total}`} />
              ))}
            </Linha>
            <Espaco h={espaco.sm} />
            <GraficoBarras
              itens={diagnosticos.diagnosticos.map((d) => ({ rotulo: d.rotulo, valor: d.total }))}
              formatar={(v) => `${v}`}
            />
          </>
        )}
      </Cartao>

      {/* ---------------- Tratamentos × leite ---------------- */}
      <TituloSecao icone="payments">{`Tratamentos × produção (${DIAS_PANORAMA} dias)`}</TituloSecao>
      <Alerta
        tipo="info"
        icone="info"
        titulo="Recorte desta análise"
        texto="Só o leite de cada vaca contra o custo de tratá-la (remédios e leite descartado na carência). Nenhum outro custo da propriedade entra."
      />
      <Espaco h={espaco.sm} />
      <Grade minimo={200}>
        <Kpi rotulo="Leite aproveitado" valor={moeda(relacao.receita)} />
        <Kpi rotulo="Tratamentos" valor={moeda(relacao.tratamentos)} />
        <Kpi rotulo="Perdido na carência" valor={moeda(relacao.descarte)} />
        <Kpi rotulo="Resultado" valor={moeda(relacao.margem)} bom={relacao.margem > 0} />
      </Grade>
      {custoPorVaca.length > 0 && (
        <>
          <Espaco h={espaco.sm} />
          <Cartao>
            <Txt v="corpoForte">Gasto com tratamentos por vaca</Txt>
            <Espaco h={6} />
            <GraficoBarras itens={custoPorVaca} formatar={moeda} />
          </Cartao>
        </>
      )}

      {/* ---------------- Indicadores ---------------- */}
      <TituloSecao icone="insights">Indicadores técnicos</TituloSecao>
      <Cartao>
        {indicadores.map((i, indice) => (
          <View key={i.rotulo}>
            {indice > 0 && <Separador />}
            <Linha entre style={{ minHeight: 34 }}>
              <View style={{ flex: 1 }}>
                <Txt v="label">{i.rotulo}</Txt>
                {i.nota && (
                  <Txt v="caption" cor={c.textoSecundario}>
                    {i.nota}
                  </Txt>
                )}
              </View>
              <Txt v="corpoForte">{i.valor}</Txt>
            </Linha>
          </View>
        ))}
      </Cartao>

      {/* ---------------- Contexto econômico ---------------- */}
      <TituloSecao icone="calculate">Contexto econômico (mês fechado)</TituloSecao>
      <Cartao>
        <Grade minimo={200}>
          <Kpi rotulo="Margem bruta" valor={moeda(resumo.financeiros.margemBruta)} />
          <Kpi rotulo="Margem líquida" valor={moeda(resumo.financeiros.margemLiquida)} />
          <Kpi rotulo="Custo por litro" valor={moeda(resumo.financeiros.custoPorLitro)} />
        </Grade>
        {despesas.length > 0 && (
          <>
            <Separador />
            <GraficoBarras itens={despesas} formatar={moeda} />
          </>
        )}
      </Cartao>
    </Tela>
  );
}
