import { AgendaProntuario } from '../../src/componentes/agendaProntuario';
import { compromissosDaAgenda, type AjustesAgenda } from '../../src/agendaConsulta';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  CF_RESPOSTA,
  Sessao,
  type Fato,
  type Parecer,
  type Pergunta,
  type ProximoPasso,
  type Valor,
} from '@drmoo/engine';
import { baseCompilada } from '@drmoo/knowledge';
import {
  diagnosticarRebanho,
  fatosDoAnimal,
  obterAnimal,
  type AnimalComResumo,
  type FatoPreCarregado,
} from '@drmoo/db';
import { ROTULO_CATEGORIA, hoje, piorCMT, type ResultadoCMT } from '@drmoo/domain';
import { corCMT, corDaConfianca } from '@drmoo/ui';
import {
  Alerta,
  AvisoVeterinario,
  Barra,
  Botao,
  Cartao,
  Carregando,
  Chip,
  Espaco,
  Linha,
  MaterialIcons,
  Separador,
  Tela,
  TituloSecao,
  Txt,
} from '../../src/componentes/base';
import { UbereQuatroQuartos } from '../../src/componentes/graficos';
import { CartaoHipotese, ComoChegueiNisso } from '../../src/componentes/parecer';
import { salvarConsulta } from '../../src/salvarConsulta';
import { useTema } from '../../src/tema';
import { useLayout } from '../../src/responsivo';

