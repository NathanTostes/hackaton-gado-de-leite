/**
 * Tela de bloqueio: o Dr. Moo já está aberto em outra aba.
 *
 * No navegador, o banco do app é um arquivo no OPFS, e o OPFS aceita **um
 * acesso de escrita por vez**. A segunda aba não consegue o arquivo — e um app
 * que parece funcionar mas não salva nada é pior do que um app que avisa.
 *
 * Por isso esta tela ocupa a página inteira, no lugar do app: ela explica o que
 * aconteceu, oferece tentar de novo (depois de fechar a outra aba) e, para quem
 * só quer dar uma olhada, deixa continuar num banco temporário — dizendo com
 * todas as letras que nada será salvo.
 */
import { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { cores, espaco as espacos, raio } from '@drmoo/ui';
import { MaterialIcons, Txt } from './base';

export function AvisoDuasAbas({
  aoTentarNovamente,
  aoContinuarSemSalvar,
}: {
  /** Tenta abrir o banco de verdade outra vez. Resolve `true` quando consegue. */
  aoTentarNovamente: () => Promise<boolean>;
  aoContinuarSemSalvar: () => void;
}) {
  const [tentando, setTentando] = useState(false);
  const [falhouDeNovo, setFalhouDeNovo] = useState(false);

  const tentar = async () => {
    setTentando(true);
    setFalhouDeNovo(false);
    try {
      const conseguiu = await aoTentarNovamente();
      if (!conseguiu) setFalhouDeNovo(true);
    } finally {
      setTentando(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.tealProfundo }}
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: espacos.lg,
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: 560,
          backgroundColor: cores.branco,
          borderRadius: raio.card,
          padding: espacos.xl,
          alignItems: 'center',
          gap: espacos.md,
        }}
      >
        {/* Marca por ícone, e não pela logo em arquivo: esta tela precisa
            desenhar mesmo quando o app ainda não terminou de subir. */}
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: cores.tealSuave,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialIcons name="menu-book" size={32} color={cores.tealProfundo} />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: cores.tealSuave,
            paddingHorizontal: espacos.md,
            paddingVertical: 6,
            borderRadius: raio.chip,
          }}
        >
          <MaterialIcons name="tab-unselected" size={18} color={cores.tealProfundo} />
          <Txt v="label" cor={cores.tealProfundo}>
            Uma aba por vez
          </Txt>
        </View>

        <Txt v="h1" cor={cores.preto} style={{ textAlign: 'center' }}>
          O Dr. Moo foi aberto em outra aba
        </Txt>

        <Txt v="corpo" cor={cores.cinza700} style={{ textAlign: 'center' }}>
          O caderno da propriedade é um arquivo guardado dentro do navegador, e o navegador deixa
          só uma aba escrever nele por vez. A aba mais nova é sempre quem fica com o arquivo — é o
          que impede duas abas de gravarem por cima uma da outra e perderem o registro da ordenha.
        </Txt>

        <View
          style={{
            backgroundColor: cores.cinza50,
            borderRadius: raio.card,
            padding: espacos.md,
            width: '100%',
            gap: 8,
          }}
        >
          <Passo numero={1} texto="Volte à aba mais nova do Dr. Moo e continue por lá." />
          <Passo numero={2} texto="Ou feche a outra aba e toque em “Tentar de novo” aqui." />
        </View>

        {falhouDeNovo && (
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              backgroundColor: cores.alertaClaro,
              borderRadius: raio.card,
              padding: espacos.md,
              width: '100%',
            }}
          >
            <MaterialIcons name="error-outline" size={20} color={cores.alerta} />
            <Txt v="label" cor={cores.alerta} style={{ flex: 1 }}>
              A outra aba ainda está com o caderno. Feche-a por completo (ou a outra janela do
              mesmo navegador) e tente de novo.
            </Txt>
          </View>
        )}

        <BotaoAviso
          titulo={tentando ? 'Tentando…' : 'Tentar de novo'}
          icone="refresh"
          principal
          desabilitado={tentando}
          aoTocar={() => void tentar()}
        />

        <BotaoAviso
          titulo="Continuar aqui sem salvar"
          icone="visibility"
          desabilitado={tentando}
          aoTocar={aoContinuarSemSalvar}
        />

        <Txt v="caption" cor={cores.cinza500} style={{ textAlign: 'center' }}>
          Continuando, esta aba usa uma cópia temporária com os dados de demonstração. Nada do que
          você registrar nela será guardado.
          {Platform.OS === 'web' ? ' No aplicativo de celular e no de computador isso não acontece.' : ''}
        </Txt>
      </View>
    </ScrollView>
  );
}

function Passo({ numero, texto }: { numero: number; texto: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: cores.tealProfundo,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt v="caption" cor={cores.branco}>
          {String(numero)}
        </Txt>
      </View>
      <Txt v="label" cor={cores.cinza700} style={{ flex: 1 }}>
        {texto}
      </Txt>
    </View>
  );
}

/**
 * Botão próprio: esta tela aparece **antes** do provedor de tema, porque é a
 * resposta a uma falha de abertura do banco. Por isso usa os tokens direto.
 */
function BotaoAviso({
  titulo,
  icone,
  principal,
  desabilitado,
  aoTocar,
}: {
  titulo: string;
  icone: React.ComponentProps<typeof MaterialIcons>['name'];
  principal?: boolean;
  desabilitado?: boolean;
  aoTocar: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      disabled={desabilitado}
      onPress={aoTocar}
      style={({ pressed }) => ({
        width: '100%',
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: raio.input,
        backgroundColor: principal ? cores.tealProfundo : 'transparent',
        borderWidth: principal ? 0 : 1,
        borderColor: cores.cinza200,
        opacity: desabilitado ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      <MaterialIcons name={icone} size={20} color={principal ? cores.branco : cores.tealProfundo} />
      <Txt v="corpoForte" cor={principal ? cores.branco : cores.tealProfundo}>
        {titulo}
      </Txt>
    </Pressable>
  );
}
