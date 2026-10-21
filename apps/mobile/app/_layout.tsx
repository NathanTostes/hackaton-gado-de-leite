import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { abrirBanco, bancoVazio, obterPropriedade, semear } from '@drmoo/db';
import { cores } from '@drmoo/ui';
import { Carregando, Txt } from '../src/componentes/base';
import { BarraSuperior } from '../src/componentes/navegacaoDesktop';
import { ProvedorDeTema, useTema } from '../src/tema';
import { useLayout } from '../src/responsivo';

export default function LayoutRaiz() {
  const [fontesCarregadas] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [bancoPronto, setBancoPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        await abrirBanco();
        // Primeira abertura: popula com a propriedade de demonstração para que o
        // app nunca abra vazio na apresentação.
        if (await bancoVazio()) await semear();
        if (ativo) setBancoPronto(true);
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  // O provedor de tema precisa envolver TAMBÉM as telas de carregamento e de erro:
  // elas usam os mesmos componentes do resto do app, e esses componentes leem o
  // tema pelo contexto.
  return (
    <SafeAreaProvider>
      <ProvedorDeTema>
        <StatusBar style="auto" />
        <Inicializacao erro={erro} pronto={fontesCarregadas && bancoPronto} />
      </ProvedorDeTema>
    </SafeAreaProvider>
  );
}

function Inicializacao({ erro, pronto }: { erro: string | null; pronto: boolean }) {
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

  useEffect(() => {
    let ativo = true;
    obterPropriedade()
      .then((p) => ativo && setPropriedade(p?.nome ?? null))
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: c.fundo }}>
      {/* No computador a marca mora num cabeçalho fixo; no celular, o espaço
          vertical é precioso demais para gastar com isso. */}
      {amplo && <BarraSuperior nomeDaPropriedade={propriedade} />}
      <Navegacao />
    </View>
  );
}

function Navegacao() {
  const { c } = useTema();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.primaria },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 18 },
        contentStyle: { backgroundColor: c.fundo },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="animal/[id]" options={{ title: 'Ficha do animal' }} />
      <Stack.Screen name="anamnese/index" options={{ title: 'Nova anamnese' }} />
      <Stack.Screen name="anamnese/[animalId]" options={{ title: 'Consulta Dr. Moo' }} />
      <Stack.Screen name="prontuario/[id]" options={{ title: 'Prontuário' }} />
      <Stack.Screen name="financeiro" options={{ title: 'Financeiro' }} />
      <Stack.Screen name="conhecimento" options={{ title: 'Base de conhecimento' }} />
      <Stack.Screen name="triagem" options={{ title: 'Triagem' }} />
      <Stack.Screen name="rede-local" options={{ title: 'Rede local' }} />
      <Stack.Screen name="configuracoes" options={{ title: 'Configurações' }} />
    </Stack>
  );
}
