import { AgendaProntuario } from '../componentes/agendaProntuario';
import { compromissosDaAgenda, type AjustesAgenda } from '../agendaConsulta';
/**
 * Modo leitura em voz alta: uma única tela, botões enormes, o app falando.
 *
 * Pensado para quem não lê com segurança precisar fazer um prontuário sozinho
 * na fazenda. Quando ativado em Configurações, este é o app inteiro — ver
 * `app/_layout.tsx`, que troca a navegação normal por esta tela sozinha. O
 * botão discreto no canto (`BotaoCantoSair`) é a única saída.
 *
 * Mora em `src/telas`, não em `app/`, de propósito: este componente recebe
 * `aoSair` por prop em vez de navegar por rota, e o Expo Router registraria
 * automaticamente qualquer arquivo dentro de `app/` como uma tela navegável.
 *
 * Reaproveita o mesmo motor e os mesmos dados de `anamnese/[animalId].tsx`;
 * o que muda aqui é só a apresentação — grande, falada, sem texto pequeno.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import {
  CF_RESPOSTA,
  Sessao,
  type Fato,
  type Hipotese,
  type Parecer,
  type Pergunta,
  type ProximoPasso,
  type Valor,
} from '@drmoo/engine';
import { baseCompilada } from '@drmoo/knowledge';
import {
  definirModoLeituraVoz,
  fatosDoAnimal,
  listarRebanho,
  type AnimalComResumo,
} from '@drmoo/db';
import { ROTULO_CATEGORIA, hoje } from '@drmoo/domain';
import { Carregando, Txt } from '../componentes/base';
import {
  BotaoCantoSair,
  BotaoEnorme,
  BotaoRepetirFala,
  TelaEnorme,
} from '../componentes/acessibilidade';
import { falar, pararDeFalar } from '../voz';
import { useTema } from '../tema';
import { salvarConsulta } from '../salvarConsulta';

export default function AnamneseVoz({ aoSair }: { aoSair: () => void }) {
  const [animal, setAnimal] = useState<AnimalComResumo | null>(null);

  const sair = useCallback(() => {
    pararDeFalar();
    void definirModoLeituraVoz(false);
    aoSair();
  }, [aoSair]);

  if (!animal) {
    return <EscolherAnimal aoEscolher={setAnimal} aoSair={sair} />;
  }

  return <Atendimento animal={animal} aoTrocarAnimal={() => setAnimal(null)} aoSair={sair} />;
}

// ---------------------------------------------------------------------------
// Passo 1: escolher a vaca
// ---------------------------------------------------------------------------

function EscolherAnimal({
  aoEscolher,
  aoSair,
}: {
  aoEscolher: (a: AnimalComResumo) => void;
  aoSair: () => void;
}) {
  const { c, espaco } = useTema();
  const [lista, setLista] = useState<AnimalComResumo[] | null>(null);

  useEffect(() => {
    let ativo = true;
    listarRebanho({ ordenarPor: 'brinco' }).then((r) => ativo && setLista(r));
    falar('Toque na vaca que você vai atender.');
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <TelaEnorme>
      <BotaoCantoSair aoTocar={aoSair} />
      <Txt v="h1" style={{ fontSize: 26 }}>
        Qual vaca?
      </Txt>
      <Txt v="label" cor={c.textoSecundario} style={{ marginBottom: espaco.lg }}>
        Toque no número do brinco.
      </Txt>
      <BotaoRepetirFala aoTocar={() => falar('Toque na vaca que você vai atender.')} />

      {!lista ? (
        <Carregando texto="Carregando o rebanho…" />
      ) : lista.length === 0 ? (
        <Txt v="corpoForte" cor={c.textoSecundario}>
          Nenhum animal cadastrado ainda.
        </Txt>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {lista.map((a) => (
            <BotaoEnorme
              key={a.id}
              titulo={`Brinco ${a.brinco}${a.nome ? ` — ${a.nome}` : ''}`}
              icone="pets"
              aoTocar={() => {
                pararDeFalar();
                aoEscolher(a);
              }}
            />
          ))}
        </ScrollView>
      )}
    </TelaEnorme>
  );
}

// ---------------------------------------------------------------------------
// Passo 2: o atendimento em si
// ---------------------------------------------------------------------------

function Atendimento({
  animal,
  aoTrocarAnimal,
  aoSair,
}: {
  animal: AnimalComResumo;
  aoTrocarAnimal: () => void;
  aoSair: () => void;
}) {
  const { c, espaco } = useTema();
  const sessaoRef = useRef<Sessao | null>(null);
  const [passo, setPasso] = useState<ProximoPasso | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [dataAtendimento, setDataAtendimento] = useState(hoje());
  const [ajustesAgenda, setAjustesAgenda] = useState<AjustesAgenda>({});
  const [erroSalvar, setErroSalvar] = useState('');

  useEffect(() => {
    let ativo = true;
    (async () => {
      const fatos: Fato[] = await fatosDoAnimal(animal.id);
      if (!ativo) return;
      const sessao = new Sessao(baseCompilada, fatos);
      sessaoRef.current = sessao;
      setPasso(sessao.proximo());
    })();
    return () => {
      ativo = false;
    };
  }, [animal.id]);

  // Fala a pergunta (ou o parecer) toda vez que o passo muda.
  useEffect(() => {
    if (!passo) return;
    if (passo.tipo === 'pergunta' && passo.pergunta) {
      falar(passo.pergunta.pergunta);
    } else if (passo.tipo === 'parecer' && passo.parecer) {
      falar(textoFalado(passo.parecer));
    }
  }, [passo]);

  const responder = (variavel: string, valor: Valor, cf: number) => {
    const s = sessaoRef.current;
    if (!s) return;
    s.responder({ variavel, valor, cf });
    setPasso(s.proximo());
  };

  const naoSei = (variavel: string) => responder(variavel, false, 0);

  const salvar = async (parecer: Parecer) => {
    const s = sessaoRef.current;
    if (!s || salvando) return;
    setSalvando(true);
    setErroSalvar('');
    try {
      await salvarConsulta(animal.id, s, parecer, [], { dataAtendimento, compromissos: compromissosDaAgenda(parecer, [], ajustesAgenda) });

      setSalvo(true);
      falar('Prontuário salvo.');
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : 'Não foi possível salvar o prontuário.');
    } finally {
      setSalvando(false);
    }
  };

  if (!passo) {
    return (
      <TelaEnorme>
        <BotaoCantoSair aoTocar={aoSair} />
        <Carregando texto="Carregando a vaca…" />
      </TelaEnorme>
    );
  }

  const bandeira = passo.parecer?.bandeiraVermelha;

  // -------------------------------------------------------------------------
  // Bandeira vermelha — mesma prioridade visual do app normal, em tamanho maior
  // -------------------------------------------------------------------------
  if (bandeira) {
    return (
      <TelaEnorme>
        <BotaoCantoSair aoTocar={aoSair} />
        <View
          style={{
            backgroundColor: c.alerta,
            borderRadius: 16,
            padding: espaco.lg,
            alignItems: 'center',
            marginBottom: espaco.lg,
          }}
        >
          <Txt v="h1" cor="#FFFFFF" centro style={{ fontSize: 30 }}>
            ATENÇÃO
          </Txt>
          <Txt v="h2" cor="#FFFFFF" centro style={{ fontSize: 22 }}>
            {bandeira.rotulo}
          </Txt>
        </View>
        <BotaoRepetirFala aoTocar={() => falar(textoFalado(passo.parecer!))} />
        <ScrollView>
          {bandeira.conduta.map((item) => (
            <Txt key={item} v="corpoForte" style={{ fontSize: 20, marginBottom: espaco.md }}>
              • {item}
            </Txt>
          ))}
          <AgendaProntuario parecer={passo.parecer!} ajustes={ajustesAgenda} aoMudar={setAjustesAgenda}
            dataAtendimento={dataAtendimento} aoMudarData={setDataAtendimento} bloqueado={salvo || salvando} />
          {!!erroSalvar && <Txt cor={c.alerta}>{erroSalvar}</Txt>}
        </ScrollView>
        <BotaoEnorme
          titulo={salvo ? 'Salvo' : 'Salvar'}
          icone={salvo ? 'check' : 'save'}
          cor={salvo ? c.ok : undefined}
          desabilitado={salvo || salvando}
          aoTocar={() => salvar(passo.parecer!)}
        />
        <BotaoEnorme
          titulo="Atender outra vaca"
          icone="pets"
          cor={c.textoSecundario}
          aoTocar={aoTrocarAnimal}
        />
      </TelaEnorme>
    );
  }

  // -------------------------------------------------------------------------
  // Parecer final
  // -------------------------------------------------------------------------
  if (passo.tipo === 'parecer' && passo.parecer) {
    const principal = passo.parecer.hipoteses[0];
    return (
      <TelaEnorme>
        <BotaoCantoSair aoTocar={aoSair} />
        <Txt v="label" cor={c.textoSecundario}>
          {animal.nome ?? `Brinco ${animal.brinco}`} · {ROTULO_CATEGORIA[animal.categoria]}
        </Txt>
        <Txt v="h1" style={{ fontSize: 26, marginTop: espaco.sm, marginBottom: espaco.md }}>
          Resultado
        </Txt>
        <BotaoRepetirFala aoTocar={() => falar(textoFalado(passo.parecer!))} />

        <ScrollView style={{ marginBottom: espaco.lg }}>
          {!principal ? (
            <Txt v="h3" style={{ fontSize: 22 }}>
              Não encontrei nenhuma alteração com as respostas dadas.
            </Txt>
          ) : (
            <>
              <Txt v="h2" cor={c.primaria} style={{ fontSize: 24, marginBottom: espaco.sm }}>
                {principal.rotulo}
              </Txt>
              <Txt v="corpoForte" style={{ fontSize: 18, marginBottom: espaco.md }}>
                Confiança: {principal.confianca}
              </Txt>
              {principal.conduta.map((item) => (
                <Txt key={item} v="label" style={{ fontSize: 18, marginBottom: espaco.sm }}>
                  • {item}
                </Txt>
              ))}
            </>
          )}
          <AgendaProntuario parecer={passo.parecer!} ajustes={ajustesAgenda} aoMudar={setAjustesAgenda}
            dataAtendimento={dataAtendimento} aoMudarData={setDataAtendimento} bloqueado={salvo || salvando} />
          {!!erroSalvar && <Txt cor={c.alerta}>{erroSalvar}</Txt>}
        </ScrollView>

        <BotaoEnorme
          titulo={salvo ? 'Salvo' : 'Salvar no prontuário'}
          icone={salvo ? 'check' : 'save'}
          cor={salvo ? c.ok : undefined}
          desabilitado={salvo || salvando}
          aoTocar={() => salvar(passo.parecer!)}
        />
        <BotaoEnorme
          titulo="Atender outra vaca"
          icone="pets"
          cor={c.textoSecundario}
          aoTocar={aoTrocarAnimal}
        />
      </TelaEnorme>
    );
  }

  // -------------------------------------------------------------------------
  // Pergunta
  // -------------------------------------------------------------------------
  const pergunta = passo.pergunta!;
  return (
    <TelaEnorme>
      <BotaoCantoSair aoTocar={aoSair} />
      <Txt v="label" cor={c.textoSecundario}>
        {animal.nome ?? `Brinco ${animal.brinco}`}
      </Txt>
      <Txt v="h1" style={{ fontSize: 26, marginTop: espaco.sm, marginBottom: espaco.lg }}>
        {pergunta.pergunta}
      </Txt>
      <BotaoRepetirFala aoTocar={() => falar(pergunta.pergunta)} />

      <ScrollView>
        <RespostaFalada pergunta={pergunta} aoResponder={responder} aoNaoSaber={naoSei} />
      </ScrollView>
    </TelaEnorme>
  );
}

// ---------------------------------------------------------------------------
// Entrada de resposta — sempre botões enormes, qualquer que seja o tipo
// ---------------------------------------------------------------------------

function RespostaFalada({
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

  useEffect(() => {
    setNumeroTexto('');
  }, [pergunta.var]);

  if (pergunta.tipo === 'boolean') {
    return (
      <View>
        <BotaoEnorme
          titulo="Sim"
          icone="check-circle"
          aoTocar={() => aoResponder(pergunta.var, true, CF_RESPOSTA.sim)}
        />
        <BotaoEnorme
          titulo="Não"
          icone="cancel"
          cor={c.textoSecundario}
          aoTocar={() => aoResponder(pergunta.var, false, CF_RESPOSTA.sim)}
        />
        <BotaoEnorme
          titulo="Não sei"
          icone="help"
          cor={c.atencao}
          aoTocar={() => aoNaoSaber(pergunta.var)}
        />
      </View>
    );
  }

  if (pergunta.tipo === 'enum' || pergunta.tipo === 'por_quarto') {
    const opcoes = pergunta.opcoes ?? [];
    return (
      <View>
        {opcoes.map((o) => (
          <BotaoEnorme
            key={o.valor}
            titulo={o.rotulo}
            icone="radio-button-checked"
            aoTocar={() => aoResponder(pergunta.var, o.valor, CF_RESPOSTA.sim)}
          />
        ))}
        <BotaoEnorme
          titulo="Não sei"
          icone="help"
          cor={c.atencao}
          aoTocar={() => aoNaoSaber(pergunta.var)}
        />
      </View>
    );
  }

  // Numérico: ainda exige leitura de dígitos na tela, mas mantém o mesmo
  // botão enorme de confirmação e fala o resultado antes de seguir.
  const valido = numeroTexto.trim() !== '' && Number.isFinite(Number(numeroTexto));
  return (
    <View>
      <TextInput
        value={numeroTexto}
        onChangeText={setNumeroTexto}
        keyboardType="numeric"
        placeholder="Toque aqui e digite o número"
        placeholderTextColor={c.textoSecundario}
        style={{
          minHeight: 72,
          borderWidth: 2,
          borderColor: c.borda,
          borderRadius: 16,
          paddingHorizontal: espaco.lg,
          backgroundColor: c.superficieAlt,
          color: c.texto,
          fontSize: 28,
          marginBottom: espaco.md,
          textAlign: 'center',
        }}
      />
      <BotaoEnorme
        titulo="Confirmar"
        icone="check"
        desabilitado={!valido}
        aoTocar={() => aoResponder(pergunta.var, Number(numeroTexto), CF_RESPOSTA.sim)}
      />
      <BotaoEnorme
        titulo="Não sei"
        icone="help"
        cor={c.atencao}
        aoTocar={() => aoNaoSaber(pergunta.var)}
      />
    </View>
  );
}

/** Texto único para a fala do parecer — resumo que cabe ser ouvido de uma vez. */
function textoFalado(parecer: Parecer): string {
  const bandeira = parecer.bandeiraVermelha;
  if (bandeira) {
    return `Atenção! ${bandeira.rotulo}. ${bandeira.conduta[0] ?? ''}`;
  }
  const principal: Hipotese | undefined = parecer.hipoteses[0];
  if (!principal) return 'Não encontrei nenhuma alteração com as respostas dadas.';
  return `Resultado: ${principal.rotulo}. Confiança: ${principal.confianca}. ${principal.conduta[0] ?? ''}`;
}
