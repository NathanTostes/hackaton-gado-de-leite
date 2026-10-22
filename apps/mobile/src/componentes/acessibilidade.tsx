/**
 * Componentes do modo leitura em voz alta.
 *
 * Pensado para quem não lê com segurança: botões ocupam a largura inteira da
 * tela, têm altura e fonte bem acima do mínimo de toque do resto do app, e
 * cada pergunta é falada em voz alta assim que aparece — ver `src/voz.ts` e
 * `app/anamnese-voz.tsx`.
 */
import { Pressable, View } from 'react-native';
import { MaterialIcons, Txt } from './base';
import { useTema } from '../tema';
import type { NomeIcone } from './base';

/** Altura bem acima do toque mínimo do resto do app (56 px) — o alvo aqui é o polegar de alguém que não vai mirar com precisão. */
const ALTURA_BOTAO_ENORME = 96;

export function BotaoEnorme({
  titulo,
  icone,
  cor,
  aoTocar,
  desabilitado,
}: {
  titulo: string;
  icone: NomeIcone;
  /** Cor de fundo do botão — por padrão a cor primária do tema. */
  cor?: string;
  aoTocar: () => void;
  desabilitado?: boolean;
}) {
  const { c, espaco, raio } = useTema();
  const fundo = cor ?? c.primaria;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      disabled={desabilitado}
      onPress={aoTocar}
      style={({ pressed }) => ({
        minHeight: ALTURA_BOTAO_ENORME,
        borderRadius: raio.card,
        backgroundColor: fundo,
        opacity: desabilitado ? 0.4 : pressed ? 0.8 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: espaco.md,
        paddingHorizontal: espaco.lg,
        marginBottom: espaco.md,
      })}
    >
      <MaterialIcons name={icone} size={44} color="#FFFFFF" />
      <Txt
        v="h1"
        cor="#FFFFFF"
        style={{ fontSize: 28, lineHeight: 34 }}
      >
        {titulo}
      </Txt>
    </Pressable>
  );
}

/**
 * Botão discreto de canto — "sair do modo leitura em voz alta".
 *
 * Fica pequeno e num canto de propósito: é a única saída desta tela para o
 * resto do app, mas não deve competir visualmente com os botões de resposta,
 * que são o que a pessoa vai tocar a cada passo do atendimento.
 */
export function BotaoCantoSair({ aoTocar }: { aoTocar: () => void }) {
  const { c } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sair do modo leitura em voz alta"
      onPress={aoTocar}
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: c.superficieAlt,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: c.borda,
      }}
    >
      <MaterialIcons name="close" size={22} color={c.textoSecundario} />
    </Pressable>
  );
}

export function BotaoRepetirFala({ aoTocar }: { aoTocar: () => void }) {
  const { c, espaco, raio } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Repetir em voz alta"
      onPress={aoTocar}
      style={({ pressed }) => ({
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: espaco.sm,
        paddingVertical: espaco.sm,
        paddingHorizontal: espaco.lg,
        borderRadius: raio.input,
        backgroundColor: c.superficieAlt,
        opacity: pressed ? 0.7 : 1,
        marginBottom: espaco.lg,
      })}
    >
      <MaterialIcons name="volume-up" size={26} color={c.primaria} />
      <Txt v="corpoForte" cor={c.primaria} style={{ fontSize: 18 }}>
        Ouvir de novo
      </Txt>
    </Pressable>
  );
}

/** Tela de largura total, fundo sólido, sem os recuos do resto do app — o conteúdo aqui precisa de todo o espaço. */
export function TelaEnorme({ children }: { children: React.ReactNode }) {
  const { c, espaco } = useTema();
  return (
    <View style={{ flex: 1, backgroundColor: c.fundo, padding: espaco.lg, paddingTop: espaco.xl }}>
      {children}
    </View>
  );
}
