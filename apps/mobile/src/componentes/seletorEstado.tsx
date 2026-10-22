import { createElement, useState, type ChangeEvent } from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { ESTADOS_BRASIL } from '../estados';
import { useTema } from '../tema';
import { Txt } from './base';
import { useCampoFormulario } from './validacaoFormulario';

export function SeletorEstado({ valor, aoMudar }: { valor: string; aoMudar: (valor: string) => void }) {
  const { c, espaco, raio } = useTema();
  const campo = useCampoFormulario('Estado');
  const [aberto, setAberto] = useState(false);
  const selecionar = (uf: string) => {
    campo.limpar();
    aoMudar(uf);
    setAberto(false);
  };
  const borda = campo.erro ? c.alerta : c.borda;
  const selecionado = ESTADOS_BRASIL.find(([uf]) => uf === valor);

  return (
    <View ref={campo.ref} collapsable={false} style={{ marginBottom: espaco.md }}>
      <Txt v="caption" cor={c.textoSecundario}>Estado</Txt>
      {Platform.OS === 'web' ? createElement('select', {
        value: valor,
        'aria-label': 'Estado',
        'aria-invalid': !!campo.erro,
        onChange: (evento: ChangeEvent<HTMLSelectElement>) => selecionar(evento.target.value),
        style: {
          width: '100%', minHeight: 48, border: `1px solid ${borda}`,
          borderRadius: raio.input, padding: '10px 12px', marginTop: 4,
          backgroundColor: c.superficieAlt, color: c.texto, fontSize: 16,
          fontFamily: 'Inter_400Regular, sans-serif',
        },
      }, createElement('option', { value: '' }, 'Selecione um estado'),
      ...ESTADOS_BRASIL.map(([uf, nome]) => createElement('option', { key: uf, value: uf }, `${nome} (${uf})`))) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Estado: ${selecionado?.[1] ?? 'não informado'}`}
            accessibilityHint={campo.erro ?? 'Abre a lista de estados'}
            accessibilityState={{ expanded: aberto }}
            onPress={() => setAberto(true)}
            style={{ minHeight: 48, borderWidth: 1, borderColor: borda, borderRadius: raio.input,
              padding: espaco.md, marginTop: 4, backgroundColor: c.superficieAlt }}
          >
            <Txt>{selecionado ? `${selecionado[1]} (${selecionado[0]})` : 'Selecione um estado'} ▾</Txt>
          </Pressable>
          {aberto && <Modal transparent animationType="fade" onRequestClose={() => setAberto(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: espaco.lg }}>
              <View accessibilityViewIsModal style={{ maxHeight: '80%', backgroundColor: c.superficie,
                borderRadius: raio.card, padding: espaco.md, width: '100%', maxWidth: 480, alignSelf: 'center' }}>
                <Txt v="h2">Selecione um estado</Txt>
                <ScrollView keyboardShouldPersistTaps="handled">
                  <Pressable accessibilityRole="button" onPress={() => selecionar('')} style={{ minHeight: 48, justifyContent: 'center' }}>
                    <Txt>Não informado</Txt>
                  </Pressable>
                  {ESTADOS_BRASIL.map(([uf, nome]) => (
                    <Pressable key={uf} accessibilityRole="radio" accessibilityState={{ checked: valor === uf }}
                      onPress={() => selecionar(uf)} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: espaco.sm }}>
                      <Txt cor={valor === uf ? c.primaria : c.texto}>{nome} ({uf})</Txt>
                    </Pressable>
                  ))}
                </ScrollView>
                <Pressable accessibilityRole="button" onPress={() => setAberto(false)} style={{ minHeight: 48, justifyContent: 'center' }}>
                  <Txt cor={c.primaria}>Cancelar</Txt>
                </Pressable>
              </View>
            </View>
          </Modal>}
        </>
      )}
      {!!campo.erro && <Txt v="caption" cor={c.alerta}>{campo.erro}</Txt>}
    </View>
  );
}
