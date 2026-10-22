import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { abrirBanco, bancoEmMemoria, obterPropriedade, reabrirBanco } from '@drmoo/db';
import { cores } from '@drmoo/ui';
import { AvisoDuasAbas } from '../src/componentes/avisoDuasAbas';
import { Carregando, Txt } from '../src/componentes/base';
import { MarcaCabecalho } from '../src/componentes/marca';
import { BarraLateral, BarraSuperior } from '../src/componentes/navegacaoDesktop';
import { ProvedorDeModoVoz, useModoVoz } from '../src/modoVoz';
import { ProvedorDeTema, useTema } from '../src/tema';
import { useLayout } from '../src/responsivo';
import AnamneseVoz from '../src/telas/anamneseVoz';

export default function LayoutRaiz() {
  const [fontesCarregadas] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [bancoPronto, setBancoPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // O banco abriu, mas só em memória: outra aba está com o arquivo. O app
  // funciona, porém não salva — e isso precisa ser uma decisão do usuário.
  const [duasAbas, setDuasAbas] = useState(false);

  const prepararBanco = useCallback(async () => {
    await abrirBanco();
    // O app abre vazio de propósito: os dados entram pela importação da
    // planilha, não por um seed embutido.
    return !bancoEmMemoria();
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const persistente = await prepararBanco();
        if (!ativo) return;
        setDuasAbas(!persistente);
        setBancoPronto(true);
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      ativo = false;
    };
  }, [prepararBanco]);

  /** Chamado pela tela de aviso depois que o usuário fecha a outra aba. */
  const tentarDeNovo = useCallback(async () => {
    try {
      await reabrirBanco();
    } catch {
      return false;
    }
    const persistente = !bancoEmMemoria();
    if (persistente) setDuasAbas(false);
    return persistente;
  }, []);

  // O provedor de tema precisa envolver TAMBÉM as telas de carregamento e de erro:
  // elas usam os mesmos componentes do resto do app, e esses componentes leem o
  // tema pelo contexto.
  return (
    <SafeAreaProvider>
      <ProvedorDeTema>
        <ProvedorDeModoVoz>
          <StatusBar style="dark" />
          <Inicializacao
            erro={erro}
            pronto={fontesCarregadas && bancoPronto}
            duasAbas={duasAbas}
            aoTentarNovamente={tentarDeNovo}
            aoContinuarSemSalvar={() => setDuasAbas(false)}
          />
        </ProvedorDeModoVoz>
      </ProvedorDeTema>
    </SafeAreaProvider>
  );
}

function Inicializacao({
  erro,
  pronto,
  duasAbas,
  aoTentarNovamente,
  aoContinuarSemSalvar,
}: {
  erro: string | null;
  pronto: boolean;
  duasAbas: boolean;
  aoTentarNovamente: () => Promise<boolean>;
  aoContinuarSemSalvar: () => void;
}) {
  // Antes de qualquer tela do app: se esta aba não é dona do caderno, ela
  // avisa em vez de fingir que está salvando.
  if (pronto && duasAbas) {
    return (
      <AvisoDuasAbas
        aoTentarNovamente={aoTentarNovamente}
        aoContinuarSemSalvar={aoContinuarSemSalvar}
      />
    );
  }

  if (erro) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: cores.branco }}>
        <Txt v="h2" cor={cores.alerta}>
          Não foi possível abrir o banco local
        </Txt>
        <Txt v="label">{erro}</Txt>
      </View>
    );
  }

  if (!pronto) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: cores.tealProfundo }}>
        <Carregando texto="Preparando o Dr. Moo…" cor={cores.branco} />
      </View>
    );
  }

  return <Aplicacao />;
}

function Aplicacao() {
  const { c } = useTema();
  const { amplo } = useLayout();
  const [propriedade, setPropriedade] = useState<string | null>(null);
  const modoVoz = useModoVoz();

  useEffect(() => {
    let ativo = true;
    obterPropriedade()
      .then((p) => ativo && setPropriedade(p?.nome ?? null))
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, []);

  // Espera a leitura da preferência antes de decidir o que mostrar: sem isso,
  // o app normal pisca na tela por um instante mesmo quando o modo leitura em
  // voz alta está ativo.
  if (!modoVoz.carregado) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: c.fundo }}>
        <Carregando />
      </View>
    );
  }

  // Modo leitura em voz alta: substitui TODA a navegação — abas, barra
  // lateral, pilha de telas — por uma única tela de atendimento. É o modo
  // inteiro do app enquanto estiver ativo, não uma tela a mais dentro dele.
  if (modoVoz.ativo) {
    return <AnamneseVoz aoSair={() => void modoVoz.definir(false)} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.fundo }}>
      {/* No computador a marca mora num cabeçalho fixo; no celular, o espaço
          vertical é precioso demais para gastar com isso. */}
      {amplo && <BarraSuperior nomeDaPropriedade={propriedade} />}
      {/* A barra lateral vive AQUI, fora do navegador, e não dentro de `(tabs)`:
          telas de gestão (Financeiro, Rede local, Configurações, ficha do
          animal) são empilhadas pelo Stack por cima das abas — se a lateral
          morasse lá dentro, ela sumiria justamente nessas telas, e o usuário
          perderia a referência de onde está. */}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {amplo && <BarraLateral />}
        <View style={{ flex: 1 }}>
          <Navegacao />
        </View>
      </View>
    </View>
  );
}

function Navegacao() {
  const { c } = useTema();
  const { amplo } = useLayout();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.primaria },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 18 },
        contentStyle: { backgroundColor: c.fundo },
        // À direita porque a esquerda é do botão de voltar. No computador a
        // logo já está na barra superior fixa — repeti-la seria ruído.
        headerRight: amplo ? undefined : () => <MarcaCabecalho lado="direita" />,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Telas de detalhe: chega-se a elas de dentro de outra tela, então o
          cabeçalho com voltar faz falta mesmo no computador. */}
      <Stack.Screen name="editar-animal/[id]" options={{ title: 'Editar cadastro' }} />
      <Stack.Screen name="animal/[id]" options={{ title: 'Ficha do animal' }} />
      <Stack.Screen name="anamnese/index" options={{ title: 'Nova anamnese' }} />
      <Stack.Screen name="anamnese/[animalId]" options={{ title: 'Consulta Dr. Moo' }} />
      <Stack.Screen name="prontuario/[id]" options={{ title: 'Prontuário' }} />

      {/* Seções de gestão: no computador elas moram na barra lateral, que já
          mostra onde você está. Repetir "← Financeiro" numa faixa só rouba
          altura e sugere uma pilha que não existe. No celular, o cabeçalho
          continua sendo a única forma de voltar. */}
      <Stack.Screen name="financeiro" options={{ title: 'Financeiro', headerShown: !amplo }} />
      <Stack.Screen name="estatisticas" options={{ title: 'Estatísticas', headerShown: !amplo }} />
      <Stack.Screen
        name="conhecimento"
        options={{ title: 'Base de conhecimento', headerShown: !amplo }}
      />
      <Stack.Screen name="triagem" options={{ title: 'Triagem', headerShown: !amplo }} />
      <Stack.Screen name="rede-local" options={{ title: 'Rede local', headerShown: !amplo }} />
      <Stack.Screen name="configuracoes" options={{ title: 'Configurações', headerShown: !amplo }} />
    </Stack>
  );
}
