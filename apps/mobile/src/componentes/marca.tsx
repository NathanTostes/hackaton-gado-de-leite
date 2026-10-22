/**
 * A marca no cabeçalho do celular.
 *
 * No computador a logo já mora na barra superior fixa (`BarraSuperior`). No
 * celular não havia marca nenhuma: o cabeçalho era só o título da aba. Este
 * componente coloca a logo lá, pequena o bastante para não roubar altura — o
 * espaço vertical do aparelho continua sendo o recurso escasso.
 */
import { router } from 'expo-router';
import { Image, Pressable } from 'react-native';

export function MarcaCabecalho({ lado = 'esquerda' }: { lado?: 'esquerda' | 'direita' }) {
  return (
    <Pressable
      onPress={() => router.push('/')}
      accessibilityRole="link"
      accessibilityLabel="Dr. Moo — ir para o início"
      style={({ pressed }) => [
        {
          marginLeft: lado === 'esquerda' ? 16 : 0,
          marginRight: lado === 'direita' ? 16 : 0,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Image
        source={require('../../assets/logo-dr-moo.jpg')}
        style={{ width: 30, height: 30, borderRadius: 8 }}
        accessibilityIgnoresInvertColors
      />
    </Pressable>
  );
}