export default function Anamnese() {
  const { animalId } = useLocalSearchParams<{ animalId: string }>();
  const { c, espaco } = useTema();
  const { amplo } = useLayout();

  const sessaoRef = useRef<Sessao | null>(null);
  const [animal, setAnimal] = useState<AnimalComResumo | null>(null);
  const [preCarregados, setPreCarregados] = useState<FatoPreCarregado[]>([]);
  const [passo, setPasso] = useState<ProximoPasso | null>(null);
  const [mostrarPorque, setMostrarPorque] = useState(false);
  const [mostrarSabidos, setMostrarSabidos] = useState(true);
  const [condutaMarcada, setCondutaMarcada] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<string | null>(null);
  const [dataAtendimento, setDataAtendimento] = useState(hoje());
  const [ajustesAgenda, setAjustesAgenda] = useState<AjustesAgenda>({});

  const iniciar = useCallback(
    (fatos: Fato[]) => {
      const sessao = new Sessao(baseCompilada, fatos);
      sessaoRef.current = sessao;
      setPasso(sessao.proximo());
    },
    [],
  );

  useEffect(() => {
    if (!animalId) return;
    let ativo = true;
    (async () => {
      const [a, fatos] = await Promise.all([obterAnimal(animalId), fatosDoAnimal(animalId)]);
      if (!ativo) return;
      setAnimal(a);
      setPreCarregados(fatos);
      iniciar(fatos);
    })();
    return () => {
      ativo = false;
    };
  }, [animalId, iniciar]);

  const responder = (variavel: string, valor: Valor, cf: number) => {
    const s = sessaoRef.current;
    if (!s) return;
    if (cf !== 0) s.responder({ variavel, valor, cf });
    else s.responder({ variavel, valor, cf: 0 }); // "não sei": fica desconhecido
    setMostrarPorque(false);
    const proximo = s.proximo();
    if (proximo.parecer?.bandeiraVermelha) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    setPasso(proximo);
  };

  const voltar = () => {
    const s = sessaoRef.current;
    if (!s?.voltar()) return;
    setMostrarPorque(false);
    setPasso(s.proximo());
  };

  /** "Não sei" não vira falso: o fato simplesmente não entra na memória. */
  const naoSei = (variavel: string) => responder(variavel, false, 0);

  const descartarFato = (variavel: string) => {
    const restantes = preCarregados.filter((f) => f.variavel !== variavel);
    setPreCarregados(restantes);
    iniciar(restantes);
  };

  const encerrarAgora = () => {
    const s = sessaoRef.current;
    if (!s) return;
    setPasso({
      tipo: 'parecer',
      parecer: s.encerrar(),
      hipoteses: s.hipoteses(),
      perguntasFeitas: s.perguntasRespondidas.length,
    });
  };

  const salvar = async (parecer: Parecer) => {
    const s = sessaoRef.current;
    if (!s || !animalId || salvando) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      const id = await salvarConsulta(animalId, s, parecer, [...condutaMarcada], { dataAtendimento, compromissos: compromissosDaAgenda(parecer, [...condutaMarcada], ajustesAgenda) });

      // Cada anamnese pode ter mudado os indicadores do mês (um novo caso de
      // mastite, um CMT recém-lançado): reavalia as regras de rebanho e grava
      // no calendário as medidas que passaram a valer para a propriedade toda.
      await diagnosticarRebanho(dataAtendimento);

      setSalvo(id);
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  if (!animal || !passo) return <Carregando texto="Carregando o histórico do animal…" />;

  // -------------------------------------------------------------------------
  // Bandeira vermelha — interrompe tudo
  // -------------------------------------------------------------------------
  const bandeira = passo.parecer?.bandeiraVermelha;
  if (bandeira) {
    return (
      <Tela style={{ backgroundColor: c.alertaFundo }}>
        <View
          style={{
            backgroundColor: c.alerta,
            borderRadius: 12,
            padding: espaco.lg,
            alignItems: 'center',
            gap: espaco.sm,
          }}
        >
          <MaterialIcons name="warning" size={48} color="#FFFFFF" />
          <Txt v="h1" cor="#FFFFFF" centro>
            ATENÇÃO
          </Txt>
          <Txt v="h3" cor="#FFFFFF" centro>
            {bandeira.rotulo}
          </Txt>
        </View>

        <Espaco h={espaco.lg} />
        <Cartao destaque={c.alerta}>
          <Txt v="corpoForte">{bandeira.descricao}</Txt>
          <Separador />
          <Txt v="corpoForte">Faça agora</Txt>
          <Espaco h={6} />
          {bandeira.conduta.map((item) => (
            <Linha key={item} centro={false} gap={espaco.sm} style={{ marginBottom: espaco.sm }}>
              <MaterialIcons name="priority-high" size={18} color={c.alerta} />
              <Txt v="label" style={{ flex: 1 }}>
                {item}
              </Txt>
            </Linha>
          ))}
          <Separador />
          <Txt v="caption" cor={c.textoSecundario}>
            {bandeira.fontes.join(' · ')}
          </Txt>
        </Cartao>

        <Espaco h={espaco.lg} />
        <AgendaProntuario parecer={passo.parecer!} feitas={[...condutaMarcada]} ajustes={ajustesAgenda}
          aoMudar={setAjustesAgenda} dataAtendimento={dataAtendimento} aoMudarData={setDataAtendimento} bloqueado={!!salvo || salvando} />
        <ComoChegueiNisso parecer={passo.parecer!} chave={`diagnostico=${bandeira.id}`} />
        <AvisoVeterinario />

        <Espaco h={espaco.lg} />
        {!!erroSalvar && <Alerta tipo="alerta" titulo="Não foi possível salvar a consulta" texto={erroSalvar} />}
        <Botao
          grande
          titulo={salvo ? 'Salvo no prontuário' : 'Salvar no prontuário'}
          icone={salvo ? 'check' : 'save'}
          desabilitado={!!salvo || salvando}
          aoTocar={() => salvar(passo.parecer!)}
        />
        <Espaco h={espaco.sm} />
        {salvo && <Botao titulo="Ver calendário" variante="secundario" aoTocar={() => router.push('/calendario')} />}
        <Botao titulo="Voltar ao início" variante="secundario" aoTocar={() => router.replace('/')} />
      </Tela>
    );
  }

  // -------------------------------------------------------------------------
  // Parecer final
  // -------------------------------------------------------------------------
  if (passo.tipo === 'parecer' && passo.parecer) {
    return (
      <ParecerFinal
        parecer={passo.parecer}
        animal={animal}
        perguntasFeitas={passo.perguntasFeitas}
        agenda={<AgendaProntuario parecer={passo.parecer} feitas={[...condutaMarcada]} ajustes={ajustesAgenda}
          aoMudar={setAjustesAgenda} dataAtendimento={dataAtendimento} aoMudarData={setDataAtendimento} bloqueado={!!salvo || salvando} />}
        condutaMarcada={condutaMarcada}
        aoMarcarConduta={(item) =>
          setCondutaMarcada((s) => {
            const n = new Set(s);
            if (n.has(item)) n.delete(item);
            else n.add(item);
            return n;
          })
        }
        salvo={salvo}
        salvando={salvando}
        erroSalvar={erroSalvar}
        aoSalvar={() => salvar(passo.parecer!)}
        aoVoltar={voltar}
      />
    );
  }

  // -------------------------------------------------------------------------
  // Pergunta
  // -------------------------------------------------------------------------
  const pergunta = passo.pergunta!;

  /** Contexto da sessão: no computador vira painel lateral; no celular, empilha. */
  const painelContexto = (
    <View style={{ gap: espaco.md }}>
      {preCarregados.length > 0 && (
        <Cartao>
          <Pressable onPress={() => setMostrarSabidos((v) => !v)}>
            <Linha entre>
              <Linha gap={6}>
                <MaterialIcons name="fact-check" size={18} color={c.primaria} />
                <Txt v="corpoForte" cor={c.primaria}>
                  O que eu já sei ({preCarregados.length})
                </Txt>
              </Linha>
              <MaterialIcons
                name={mostrarSabidos ? 'expand-less' : 'expand-more'}
                size={22}
                color={c.textoSecundario}
              />
            </Linha>
          </Pressable>
          {mostrarSabidos && (
            <>
              <Espaco h={espaco.sm} />
              {preCarregados.map((f) => (
                <Linha key={f.variavel} entre style={{ marginBottom: 6 }}>
                  <Linha gap={6} style={{ flex: 1 }}>
                    <MaterialIcons name="check" size={16} color={c.ok} />
                    <Txt v="label" cor={c.textoSecundario} style={{ flex: 1 }}>
                      {f.descricao}
                    </Txt>
                  </Linha>
                  <Pressable onPress={() => descartarFato(f.variavel)}>
                    <MaterialIcons name="close" size={18} color={c.textoSecundario} />
                  </Pressable>
                </Linha>
              ))}
              <Txt v="caption" cor={c.textoSecundario}>
                Toque no × para descartar um dado que não esteja certo.
              </Txt>
            </>
          )}
        </Cartao>
      )}

      {passo.hipoteses.length > 0 &&
        (amplo ? (
          // No computador há espaço para mostrar a confiança de cada hipótese
          // evoluindo a cada resposta — é o motor pensando à vista.
          <Cartao>
            <Linha gap={6}>
              <MaterialIcons name="insights" size={18} color={c.primaria} />
              <Txt v="corpoForte" cor={c.primaria}>
                Investigando
              </Txt>
            </Linha>
            <Espaco h={espaco.sm} />
            {passo.hipoteses.slice(0, 5).map((h) => (
              <View key={h.id} style={{ marginBottom: espaco.md }}>
                <Linha entre>
                  <Txt v="label" style={{ flex: 1 }} numberOfLines={2}>
                    {h.rotulo}
                  </Txt>
                  <Txt v="caption" cor={corDaConfianca(h.cf, c)}>
                    {h.confianca}
                  </Txt>
                </Linha>
                <Espaco h={4} />
                <Barra fracao={h.cf} cor={corDaConfianca(h.cf, c)} />
              </View>
            ))}
            <Txt v="caption" cor={c.textoSecundario}>
              A barra mostra o fator de certeza. Ele muda a cada resposta.
            </Txt>
          </Cartao>
        ) : (
          <Linha gap={6} style={{ flexWrap: 'wrap' }}>
            <Txt v="caption" cor={c.textoSecundario}>
              Investigando:
            </Txt>
            {passo.hipoteses.slice(0, 3).map((h) => (
              <Chip key={h.id} texto={`${h.rotulo} (${h.confianca.toLowerCase()})`} />
            ))}
          </Linha>
        ))}
    </View>
  );

  const fluxoPergunta = (
    <View>
      <Txt v="h1">{pergunta.pergunta}</Txt>

      {pergunta.ajuda && (
        <>
          <Espaco h={espaco.md} />
          <Alerta tipo="info" icone="help-outline" titulo="Como verificar" texto={pergunta.ajuda} />
        </>
      )}

      <Espaco h={espaco.xl} />
      <Resposta pergunta={pergunta} aoResponder={responder} aoNaoSaber={naoSei} />

      <Espaco h={espaco.xl} />
      <Pressable onPress={() => setMostrarPorque((v) => !v)}>
        <Linha gap={6}>
          <MaterialIcons name="psychology" size={20} color={c.primaria} />
          <Txt v="corpoForte" cor={c.primaria}>
            Por que essa pergunta?
          </Txt>
        </Linha>
      </Pressable>

      {mostrarPorque && passo.justificativa && (
        <>
          <Espaco h={espaco.sm} />
          <Cartao>
            <Txt v="corpoForte">{passo.justificativa.texto}</Txt>
            <Espaco h={espaco.sm} />
            {passo.justificativa.regrasPendentes.map((r) => (
              <View key={r.id} style={{ marginBottom: espaco.md }}>
                <Txt v="label" cor={c.primaria}>
                  {r.id} — {r.titulo}
                </Txt>
                <Txt v="caption" cor={c.textoSecundario}>
                  {r.porque}
                </Txt>
              </View>
            ))}
          </Cartao>
        </>
      )}

      <Espaco h={espaco.xl} />
      <Linha gap={espaco.sm}>
        <Botao
          titulo="Voltar"
          variante="secundario"
          icone="arrow-back"
          style={{ flex: 1 }}
          desabilitado={passo.perguntasFeitas === 0}
          aoTocar={voltar}
        />
        <Botao
          titulo="Concluir agora"
          variante="texto"
          icone="done-all"
          style={{ flex: 1 }}
          aoTocar={encerrarAgora}
        />
      </Linha>
    </View>
  );

  return (
    <Tela>
      <Linha entre>
        <View style={{ flex: 1 }}>
          <Txt v={amplo ? 'h2' : 'corpoForte'}>
            {animal.nome ?? `Brinco ${animal.brinco}`} · {animal.brinco}
          </Txt>
          <Txt v="caption" cor={c.textoSecundario}>
            {ROTULO_CATEGORIA[animal.categoria]}
            {animal.del !== null ? ` · ${animal.del} dias em lactação` : ''}
          </Txt>
        </View>
        <Chip texto={`Pergunta ${passo.perguntasFeitas + 1}`} />
      </Linha>

      <Espaco h={espaco.lg} />

      {amplo ? (
        <View style={{ flexDirection: 'row', gap: espaco.xl, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.5 }}>{fluxoPergunta}</View>
          <View style={{ flex: 1 }}>{painelContexto}</View>
        </View>
      ) : (
        <>
          {painelContexto}
          <Espaco h={espaco.xl} />
          {fluxoPergunta}
        </>
      )}

      <AvisoVeterinario />
    </Tela>
  );
}

// ---------------------------------------------------------------------------
// Entrada de resposta por tipo de pergunta
// ---------------------------------------------------------------------------

function Resposta({
  pergunta,
  aoResponder,
  aoNaoSaber,
}: {
  pergunta: Pergunta;
  aoResponder: (v: string, valor: Valor, cf: number) => void;
  aoNaoSaber: (v: string) => void;
}) {
  const { c, espaco } = useTema();
  const [numeroTexto, setNumeroTexto] = useState('');
  const [quartos, setQuartos] = useState<Record<'ad' | 'ae' | 'pd' | 'pe', ResultadoCMT | null>>({
    ad: null,
    ae: null,
    pd: null,
    pe: null,
  });

  // Troca de pergunta: zera o rascunho da resposta anterior.
  useEffect(() => {
    setNumeroTexto('');
    setQuartos({ ad: null, ae: null, pd: null, pe: null });
  }, [pergunta.var]);

  const pior = useMemo(
    () => piorCMT([quartos.ad, quartos.ae, quartos.pd, quartos.pe]),
    [quartos],
  );

  if (pergunta.tipo === 'boolean') {
    return (
      <View style={{ gap: espaco.md }}>
        <Botao
          grande
          titulo="Sim"
          icone="check-circle"
          aoTocar={() => aoResponder(pergunta.var, true, CF_RESPOSTA.sim)}
        />
        <Botao
          grande
          titulo="Não"
          variante="secundario"
          icone="cancel"
          aoTocar={() => aoResponder(pergunta.var, false, CF_RESPOSTA.sim)}
        />
        <Linha gap={espaco.sm}>
          <Botao
            titulo="Acho que sim"
            variante="secundario"
            style={{ flex: 1 }}
            aoTocar={() => aoResponder(pergunta.var, true, CF_RESPOSTA.achoQueSim)}
          />
          <Botao
            titulo="Acho que não"
            variante="secundario"
            style={{ flex: 1 }}
            aoTocar={() => aoResponder(pergunta.var, false, CF_RESPOSTA.achoQueSim)}
          />
        </Linha>
        <Botao
          titulo="Não sei"
          variante="texto"
          icone="help-outline"
          aoTocar={() => aoNaoSaber(pergunta.var)}
        />
      </View>
    );
  }

  if (pergunta.tipo === 'numero') {
    const valido = numeroTexto.trim() !== '' && Number.isFinite(Number(numeroTexto));
    return (
      <View style={{ gap: espaco.md }}>
        <Linha
          style={{
            borderWidth: 1,
            borderColor: c.borda,
            borderRadius: 8,
            paddingHorizontal: espaco.md,
            backgroundColor: c.superficieAlt,
          }}
        >
          <TextInput
            value={numeroTexto}
            onChangeText={setNumeroTexto}
            keyboardType="numeric"
            placeholder="Digite o valor"
            placeholderTextColor={c.textoSecundario}
            style={{
              flex: 1,
              minHeight: 56,
              color: c.texto,
              fontFamily: 'Inter_600SemiBold',
              fontSize: 20,
            }}
          />
          {pergunta.unidade && (
            <Txt v="label" cor={c.textoSecundario}>
              {pergunta.unidade}
            </Txt>
          )}
        </Linha>
        <Botao
          grande
          titulo="Confirmar"
          icone="check"
          desabilitado={!valido}
          aoTocar={() => aoResponder(pergunta.var, Number(numeroTexto), CF_RESPOSTA.sim)}
        />
        <Botao
          titulo="Não sei / não tenho esse exame"
          variante="texto"
          aoTocar={() => aoNaoSaber(pergunta.var)}
        />
      </View>
    );
  }

  if (pergunta.tipo === 'por_quarto' || pergunta.tipo === 'enum') {
    const opcoes = pergunta.opcoes ?? [];

    if (pergunta.tipo === 'enum') {
      return (
        <View style={{ gap: espaco.sm }}>
          {opcoes.map((o) => (
            <Botao
              key={o.valor}
              titulo={o.rotulo}
              variante="secundario"
              aoTocar={() => aoResponder(pergunta.var, o.valor, CF_RESPOSTA.sim)}
            />
          ))}
          <Botao titulo="Não sei" variante="texto" aoTocar={() => aoNaoSaber(pergunta.var)} />
        </View>
      );
    }

    // por_quarto: coleta os 4 quartos; o motor recebe o PIOR resultado.
    const ordem: ResultadoCMT[] = ['N', 'T', '1', '2', '3', 'PP'];
    const ciclar = (q: 'ad' | 'ae' | 'pd' | 'pe') =>
      setQuartos((atual) => {
        const i = atual[q] === null ? -1 : ordem.indexOf(atual[q]!);
        return { ...atual, [q]: ordem[(i + 1) % ordem.length]! };
      });

    return (
      <View style={{ gap: espaco.md }}>
        <Txt v="label" cor={c.textoSecundario}>
          Toque em cada quarto para registrar o resultado.
        </Txt>
        <UbereQuatroQuartos valores={quartos} aoTocar={ciclar} />
        <Linha gap={6} style={{ flexWrap: 'wrap' }}>
          {opcoes.map((o) => (
            <Chip key={o.valor} texto={o.rotulo} cor={corCMT[o.valor]} />
          ))}
        </Linha>
        <Botao
          grande
          titulo={pior ? `Confirmar (pior quarto: ${pior})` : 'Registre pelo menos um quarto'}
          icone="check"
          desabilitado={pior === null}
          aoTocar={() => pior && aoResponder(pergunta.var, pior, CF_RESPOSTA.sim)}
        />
        <Botao
          titulo="Não fiz esse teste"
          variante="texto"
          aoTocar={() => aoNaoSaber(pergunta.var)}
        />
      </View>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Parecer
// ---------------------------------------------------------------------------

function ParecerFinal({
  parecer,
  animal,
  perguntasFeitas,
  agenda,
  condutaMarcada,
  aoMarcarConduta,
  salvo,
  salvando,
  erroSalvar,
  aoSalvar,
  aoVoltar,
}: {
  parecer: Parecer;
  animal: AnimalComResumo;
  perguntasFeitas: number;
  agenda: React.ReactNode;
  condutaMarcada: Set<string>;
  aoMarcarConduta: (item: string) => void;
  salvo: string | null;
  salvando: boolean;
  erroSalvar: string | null;
  aoSalvar: () => void;
  aoVoltar: () => void;
}) {
  const { c, espaco } = useTema();
  const principal = parecer.hipoteses[0];

  const motivo: Record<string, string> = {
    confianca_suficiente: 'Cheguei a uma conclusão com confiança suficiente.',
    sem_perguntas_uteis: 'Não há mais perguntas que mudem o resultado.',
    limite_de_perguntas: 'Atingi o limite de perguntas — parecer parcial.',
    encerrado_pelo_usuario: 'Você encerrou a consulta.',
    bandeira_vermelha: 'Interrompi por sinal de alerta.',
  };

  return (
    <Tela>
      <Txt v="caption" cor={c.textoSecundario}>
        {animal.nome ?? `Brinco ${animal.brinco}`} · {perguntasFeitas} pergunta(s) ·{' '}
        {motivo[parecer.motivoParada]}
      </Txt>

      {!principal ? (
        <>
          <Espaco h={espaco.lg} />
          <Alerta
            tipo="info"
            icone="search-off"
            titulo="Não encontrei alteração com as informações dadas"
            texto="Isso não descarta mastite subclínica, que só aparece no CMT ou na CCS. Faça o teste de CMT e repita a triagem."
          />
        </>
      ) : (
        <>
          <TituloSecao icone="fact-check">Parecer</TituloSecao>
          <View style={{ gap: espaco.md }}>
            {parecer.hipoteses.map((h, i) => (
              <View key={h.id}>
                <CartaoHipotese
                  hipotese={h}
                  principal={i === 0}
                  condutaMarcada={condutaMarcada}
                  aoMarcarConduta={aoMarcarConduta}
                />
                <ComoChegueiNisso parecer={parecer} chave={`diagnostico=${h.id}`} />
              </View>
            ))}
          </View>
        </>
      )}

      {agenda}
      <AvisoVeterinario />

      <Espaco h={espaco.xl} />
      {!!erroSalvar && <Alerta tipo="alerta" titulo="Não foi possível salvar a consulta" texto={erroSalvar} />}
      <Botao
        grande
        titulo={salvo ? 'Salvo no prontuário' : 'Salvar no prontuário'}
        icone={salvo ? 'check' : 'save'}
        desabilitado={!!salvo || salvando}
        aoTocar={aoSalvar}
      />
      <Espaco h={espaco.sm} />
      {salvo && <Botao titulo="Ver calendário" variante="secundario" aoTocar={() => router.push('/calendario')} />}
      <Linha gap={espaco.sm}>
        <Botao
          titulo="Corrigir última resposta"
          variante="secundario"
          icone="undo"
          style={{ flex: 1 }}
          aoTocar={aoVoltar}
        />
        <Botao
          titulo="Ficha do animal"
          variante="secundario"
          icone="pets"
          style={{ flex: 1 }}
          aoTocar={() => router.replace(`/animal/${animal.id}`)}
        />
      </Linha>

      <Espaco h={espaco.lg} />
      <Txt v="caption" cor={c.textoSecundario}>
        Base de conhecimento v{parecer.kbVersao} · motor de inferência v{parecer.engineVersao} ·{' '}
        {parecer.traco.length} regra(s) disparada(s)
      </Txt>
    </Tela>
  );
}
