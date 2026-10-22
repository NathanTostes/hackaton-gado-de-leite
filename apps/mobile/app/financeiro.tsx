import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { lancamentosDoMes, panoramaPorVaca, resumoMensal } from '@drmoo/db';
import {
  ROTULO_DESPESA,
  ROTULO_RECEITA,
  formatarBR,
  moeda,
  numero,
  percentual,
  type CategoriaDespesa,
  type CategoriaReceita,
} from '@drmoo/domain';
import {
  Alerta,
  CabecalhoPagina,
  Cartao,
  Carregando,
  Chip,
  Espaco,
  Kpi,
  Linha,
  MaterialIcons,
  Separador,
  Tela,
  TituloSecao,
  Txt,
  estilos,
} from '../src/componentes/base';
import { GraficoBarras } from '../src/componentes/graficos';
import { useDados } from '../src/hooks';
import { useTema } from '../src/tema';

const NOMES_MES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export default function Financeiro() {
  const { c, espaco } = useTema();
  const agora = new Date();
  // Abre no último mês FECHADO: num mês em andamento a produção é parcial mas as
  // despesas já podem ser do mês inteiro, e o custo por litro sai distorcido.
  const [deslocamento, setDeslocamento] = useState(1);

  const referencia = new Date(agora.getFullYear(), agora.getMonth() - deslocamento, 1);
  const ano = referencia.getFullYear();
  const mes = referencia.getMonth() + 1;

  const { dados, carregando } = useDados(async () => {
    const [resumo, lancamentos, panorama] = await Promise.all([
      resumoMensal(ano, mes),
      lancamentosDoMes(ano, mes),
      panoramaPorVaca(90),
    ]);
    return { resumo, lancamentos, panorama };
  }, [ano, mes]);

  if (carregando || !dados) return <Carregando />;
  const { resumo, lancamentos, panorama } = dados;
  const { tecnicos, financeiros } = resumo;

  const despesas = resumo.despesasPorCategoria.map((d) => ({
    rotulo: ROTULO_DESPESA[d.categoria as CategoriaDespesa] ?? d.categoria,
    valor: d.total,
  }));

  const melhores = panorama.slice(0, 3);
  const piores = [...panorama].reverse().slice(0, 3);
  // Só vale desenhar barra de quem gastou alguma coisa; as dez maiores contam a história.
  const custoPorVaca = [...panorama]
    .filter((v) => v.custoTratamentos > 0)
    .sort((a, b) => b.custoTratamentos - a.custoTratamentos)
    .slice(0, 10)
    .map((v) => ({ rotulo: v.brinco, valor: v.custoTratamentos }));

  // Totais do recorte: a soma do que as vacas produziram contra o que custou
  // tratá-las. É esta a conta que a tela se propõe a fazer.
  const totalRelacao = panorama.reduce(
    (t, v) => ({
      receita: t.receita + v.receitaEstimada,
      tratamentos: t.tratamentos + v.custoTratamentos,
      descarte: t.descarte + v.perdaPorDescarte,
      margem: t.margem + v.margem,
      litros: t.litros + v.litros,
    }),
    { receita: 0, tratamentos: 0, descarte: 0, margem: 0, litros: 0 },
  );
  const comPrejuizo = panorama.filter((v) => v.margem < 0);

  return (
    <Tela>
      <CabecalhoPagina
        titulo="Tratamentos × produção de leite"
        subtitulo="O lucro mostrado aqui é só desta relação — não é o resultado contábil da fazenda"
      />
      <Alerta
        tipo="info"
        icone="info"
        titulo="O que esta análise considera"
        texto="Apenas duas coisas: o leite que cada vaca produziu e o que foi gasto para tratá-la (remédios aplicados e o leite jogado fora durante a carência). Terra, alimentação, mão de obra, financiamento e demais custos da propriedade NÃO entram nesta conta — eles aparecem mais abaixo, separados, apenas como contexto."
      />
      <Espaco h={espaco.md} />

      {/* ---------- A relação: tratamentos médicos × produção de leite ---------- */}
      <TituloSecao icone="pets">Lucro por vaca nos últimos 90 dias</TituloSecao>
      <View style={estilos.grade}>
        <Kpi
          rotulo="Leite aproveitado (receita)"
          valor={moeda(totalRelacao.receita)}
          meta={`${numero(totalRelacao.litros, 0)} L produzidos no período`}
        />
        <Kpi
          rotulo="Gasto com tratamentos"
          valor={moeda(totalRelacao.tratamentos)}
          meta="remédios aplicados nas vacas"
        />
        <Kpi
          rotulo="Leite perdido na carência"
          valor={moeda(totalRelacao.descarte)}
          meta="leite que não pôde ir ao tanque"
        />
        <Kpi
          rotulo="Resultado da relação"
          valor={moeda(totalRelacao.margem)}
          bom={totalRelacao.margem > 0}
          meta="receita do leite − tratamentos"
        />
      </View>

      {comPrejuizo.length > 0 && (
        <>
          <Espaco h={espaco.md} />
          <Alerta
            tipo="atencao"
            icone="trending-down"
            titulo={`${comPrejuizo.length} vaca(s) com resultado negativo`}
            texto="Nestas vacas, o tratamento custou mais do que o leite aproveitado rendeu no período. É aqui que a anamnese precoce se paga."
          />
        </>
      )}

      <Espaco h={espaco.md} />
      <Cartao>
        <Txt v="label" cor={c.textoSecundario}>
          Para cada vaca: (leite aproveitado × preço recebido) − (custo dos remédios).
          O leite descartado durante a carência sai da receita, porque não foi vendido.
          Nenhum outro custo da propriedade entra nesta conta.
        </Txt>

        <Separador />
        <Txt v="corpoForte" cor={c.alerta}>
          Vacas em que o tratamento mais pesou
        </Txt>
        <Espaco h={6} />
        {piores.map((v) => (
          <LinhaVaca key={v.animalId} vaca={v} />
        ))}

        <Separador />
        <Txt v="corpoForte" cor={c.ok}>
          Vacas com melhor relação
        </Txt>
        <Espaco h={6} />
        {melhores.map((v) => (
          <LinhaVaca key={v.animalId} vaca={v} />
        ))}

        {custoPorVaca.length > 0 && (
          <>
            <Separador />
            <Txt v="corpoForte">Gasto com tratamentos por vaca</Txt>
            <Espaco h={6} />
            <GraficoBarras itens={custoPorVaca} formatar={moeda} />
          </>
        )}
      </Cartao>

      {/* ---------- Contexto: fora da relação acima ---------- */}
      <TituloSecao icone="account-balance">Contexto da propriedade</TituloSecao>
      <Alerta
        tipo="atencao"
        icone="fact-check"
        titulo="Daqui para baixo não faz parte da análise de lucro"
        texto="Os números a seguir são o acompanhamento econômico geral da propriedade, nas categorias da Embrapa. Eles existem para dar contexto — o lucro de que esta tela trata é apenas a relação tratamentos × produção de leite, mostrada acima."
      />
      <Espaco h={espaco.md} />

      <Linha gap={espaco.sm}>
        {[0, 1, 2].map((d) => {
          const r = new Date(agora.getFullYear(), agora.getMonth() - d, 1);
          return (
            <Chip
              key={d}
              texto={d === 0 ? `${NOMES_MES[r.getMonth()]} (em curso)` : `${NOMES_MES[r.getMonth()]}`}
              ativo={deslocamento === d}
              aoTocar={() => setDeslocamento(d)}
            />
          );
        })}
      </Linha>

      {!resumo.fechado && (
        <>
          <Espaco h={espaco.md} />
          <Alerta
            tipo="atencao"
            icone="hourglass-top"
            titulo="Mês em andamento — números parciais"
            texto={`Há produção lançada em ${resumo.diasComProducao} dia(s) deste mês, mas as despesas podem já estar lançadas pelo mês inteiro. O custo por litro só fica comparável com a meta quando o mês fecha.`}
          />
        </>
      )}

      {/* -------------------- Resultado -------------------- */}
      <TituloSecao icone="calculate">
        {`Resultado contábil de ${NOMES_MES[referencia.getMonth()]} (propriedade inteira)`}
      </TituloSecao>
      <View style={estilos.grade}>
        <Kpi
          rotulo="Margem bruta (vendas − despesas)"
          valor={moeda(financeiros.margemBruta)}
          bom={financeiros.margemBruta > 0}
        />
        <Kpi
          rotulo="Margem líquida"
          valor={moeda(financeiros.margemLiquida)}
          bom={financeiros.margemLiquida > 0}
          meta="já descontando mão de obra familiar e reposição"
        />
        <Kpi rotulo="Custo por litro" valor={moeda(financeiros.custoPorLitro)} />
        <Kpi
          rotulo="Diferença preço − custo"
          valor={moeda(financeiros.diferencaPrecoCusto)}
          bom={financeiros.diferencaPrecoCusto > 0}
          meta="lucro bruto por litro vendido"
        />
        <Kpi
          rotulo="Custo operacional total"
          valor={moeda(financeiros.custoOperacionalTotal)}
        />
        <Kpi
          rotulo="COT por litro"
          valor={moeda(financeiros.custoOperacionalTotalPorLitro)}
        />
      </View>

      {/* -------------------- Despesas -------------------- */}
      <TituloSecao icone="trending-down">Despesas por categoria</TituloSecao>
      <Cartao>
        {despesas.length === 0 ? (
          <Txt v="label" cor={c.textoSecundario}>
            Nenhuma despesa lançada neste mês.
          </Txt>
        ) : (
          <>
            <GraficoBarras itens={despesas} formatar={moeda} />
            <Separador />
            <Linha entre>
              <Txt v="corpoForte">Total de despesas</Txt>
              <Txt v="corpoForte">{moeda(financeiros.totalDespesas)}</Txt>
            </Linha>
          </>
        )}
        <Espaco h={espaco.sm} />
        <Txt v="caption" cor={c.textoSecundario}>
          Categorias conforme a planilha de indicadores econômico-financeiros da Embrapa.
          Os concentrados geralmente são o maior custo da produção de leite.
        </Txt>
      </Cartao>

      {/* -------------------- Receitas -------------------- */}
      <TituloSecao icone="trending-up">Receitas</TituloSecao>
      <Cartao>
        {lancamentos.receitas.length === 0 ? (
          <Txt v="label" cor={c.textoSecundario}>
            Nenhuma receita lançada neste mês.
          </Txt>
        ) : (
          lancamentos.receitas.map((r, i) => (
            <View key={r.id}>
              {i > 0 && <Separador />}
              <Linha entre>
                <View style={{ flex: 1 }}>
                  <Txt v="corpoForte">
                    {ROTULO_RECEITA[r.categoria as CategoriaReceita] ?? r.categoria}
                  </Txt>
                  <Txt v="caption" cor={c.textoSecundario}>
                    {formatarBR(r.data)} · {r.descricao}
                  </Txt>
                </View>
                <Txt v="corpoForte" cor={c.ok}>
                  {moeda(r.valor)}
                </Txt>
              </Linha>
            </View>
          ))
        )}
      </Cartao>

      {/* -------------------- Indicadores técnicos -------------------- */}
      <TituloSecao icone="insights">Indicadores técnicos</TituloSecao>
      <Cartao>
        <LinhaIndicador rotulo="Produção mensal" valor={`${numero(tecnicos.producaoMensalL, 0)} L`} />
        <LinhaIndicador rotulo="Produção diária" valor={`${numero(tecnicos.producaoDiariaL, 0)} L`} />
        <LinhaIndicador rotulo="Rebanho total" valor={String(tecnicos.rebanhoTotal)} />
        <LinhaIndicador rotulo="Total de vacas" valor={String(tecnicos.totalVacas)} />
        <LinhaIndicador
          rotulo="% de vacas em lactação"
          valor={percentual(tecnicos.percVacasEmLactacao)}
          nota="ideal ~83%"
        />
        <LinhaIndicador
          rotulo="% de vacas no rebanho"
          valor={percentual(tecnicos.percVacasNoRebanho)}
          nota="referência ~50%"
        />
        <LinhaIndicador
          rotulo="Leite / vaca em lactação / dia"
          valor={`${numero(tecnicos.leitePorVacaLactacaoDia)} L`}
        />
        <LinhaIndicador
          rotulo="Leite / mão de obra / dia"
          valor={`${numero(tecnicos.leitePorMaoDeObraDia, 0)} L`}
        />
        <LinhaIndicador rotulo="Leite / área / mês" valor={`${numero(tecnicos.leitePorAreaMes, 0)} L/ha`} />
        <LinhaIndicador rotulo="Leite / área / ano" valor={`${numero(tecnicos.leitePorAreaAno, 0)} L/ha`} />
      </Cartao>

      <Espaco h={espaco.lg} />
      <Linha gap={6} centro={false}>
        <MaterialIcons name="menu-book" size={16} color={c.textoSecundario} />
        <Txt v="caption" cor={c.textoSecundario} style={{ flex: 1 }}>
          Fórmulas e indicadores conforme EMBRAPA, "Administrando a propriedade leiteira"
          (2016), p. 29-48. A suíte de testes do projeto reproduz os valores publicados no
          exemplo da propriedade do Sr. João.
        </Txt>
      </Linha>
    </Tela>
  );
}

