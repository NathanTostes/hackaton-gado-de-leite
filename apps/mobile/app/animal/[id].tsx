import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import {
  ROTULO_STATUS,
  ROTULO_ORIGEM,
  ROTULO_REPRODUCAO,
  atendimentosDoAnimal,
  controleLeiteiroDoAnimal,
  historicoCMT,
  obterAnimal,
  tratamentosDoAnimal,
} from '@drmoo/db';
import {
  ROTULO_CATEGORIA,
  diasDeCarenciaRestantes,
  formatarBR,
  moeda,
  numero,
} from '@drmoo/domain';
import { corCMT, siglaCMT } from '@drmoo/ui';
import {
  Alerta,
  Botao,
  Cartao,
  Carregando,
  Chip,
  Espaco,
  Linha,
  Separador,
  Tela,
  TituloSecao,
  Txt,
  Vazio,
} from '../../src/componentes/base';
import { GraficoLinha, UbereQuatroQuartos } from '../../src/componentes/graficos';
import { useDados } from '../../src/hooks';
import { useTema } from '../../src/tema';

export default function FichaDoAnimal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, espaco } = useTema();

  const { dados, carregando } = useDados(async () => {
    if (!id) return null;
    const [animal, controle, cmt, atendimentos, tratamentos] = await Promise.all([
      obterAnimal(id),
      controleLeiteiroDoAnimal(id),
      historicoCMT(id),
      atendimentosDoAnimal(id),
      tratamentosDoAnimal(id),
    ]);
    return { animal, controle, cmt, atendimentos, tratamentos };
  }, [id]);

  if (carregando || !dados) return <Carregando />;
  if (!dados.animal) return <Vazio icone="error-outline" titulo="Animal não encontrado" />;

  const { animal, controle, cmt, atendimentos, tratamentos } = dados;
  const ultimoCmt = cmt[0];
  const curva = [...controle].reverse().map((p) => p.litros_total);

  return (
    <Tela>
      <Linha gap={espaco.md}>
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: c.superficieAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt v="h3" cor={c.primaria}>
            {animal.brinco}
          </Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="h1">{animal.nome ?? `Brinco ${animal.brinco}`}</Txt>
          <Txt v="label" cor={c.textoSecundario}>
            {ROTULO_CATEGORIA[animal.categoria]} · {animal.raca ?? 'raça não informada'}
          </Txt>
          <Linha gap={6} style={{ marginTop: 6, flexWrap: 'wrap' }}>
            <Chip
              texto={ROTULO_STATUS[animal.status]}
              cor={animal.status === 'saudavel' ? c.ok : c.alerta}
              ativo={animal.status !== 'saudavel'}
            />
            {animal.lote_nome && <Chip texto={animal.lote_nome} />}
            {animal.tem_peito_perdido && <Chip texto="Peito perdido" cor={c.textoSecundario} />}
          </Linha>
        </View>
      </Linha>

      {animal.carencia_leite_ate && (
        <>
          <Espaco h={espaco.md} />
          <Alerta
            tipo="alerta"
            icone="block"
            titulo="Leite em carência"
            texto={`Não envie o leite desta vaca para o tanque. Liberado em ${formatarBR(
              animal.carencia_leite_ate,
            )} (faltam ${diasDeCarenciaRestantes(animal.carencia_leite_ate)} dia(s)).`}
          />
        </>
      )}

      <Espaco h={espaco.lg} />
      <Botao
        grande
        titulo="Fazer anamnese neste animal"
        icone="medical-services"
        aoTocar={() => router.push(`/anamnese/${animal.id}`)}
      />

      <Espaco h={espaco.sm} />
      <Botao titulo="Editar cadastro" icone="edit" variante="secundario" aoTocar={() => router.push(`/editar-animal/${animal.id}`)} />

      {/* ------------------ Identificação ------------------ */}
      <TituloSecao icone="badge">Identificação</TituloSecao>
      <Cartao>
        <Campo rotulo="Brinco" valor={animal.brinco} />
        <Campo rotulo="Sexo" valor={animal.sexo === 'F' ? 'Fêmea' : 'Macho'} />
        <Campo rotulo="Raça ou cruzamento" valor={animal.raca ?? '—'} />
        <Campo rotulo="Tatuagem" valor={animal.tatuagem ?? '—'} />
        <Campo rotulo="Nascimento" valor={formatarBR(animal.data_nascimento)} />
        {!animal.data_nascimento && animal.idade_estimada_meses != null && <Campo rotulo="Idade estimada no cadastro" valor={`${animal.idade_estimada_meses} mês(es) em ${formatarBR(animal.idade_estimada_em)}`} />}
        <Campo rotulo="Peso ao nascer" valor={animal.peso_nascimento ? `${animal.peso_nascimento} kg` : '—'} />
        <Campo rotulo="Pelagem e sinal" valor={animal.pelagem_sinal ?? '—'} />
        <Campo rotulo="Mãe" valor={animal.mae_identificacao ?? '—'} />
        <Campo rotulo="Pai" valor={animal.pai_identificacao ?? '—'} />
      </Cartao>
      <TituloSecao icone="move-to-inbox">Entrada na propriedade</TituloSecao>
      <Cartao>
        <Campo rotulo="Origem" valor={ROTULO_ORIGEM[animal.origem]} />
        <Campo rotulo="Entrada no rebanho" valor={formatarBR(animal.data_entrada)} />
        <Campo rotulo="Peso na entrada" valor={animal.peso_entrada != null ? `${numero(animal.peso_entrada)} kg` : '—'} />
        <Campo rotulo="Propriedade de origem / vendedor" valor={animal.procedencia ?? '—'} />
        <Campo rotulo="Valor de aquisição" valor={animal.valor_aquisicao != null ? moeda(animal.valor_aquisicao) : '—'} />
        <Campo rotulo="Número da GTA" valor={animal.numero_gta ?? '—'} />
      </Cartao>

      {animal.sexo === 'F' && ['vaca_lactacao', 'vaca_seca', 'novilha'].includes(animal.categoria) && <>
        <TituloSecao icone="child-care">Reprodução</TituloSecao>
        <Cartao>
          <Campo rotulo="Situação reprodutiva informada na entrada" valor={ROTULO_REPRODUCAO[animal.situacao_reprodutiva as keyof typeof ROTULO_REPRODUCAO] ?? 'Não informada'} />
          <Campo rotulo="Último parto" valor={formatarBR(animal.data_parto)} />
          <Campo rotulo="Número de lactações" valor={animal.numero_lactacao != null ? String(animal.numero_lactacao) : '—'} />
          <Campo rotulo="Próximo parto previsto (cobertura registrada)" valor={formatarBR(animal.data_provavel_parto)} />
        </Cartao>
      </>}
      {animal.observacoes && <>
        <TituloSecao icone="description">Observações cadastrais</TituloSecao>
        <Cartao><Txt>{animal.observacoes}</Txt></Cartao>
      </>}

      {/* ------------------ Produção ------------------ */}
      {animal.categoria === 'vaca_lactacao' && (
        <>
          <TituloSecao icone="water-drop">Produção</TituloSecao>
          <Cartao>
            <Linha entre>
              <Campo rotulo="Lactação" valor={`${animal.numero_lactacao ?? '—'}ª`} />
              <Campo rotulo="Parto" valor={formatarBR(animal.data_parto)} />
              <Campo rotulo="DEL" valor={animal.del !== null ? `${animal.del} dias` : '—'} />
            </Linha>
            <Separador />
            <Txt v="corpoForte">
              Média {animal.producao_media_dia ? `${numero(animal.producao_media_dia)} L/dia` : '—'}
            </Txt>
            <GraficoLinha valores={curva} />
            <Txt v="caption" cor={c.textoSecundario}>
              Controle leiteiro mensal — manhã + tarde, conforme a ficha da Embrapa.
            </Txt>
          </Cartao>
        </>
      )}

      {/* ------------------ Saúde ------------------ */}
      <TituloSecao icone="health-and-safety">Saúde</TituloSecao>

      {animal.historico_sanitario && <Cartao>
        <Txt v="h3">Histórico sanitário informado na entrada</Txt>
        <Txt>{animal.historico_sanitario}</Txt>
      </Cartao>}
      {ultimoCmt ? (
        <Cartao>
          <Txt v="h3">Último CMT — {formatarBR(ultimoCmt.data)}</Txt>
          <Espaco h={espaco.sm} />
          <UbereQuatroQuartos
            valores={{ ad: ultimoCmt.ad, ae: ultimoCmt.ae, pd: ultimoCmt.pd, pe: ultimoCmt.pe }}
            tamanho={100}
          />
          {cmt.length > 1 && (
            <>
              <Separador />
              <Txt v="corpoForte">Histórico</Txt>
              <Espaco h={6} />
              {cmt.map((e) => (
                <Linha key={e.id} entre style={{ minHeight: 32 }}>
                  <Txt v="label" cor={c.textoSecundario}>
                    {formatarBR(e.data)}
                  </Txt>
                  <Linha gap={6}>
                    {([e.ad, e.ae, e.pd, e.pe] as const).map((q, i) => (
                      <View
                        key={i}
                        style={{
                          width: 34,
                          height: 26,
                          borderRadius: 6,
                          borderWidth: 1.5,
                          borderColor: q ? corCMT[q] ?? c.borda : c.borda,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Txt v="caption" cor={q ? corCMT[q] : c.textoSecundario}>
                          {q ? siglaCMT[q] : '–'}
                        </Txt>
                      </View>
                    ))}
                  </Linha>
                </Linha>
              ))}
              {animal.cmt_positivo_meses >= 3 && (
                <>
                  <Espaco h={espaco.sm} />
                  <Alerta
                    tipo="alerta"
                    titulo={`CMT positivo em ${animal.cmt_positivo_meses} meses`}
                    texto="Vaca com CMT positivo por três meses ou mais numa lactação é considerada com mastite crônica. A cartilha recomenda avaliar o descarte."
                  />
                </>
              )}
            </>
          )}
        </Cartao>
      ) : (
        <Cartao>
          <Txt v="label" cor={c.textoSecundario}>
            Nenhum teste de CMT registrado. O CMT deve ser feito pelo menos uma vez por mês.
          </Txt>
        </Cartao>
      )}

      {tratamentos.length > 0 && (
        <>
          <Espaco h={espaco.md} />
          <Cartao>
            <Txt v="h3">Tratamentos</Txt>
            <Espaco h={6} />
            {tratamentos.map((t, i) => (
              <View key={t.id}>
                {i > 0 && <Separador />}
                <Linha entre>
                  <Txt v="corpoForte">{formatarBR(t.data_inicio)}</Txt>
                  <Txt v="label" cor={c.textoSecundario}>
                    {moeda(t.custo_total)}
                  </Txt>
                </Linha>
                <Txt v="caption" cor={c.textoSecundario}>
                  {t.dose} · {t.via}
                </Txt>
                {t.carencia_leite_ate && (
                  <Txt v="caption" cor={c.alerta}>
                    Carência do leite até {formatarBR(t.carencia_leite_ate)}
                  </Txt>
                )}
              </View>
            ))}
          </Cartao>
        </>
      )}

      {/* ------------------ Prontuários ------------------ */}
      <TituloSecao icone="description">Prontuários</TituloSecao>
      {atendimentos.length === 0 ? (
        <Vazio
          icone="note-add"
          titulo="Nenhuma anamnese registrada"
          texto="Toque em “Fazer anamnese neste animal” para começar."
        />
      ) : (
        <View style={{ gap: espaco.sm }}>
          {atendimentos.map((a) => {
            const conclusoes = JSON.parse(a.conclusoes) as { rotulo: string; confianca: string }[];
            const principal = conclusoes[0];
            return (
              <Cartao key={a.id} aoTocar={() => router.push(`/prontuario/${a.id}`)}>
                <Linha entre>
                  <View style={{ flex: 1 }}>
                    <Txt v="corpoForte">{principal?.rotulo ?? 'Sem alteração detectada'}</Txt>
                    <Txt v="caption" cor={c.textoSecundario}>
                      {formatarBR(a.data_hora.slice(0, 10))}
                      {principal ? ` · ${principal.confianca}` : ''} · base v{a.kb_versao}
                    </Txt>
                  </View>
                  <Chip texto="Ver traço" icone="account-tree" />
                </Linha>
              </Cartao>
            );
          })}
        </View>
      )}
    </Tela>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  const { c } = useTema();
  return (
    <View style={{ marginBottom: 8 }}>
      <Txt v="caption" cor={c.textoSecundario}>
        {rotulo}
      </Txt>
      <Txt v="corpoForte">{valor}</Txt>
    </View>
  );
}
