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

  return (
    <Tela>
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
      <TituloSecao icone="account-balance">
        {`Resultado de ${NOMES_MES[referencia.getMonth()]}`}
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

      {/* -------------------- Panorama por vaca -------------------- */}
      <TituloSecao icone="pets">Panorama por vaca (90 dias)</TituloSecao>
      <Cartao>
        <Txt v="label" cor={c.textoSecundario}>
          Receita estimada do leite aproveitado, menos o custo dos tratamentos e o leite
          descartado por carência. É o que liga a saúde da vaca ao bolso.
        </Txt>

        <Separador />
        <Txt v="corpoForte" cor={c.ok}>
          Melhores margens
        </Txt>
        <Espaco h={6} />
        {melhores.map((v) => (
          <LinhaVaca key={v.animalId} vaca={v} />
        ))}

        <Separador />
        <Txt v="corpoForte" cor={c.alerta}>
          Vacas que mais custam
        </Txt>
        <Espaco h={6} />
        {piores.map((v) => (
          <LinhaVaca key={v.animalId} vaca={v} />
        ))}
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
