import { router } from 'expo-router';
import { View } from 'react-native';
import {
  composicaoRebanho,
  eventosPendentes,
  obterPropriedade,
  painelMastite,
  resumoMensal,
  serieProducaoDiaria,
  vacasEmCarencia,
} from '@drmoo/db';
import { METAS, formatarBR, hoje, moeda, numero, percentual } from '@drmoo/domain';
import {
  Alerta,
  Botao,
  Cartao,
  Carregando,
  Espaco,
  Grade,
  Kpi,
  Linha,
  TituloSecao,
  Tela,
  Txt,
} from '../../src/componentes/base';
import { useLayout } from '../../src/responsivo';
import { GraficoBarras, GraficoLinha } from '../../src/componentes/graficos';
import { useDados } from '../../src/hooks';
import { useTema } from '../../src/tema';
import { ROTULO_DESPESA, type CategoriaDespesa } from '@drmoo/domain';

const NOMES_MES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export default function Inicio() {
  const { c, espaco } = useTema();
  const { amplo } = useLayout();
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;

  // O mês em curso tem produção parcial, mas as despesas podem já estar lançadas
  // pelo mês inteiro — o custo por litro sairia distorcido. Por isso os números
  // financeiros do painel vêm do último mês FECHADO, e isso é dito na tela.
  const anterior = new Date(ano, mes - 2, 1);

  const { dados, carregando } = useDados(async () => {
    const [propriedade, rebanho, mastite, resumo, fechado, serie, carencia, eventos] =
      await Promise.all([
        obterPropriedade(),
        composicaoRebanho(),
        painelMastite(ano, mes),
        resumoMensal(ano, mes),
        resumoMensal(anterior.getFullYear(), anterior.getMonth() + 1),
        serieProducaoDiaria(30),
        vacasEmCarencia(),
        eventosPendentes(6),
      ]);
    return { propriedade, rebanho, mastite, resumo, fechado, serie, carencia, eventos };
  }, [ano, mes]);

  if (carregando || !dados) return <Carregando />;

  const { propriedade, mastite, resumo, fechado, serie, carencia, eventos } = dados;
  const { tecnicos } = resumo;
  const financeiros = fechado.financeiros;
  const hj = hoje();
  const atrasados = eventos.filter((e) => e.data < hj);
  const deHoje = eventos.filter((e) => e.data === hj);

  const topDespesas = fechado.despesasPorCategoria.slice(0, 5).map((d) => ({
    rotulo: ROTULO_DESPESA[d.categoria as CategoriaDespesa] ?? d.categoria,
    valor: d.total,
  }));

  return (
    <Tela>
      <Txt v="h1">{propriedade?.nome ?? 'Minha propriedade'}</Txt>
      <Txt v="label" cor={c.textoSecundario}>
        {formatarBR(hj)} · {tecnicos.rebanhoTotal} animais no rebanho
      </Txt>

      {/* No computador a ação principal já mora no cabeçalho fixo. */}
      {!amplo && (
        <>
          <Espaco h={espaco.lg} />
          <Botao
            grande
            titulo="Nova anamnese"
            icone="medical-services"
            aoTocar={() => router.push('/anamnese')}
          />
        </>
      )}

      {/* ---------------- Alertas ---------------- */}
      <TituloSecao icone="notifications-active">Alertas</TituloSecao>
      <View style={{ gap: espaco.sm }}>
        {carencia.length > 0 && (
          <Alerta
            tipo="alerta"
            icone="block"
            titulo={`${carencia.length} vaca(s) em carência`}
            texto={`O leite de ${carencia.map((v) => v.brinco).join(', ')} não pode ir para o tanque.`}
            aoTocar={() => router.push('/rebanho?carencia=1')}
          />
        )}
        {atrasados.length > 0 && (
          <Alerta
            tipo="atencao"
            icone="event-busy"
            titulo={`${atrasados.length} evento(s) atrasado(s)`}
            texto={atrasados.map((e) => e.titulo).join(' · ')}
            aoTocar={() => router.push('/calendario')}
          />
        )}
        {deHoje.length > 0 && (
          <Alerta
            tipo="info"
            icone="event"
            titulo={`${deHoje.length} tarefa(s) para hoje`}
            texto={deHoje.map((e) => e.titulo).join(' · ')}
            aoTocar={() => router.push('/calendario')}
          />
        )}
        {mastite.percentualClinica > METAS.mastiteClinica && (
          <Alerta
            tipo="alerta"
            icone="coronavirus"
            titulo={`Mastite clínica em ${percentual(mastite.percentualClinica)} no mês`}
            texto={`Acima da meta de ${METAS.mastiteClinica}%. A cartilha recomenda adotar um programa de controle de mastite.`}
            aoTocar={() => router.push('/saude')}
          />
        )}
        {mastite.percentualSubclinica > METAS.mastiteSubclinica && (
          <Alerta
            tipo="atencao"
            icone="science"
            titulo={`Mastite subclínica em ${percentual(mastite.percentualSubclinica)}`}
            texto={`Acima da meta de ${METAS.mastiteSubclinica}% das vacas testadas.`}
            aoTocar={() => router.push('/saude')}
          />
        )}
        {mastite.diasDesdeUltimoCMT !== null && mastite.diasDesdeUltimoCMT > METAS.intervaloCmtDias && (
          <Alerta
            tipo="atencao"
            icone="schedule"
            titulo="CMT do rebanho atrasado"
            texto={`Último teste há ${mastite.diasDesdeUltimoCMT} dias. O CMT deve ser feito pelo menos uma vez por mês.`}
            aoTocar={() => router.push('/saude')}
          />
        )}
        {carencia.length === 0 && atrasados.length === 0 && mastite.percentualClinica <= METAS.mastiteClinica && (
          <Alerta tipo="ok" titulo="Nenhum alerta no momento" texto="Rotinas em dia." />
        )}
      </View>

      {/* ---------------- Produção ---------------- */}
      <TituloSecao icone="water-drop">Produção</TituloSecao>
      <Grade minimo={210}>
        <Kpi
          rotulo="Produção diária"
          valor={numero(tecnicos.producaoDiariaL, 0)}
          unidade="L"
          icone="local-drink"
        />
        <Kpi
          rotulo="Leite por vaca em lactação"
          valor={numero(tecnicos.leitePorVacaLactacaoDia)}
          unidade="L/dia"
          icone="trending-up"
        />
        <Kpi
          rotulo="Vacas em lactação"
          valor={percentual(tecnicos.percVacasEmLactacao, 0)}
          meta={`meta ${METAS.vacasEmLactacao}%`}
          bom={tecnicos.percVacasEmLactacao >= METAS.vacasEmLactacao}
          icone="pets"
        />
        <Kpi
          rotulo="Vacas no leite / secas"
          valor={`${dados.rebanho.vaca_lactacao ?? 0}/${dados.rebanho.vaca_seca ?? 0}`}
          icone="groups"
        />
      </Grade>

      <Espaco h={espaco.md} />
      <Cartao>
        <Txt v="h3">Produção diária — últimos 30 dias</Txt>
        <GraficoLinha valores={serie.map((s) => s.litros)} />
      </Cartao>

      {/* ---------------- Sanidade ---------------- */}
      <TituloSecao icone="health-and-safety">Sanidade</TituloSecao>
      <Grade minimo={210}>
        <Kpi
          rotulo="Mastite clínica no mês"
          valor={percentual(mastite.percentualClinica)}
          meta={`meta ≤ ${METAS.mastiteClinica}%`}
          bom={mastite.percentualClinica <= METAS.mastiteClinica}
          icone="coronavirus"
        />
        <Kpi
          rotulo="Mastite subclínica"
          valor={percentual(mastite.percentualSubclinica)}
          meta={`meta ≤ ${METAS.mastiteSubclinica}%`}
          bom={mastite.percentualSubclinica <= METAS.mastiteSubclinica}
          icone="science"
        />
      </Grade>

      {/* ---------------- Financeiro ---------------- */}
      <TituloSecao icone="payments">{`Contexto econômico — ${NOMES_MES[anterior.getMonth()]}`}</TituloSecao>
      <Txt v="caption" cor={c.textoSecundario} style={{ marginTop: -6, marginBottom: espaco.sm }}>
        Último mês fechado, nas categorias da Embrapa. A análise de lucro do Dr. Moo é outra:
        tratamentos médicos × produção de leite, por vaca, na tela Financeiro.
      </Txt>
      <Grade minimo={210}>
        <Kpi
          rotulo="Margem bruta"
          valor={moeda(financeiros.margemBruta)}
          bom={financeiros.margemBruta > 0}
          icone="account-balance-wallet"
        />
        <Kpi
          rotulo="Custo por litro"
          valor={moeda(financeiros.custoPorLitro)}
          meta={`recebido ${moeda(propriedade?.preco_leite_litro ?? 0)}`}
          bom={financeiros.diferencaPrecoCusto > 0}
          icone="request-quote"
        />
      </Grade>

      {topDespesas.length > 0 && (
        <>
          <Espaco h={espaco.md} />
          <Cartao>
            <Txt v="h3">{`Maiores despesas — ${NOMES_MES[anterior.getMonth()]}`}</Txt>
            <Espaco h={espaco.sm} />
            <GraficoBarras itens={topDespesas} formatar={moeda} />
          </Cartao>
        </>
      )}

      <Espaco h={espaco.lg} />
      <Linha gap={espaco.sm}>
        <Botao
          titulo="Financeiro"
          variante="secundario"
          icone="payments"
          style={{ flex: 1 }}
          aoTocar={() => router.push('/financeiro')}
        />
        <Botao
          titulo="Base de conhecimento"
          variante="secundario"
          icone="account-tree"
          style={{ flex: 1 }}
          aoTocar={() => router.push('/conhecimento')}
        />
      </Linha>
    </Tela>
  );
}