function LinhaIndicador({
  rotulo,
  valor,
  nota,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
}) {
  const { c } = useTema();
  return (
    <Linha entre style={{ minHeight: 36 }}>
      <View style={{ flex: 1 }}>
        <Txt v="label">{rotulo}</Txt>
        {nota && (
          <Txt v="caption" cor={c.textoSecundario}>
            {nota}
          </Txt>
        )}
      </View>
      <Txt v="corpoForte">{valor}</Txt>
    </Linha>
  );
}

function LinhaVaca({
  vaca,
}: {
  vaca: { animalId: string; brinco: string; nome: string | null; litros: number; margem: number; custoTratamentos: number; perdaPorDescarte: number };
}) {
  const { c } = useTema();
  return (
    <Pressable onPress={() => router.push(`/animal/${vaca.animalId}`)}>
      <Linha entre style={{ minHeight: 42 }}>
        <View style={{ flex: 1 }}>
          <Txt v="label">
            {vaca.brinco} {vaca.nome ? `— ${vaca.nome}` : ''}
          </Txt>
          <Txt v="caption" cor={c.textoSecundario}>
            {numero(vaca.litros, 0)} L · remédios {moeda(vaca.custoTratamentos)}
            {vaca.perdaPorDescarte > 0 ? ` · descarte ${moeda(vaca.perdaPorDescarte)}` : ''}
          </Txt>
        </View>
        <Txt v="corpoForte" cor={vaca.margem >= 0 ? c.ok : c.alerta}>
          {moeda(vaca.margem)}
        </Txt>
      </Linha>
    </Pressable>
  );
}
