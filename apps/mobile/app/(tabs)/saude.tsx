import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { PanoramaDiagnosticos } from '@drmoo/db';
import {
  lancarCMT,
  listarMedicamentos,
  listarRebanho,
  painelMastite,
  panoramaDiagnosticos,
  vacasEmCarencia,
} from '@drmoo/db';
import { ROTULO_GRUPO, hipotesesPorGrupo } from '@drmoo/knowledge';
import { METAS, diasDeCarenciaRestantes, formatarBR, hoje, moeda, percentual, type ResultadoCMT } from '@drmoo/domain';
import { corCMT, siglaCMT } from '@drmoo/ui';
import {
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
  MaterialIcons,
  Separador,
  Tela,
  TituloSecao,
  Txt,
} from '../../src/componentes/base';
import { useDados } from '../../src/hooks';
import { useTema } from '../../src/tema';

const ORDEM_CMT: ResultadoCMT[] = ['N', 'T', '1', '2', '3', 'PP'];

/**
 * O que o rebanho teve, por grupo de doença.
 *
 * A mastite tem painel próprio porque tem dado próprio (CMT, CCS, casos), mas
 * o sistema diagnostica muito mais do que úbere: metabólicas, pós-parto,
 * digestivas, locomotor, parasitárias, bezerras e as de notificação
 * obrigatória. Quando ainda não há atendimento no período, a tela mostra o que
 * a base sabe diagnosticar em vez de uma caixa vazia.
 */
function PainelDiagnosticos({ panorama }: { panorama: PanoramaDiagnosticos }) {
  const { c, espaco } = useTema();
  const porGrupo = hipotesesPorGrupo();

  return (
    <>
      <TituloSecao icone="medical-information">Diagnósticos dos últimos 180 dias</TituloSecao>

      {panorama.diagnosticos.length === 0 ? (
        <Cartao>
          <Txt v="label" cor={c.textoSecundario}>
            Nenhum atendimento concluído no período. O Dr. Moo diagnostica
            {` ${[...porGrupo.values()].reduce((t, l) => t + l.length, 0)} `}
            condições, em {porGrupo.size} grupos — não só mastite:
          </Txt>
          <Espaco h={espaco.sm} />
          {[...porGrupo.entries()].map(([grupo, hipoteses]) => (
            <View key={grupo} style={{ marginBottom: espaco.sm }}>
              <Txt v="corpoForte">{ROTULO_GRUPO[grupo] ?? grupo}</Txt>
              <Txt v="caption" cor={c.textoSecundario}>
                {hipoteses.map((h) => h.rotulo).join(' · ')}
              </Txt>
            </View>
          ))}
          <Separador />
          <Botao
            titulo="Iniciar uma anamnese"
            icone="medical-services"
            variante="secundario"
            aoTocar={() => router.push('/anamnese')}
          />
        </Cartao>
      ) : (
        <>
          <Grade minimo={240}>
            <Kpi rotulo="Atendimentos no período" valor={String(panorama.atendimentos)} />
            <Kpi
              rotulo="Condições diferentes"
              valor={String(panorama.diagnosticos.length)}
              meta={`em ${panorama.porGrupo.length} grupo(s) de doença`}
            />
          </Grade>

          {panorama.bandeirasVermelhas.length > 0 && (
            <>
              <Espaco h={espaco.md} />
              <Alerta
                tipo="alerta"
                icone="flag"
                titulo="Bandeira vermelha no período"
                texto={panorama.bandeirasVermelhas
                  .map((d) => `${d.rotulo} (${d.total})`)
                  .join(' · ')}
              />
            </>
          )}

          <Espaco h={espaco.md} />
          <Linha gap={6} style={{ flexWrap: 'wrap' }}>
            {panorama.porGrupo.map((g) => (
              <Chip key={g.grupo} texto={`${ROTULO_GRUPO[g.grupo] ?? g.grupo}: ${g.total}`} />
            ))}
          </Linha>

          <Espaco h={espaco.md} />
          <Cartao>
            {panorama.diagnosticos.map((d, i) => (
              <View key={d.id}>
                {i > 0 && <Separador />}
                <Linha entre>
                  <View style={{ flex: 1 }}>
                    <Txt v="corpoForte">{d.rotulo}</Txt>
                    <Txt v="caption" cor={c.textoSecundario} numberOfLines={2}>
                      {ROTULO_GRUPO[d.grupo] ?? d.grupo} · último em {formatarBR(d.ultimaEm.slice(0, 10))} ·{' '}
                      {d.ocorrencias
                        .slice(0, 6)
                        .map((o) => o.brinco)
                        .join(', ')}
                    </Txt>
                  </View>
                  <Chip
                    texto={`${d.total}`}
                    cor={d.bandeiraVermelha ? c.alerta : c.primaria}
                    ativo={d.bandeiraVermelha}
                  />
                </Linha>
              </View>
            ))}
          </Cartao>
        </>
      )}
    </>
  );
}

