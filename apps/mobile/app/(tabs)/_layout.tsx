import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { BarraLateral } from '../../src/componentes/navegacaoDesktop';
import { useLayout } from '../../src/responsivo';
import { useTema } from '../../src/tema';

export default function LayoutAbas() {
  const { c } = useTema();
  const { amplo } = useLayout();

  const navegador = (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.primaria },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 18 },
        // No computador, quem mostra onde você está é a barra lateral, e a marca
        // já está no cabeçalho fixo. Um segundo cabeçalho só rouba altura.
        headerShown: !amplo,
        tabBarActiveTintColor: c.primaria,
        tabBarInactiveTintColor: c.textoSecundario,
        tabBarStyle: amplo
          ? { display: 'none' }
          : {
              backgroundColor: c.superficie,
              borderTopColor: c.borda,
              height: 60,
              paddingBottom: 6,
            },
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 12 },
        sceneStyle: { backgroundColor: c.fundo },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          headerTitle: 'Dr. Moo',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="dashboard" size={size} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="rebanho"
        options={{
          title: 'Rebanho',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="pets" size={size} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="saude"
        options={{
          title: 'Saúde',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="health-and-safety" size={size} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendario"
        options={{
          title: 'Calendário',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="calendar-month" size={size} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="mais"
        options={{
          title: 'Mais',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="menu" size={size} color={String(color)} />
          ),
        }}
      />
    </Tabs>
  );

  if (!amplo) return navegador;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.fundo }}>
      <BarraLateral />
      <View style={{ flex: 1 }}>{navegador}</View>
    </View>
  );
}
