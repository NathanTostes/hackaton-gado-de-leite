import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { listarRebanho } from '@drmoo/db';
import { ROTULO_CATEGORIA, numero } from '@drmoo/domain';
import { Carregando, Linha, MaterialIcons, Tela, Txt, Vazio } from '../../src/componentes/base';
import { useDados } from '../../src/hooks';
import { useTema } from '../../src/tema';

export default function EscolherAnimal() {
  const { c, espaco, raio } = useTema();
  const [busca, setBusca] = useState('');
  const { dados, carregando } = useDados(() => listarRebanho({ busca }), [busca]);

  return (
    <Tela scroll={false}>
      <View style={{ padding: espaco.lg, gap: espaco.md }}>
        <Txt v="h2">Qual animal você vai examinar?</Txt>
        <Txt v="label" cor={c.textoSecundario}>
          O Dr. Moo já carrega do cadastro o que ele sabe sobre o animal — assim não
          pergunta o que você já anotou.
        </Txt>
        <Linha
          style={{
            borderWidth: 1,
            borderColor: c.borda,
            borderRadius: raio.input,
            paddingHorizontal: espaco.md,
            backgroundColor: c.superficieAlt,
          }}
        >
          <MaterialIcons name="search" size={22} color={c.textoSecundario} />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            autoFocus
            placeholder="Brinco ou nome"
            placeholderTextColor={c.textoSecundario}
            style={{
              flex: 1,
              minHeight: 48,
              color: c.texto,
              fontFamily: 'Inter_400Regular',
              fontSize: 16,
            }}
          />
        </Linha>
      </View>

      {carregando && !dados ? (
        <Carregando />
      ) : !dados?.length ? (
        <Vazio icone="search-off" titulo="Nenhum animal encontrado" />
      ) : (
        <FlatList
          data={dados}
          keyExtractor={(a) => a.id}
          initialNumToRender={12}
          contentContainerStyle={{ padding: espaco.lg, paddingTop: 0, gap: espaco.sm }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.replace(`/anamnese/${item.id}`)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: espaco.md,
                borderWidth: 1,
                borderColor: c.borda,
                borderRadius: raio.card,
                padding: espaco.md,
                minHeight: 64,
                backgroundColor: c.superficie,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: c.superficieAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt v="corpoForte" cor={c.primaria}>
                  {item.brinco}
                </Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="corpoForte">{item.nome ?? `Brinco ${item.brinco}`}</Txt>
                <Txt v="caption" cor={c.textoSecundario}>
                  {ROTULO_CATEGORIA[item.categoria]}
                  {item.del !== null ? ` · ${item.del} DEL` : ''}
                  {item.producao_media_dia ? ` · ${numero(item.producao_media_dia)} L/dia` : ''}
                </Txt>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={c.textoSecundario} />
            </Pressable>
          )}
        />
      )}
    </Tela>
  );
}