export default function Saude() {
  const { c, espaco } = useTema();
  const agora = new Date();
  const [modoLote, setModoLote] = useState(false);
  const [lancamentos, setLancamentos] = useState<Record<string, ResultadoCMT[]>>({});
  const [salvando, setSalvando] = useState(false);

  const { dados, carregando, recarregar } = useDados(async () => {
    const [mastite, vacas, carencia, medicamentos, diagnosticos] = await Promise.all([
      painelMastite(agora.getFullYear(), agora.getMonth() + 1),
      listarRebanho({ categorias: ['vaca_lactacao'] }),
      vacasEmCarencia(),
      listarMedicamentos(),
      panoramaDiagnosticos(180),
    ]);
    return { mastite, vacas, carencia, medicamentos, diagnosticos };
  }, []);

  if (carregando || !dados) return <Carregando />;
  const { mastite, vacas, carencia, medicamentos, diagnosticos } = dados;

  const ciclar = (animalId: string, indice: number) =>
    setLancamentos((atual) => {
      const linha = atual[animalId] ?? [null as unknown as ResultadoCMT, null, null, null];
      const copia = [...linha] as (ResultadoCMT | null)[];
      const i = copia[indice] === null || copia[indice] === undefined ? -1 : ORDEM_CMT.indexOf(copia[indice]!);
      copia[indice] = ORDEM_CMT[(i + 1) % ORDEM_CMT.length]!;
      return { ...atual, [animalId]: copia as ResultadoCMT[] };
    });

  const salvarLote = async () => {
    setSalvando(true);
    try {
      const hj = hoje();
      for (const [animalId, q] of Object.entries(lancamentos)) {
        await lancarCMT(animalId, hj, {
          ad: q[0] ?? null,
          ae: q[1] ?? null,
          pd: q[2] ?? null,
          pe: q[3] ?? null,
        });
      }
      setLancamentos({});
      setModoLote(false);
      recarregar();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Tela>
      <CabecalhoPagina
        titulo="Saúde do rebanho"
        subtitulo="Diagnósticos de todos os grupos de doenças, mastite e CMT, carência e estoque"
      />

      <PainelDiagnosticos panorama={diagnosticos} />

      <TituloSecao icone="coronavirus">Mastite no rebanho</TituloSecao>
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
          meta={`${mastite.vacasPositivas} de ${mastite.vacasTestadas} testadas · meta ≤ ${METAS.mastiteSubclinica}%`}
          bom={mastite.percentualSubclinica <= METAS.mastiteSubclinica}
        />
      </Grade>

      {mastite.percentualClinica > METAS.mastiteClinica && (
        <>
          <Espaco h={espaco.md} />
          <Alerta
            tipo="alerta"
            titulo="Adote um programa de controle de mastite"
            texto="O resultado esperado em um rebanho não deve ser maior do que 2% ao mês (Embrapa, Mastite, p. 38)."
          />
        </>
      )}

      {mastite.diasDesdeUltimoCMT !== null && (
        <>
          <Espaco h={espaco.md} />
          <Alerta
            tipo={mastite.diasDesdeUltimoCMT > METAS.intervaloCmtDias ? 'atencao' : 'ok'}
            icone="schedule"
            titulo={`Último CMT há ${mastite.diasDesdeUltimoCMT} dia(s)`}
            texto="O teste de CMT deve ser feito pelo menos uma vez por mês em todas as vacas em lactação."
          />
        </>
      )}

      {/* --------------------- Linha de ordenha --------------------- */}
      <TituloSecao icone="format-list-numbered">Linha de ordenha sugerida</TituloSecao>
      <Cartao>
        <Txt v="label" cor={c.textoSecundario}>
          Ordenhe nesta ordem para reduzir a contaminação entre vacas. Lave as mãos
          antes de passar para a próxima vaca.
        </Txt>
        <Espaco h={espaco.sm} />
        {(
          [
            { rotulo: '1º — Vacas sadias', filtro: (v: (typeof vacas)[number]) => !v.ultimo_cmt || v.ultimo_cmt === 'N' || v.ultimo_cmt === 'T', cor: c.ok },
            { rotulo: '2º — CMT positivo (subclínicas)', filtro: (v: (typeof vacas)[number]) => !!v.ultimo_cmt && ['1', '2', '3'].includes(v.ultimo_cmt) && v.status !== 'em_tratamento', cor: c.atencao },
            { rotulo: '3º — Clínicas e em tratamento', filtro: (v: (typeof vacas)[number]) => v.status === 'em_tratamento' || v.status === 'em_carencia' || v.status === 'mastite_cronica', cor: c.alerta },
          ] as const
        ).map((grupo) => {
          const lista = vacas.filter(grupo.filtro);
          return (
            <View key={grupo.rotulo} style={{ marginBottom: espaco.md }}>
              <Linha gap={6}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: grupo.cor }} />
                <Txt v="corpoForte">
                  {grupo.rotulo} ({lista.length})
                </Txt>
              </Linha>
              {lista.length > 0 && (
                <Txt v="caption" cor={c.textoSecundario} numberOfLines={2}>
                  {lista.map((v) => v.brinco).join(', ')}
                </Txt>
              )}
            </View>
          );
        })}
      </Cartao>

      {/* --------------------- Crônicas --------------------- */}
      {mastite.cronicas.length > 0 && (
        <>
          <TituloSecao icone="warning">Vacas com mastite crônica</TituloSecao>
          <Cartao destaque={c.alerta}>
            <Txt v="label" cor={c.textoSecundario}>
              CMT positivo por 3 meses ou mais. A cartilha recomenda avaliar o descarte
              das vacas com mastite persistente.
            </Txt>
            <Separador />
            {mastite.cronicas.map((v) => (
              <Linha key={v.id} entre style={{ minHeight: 40 }}>
                <Txt v="corpoForte">
                  {v.brinco} {v.nome ? `— ${v.nome}` : ''}
                </Txt>
                <Chip texto={`${v.meses} meses positivos`} cor={c.alerta} />
              </Linha>
            ))}
          </Cartao>
        </>
      )}

      {/* --------------------- CMT em lote --------------------- */}
      <TituloSecao icone="science">CMT mensal</TituloSecao>
      {!modoLote ? (
        <Botao
          titulo="Lançar CMT do rebanho"
          icone="add-task"
          grande
          aoTocar={() => setModoLote(true)}
        />
      ) : (
        <Cartao>
          <Txt v="label" cor={c.textoSecundario}>
            Toque em cada quarto para percorrer: N → T → + → ++ → +++ → PP.
            A ordem das colunas é AD · AE · PD · PE.
          </Txt>
          <Espaco h={espaco.md} />
          {vacas.slice(0, 40).map((v) => {
            const linha = lancamentos[v.id] ?? [];
            return (
              <Linha key={v.id} entre style={{ minHeight: 48 }}>
                <Txt v="label" style={{ width: 90 }} numberOfLines={1}>
                  {v.brinco}
                </Txt>
                <Linha gap={6}>
                  {[0, 1, 2, 3].map((i) => {
                    const valor = linha[i] ?? null;
                    return (
                      <Pressable
                        key={i}
                        onPress={() => ciclar(v.id, i)}
                        style={{
                          width: 44,
                          height: 40,
                          borderRadius: 8,
                          borderWidth: 2,
                          borderColor: valor ? corCMT[valor] ?? c.borda : c.borda,
                          backgroundColor: valor ? `${corCMT[valor]}22` : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Txt v="label" cor={valor ? corCMT[valor] : c.textoSecundario}>
                          {valor ? siglaCMT[valor] : '–'}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </Linha>
              </Linha>
            );
          })}
          <Espaco h={espaco.md} />
          <Botao
            grande
            titulo={`Salvar ${Object.keys(lancamentos).length} lançamento(s)`}
            icone="save"
            desabilitado={Object.keys(lancamentos).length === 0 || salvando}
            aoTocar={salvarLote}
          />
          <Espaco h={espaco.sm} />
          <Botao titulo="Cancelar" variante="texto" aoTocar={() => setModoLote(false)} />
        </Cartao>
      )}

      {/* --------------------- Carência --------------------- */}
      <TituloSecao icone="block">Vacas em carência</TituloSecao>
      {carencia.length === 0 ? (
        <Alerta tipo="ok" titulo="Nenhuma vaca em carência" texto="Todo o leite pode ir para o tanque." />
      ) : (
        <View style={{ gap: espaco.sm }}>
          {carencia.map((v) => {
            const dias = v.carencia_leite_ate ? diasDeCarenciaRestantes(v.carencia_leite_ate) : 0;
            return (
              <Cartao key={v.id} destaque={c.alerta} aoTocar={() => router.push(`/animal/${v.id}`)}>
                <Linha entre>
                  <View>
                    <Txt v="corpoForte">
                      {v.brinco} {v.nome ? `— ${v.nome}` : ''}
                    </Txt>
                    <Txt v="caption" cor={c.textoSecundario}>
                      Liberado em {formatarBR(v.carencia_leite_ate)}
                    </Txt>
                  </View>
                  <Chip texto={`faltam ${dias} dia(s)`} cor={c.alerta} ativo />
                </Linha>
              </Cartao>
            );
          })}
        </View>
      )}

      {/* --------------------- Medicamentos --------------------- */}
      <TituloSecao icone="medication">Medicamentos</TituloSecao>
      <Cartao>
        {medicamentos.map((m, i) => (
          <View key={m.id}>
            {i > 0 && <Separador />}
            <Txt v="corpoForte">{m.nome}</Txt>
            <Txt v="caption" cor={c.textoSecundario}>
              {m.principio_ativo} · {m.apresentacao}
            </Txt>
            <Linha gap={6} style={{ marginTop: 6, flexWrap: 'wrap' }}>
              <Chip texto={`${moeda(m.custo_unidade)} / un.`} />
              <Chip
                texto={`carência leite ${m.carencia_leite_dias}d`}
                cor={m.carencia_leite_dias > 0 ? c.alerta : c.ok}
              />
              <Chip texto={`carência carne ${m.carencia_carne_dias}d`} />
              <Chip texto={`estoque ${m.estoque}`} cor={m.estoque <= 3 ? c.atencao : undefined} />
            </Linha>
          </View>
        ))}
      </Cartao>

      <Espaco h={espaco.lg} />
      <Linha gap={6} centro={false}>
        <MaterialIcons name="menu-book" size={16} color={c.textoSecundario} />
        <Txt v="caption" cor={c.textoSecundario} style={{ flex: 1 }}>
          Metas e fórmulas: EMBRAPA, "Como identificar a vaca com mastite em sua
          propriedade", 2015, p. 35, 38 e 39.
        </Txt>
      </Linha>
    </Tela>
  );
}
