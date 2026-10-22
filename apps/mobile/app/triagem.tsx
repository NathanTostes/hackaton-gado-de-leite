import { useState } from 'react';
import { View } from 'react-native';
import { CabecalhoPagina, Cartao, Espaco, Linha, MaterialIcons, Tela, Txt } from '../src/componentes/base';
import { FormularioAnimal } from '../src/componentes/formularioAnimal';
import { useTema } from '../src/tema';

type Modo = 'escolha' | 'novo' | 'nascimento';

export default function Triagem() {
  const { c, espaco } = useTema();
  const [modo, setModo] = useState<Modo>('escolha');

  if (modo === 'escolha') {
    return (
      <Tela>
        <CabecalhoPagina titulo="Triagem" subtitulo="Entrada de animais na propriedade" />
        <Txt v="h2">O que você está registrando?</Txt>
        <Espaco h={espaco.lg} />
        <Cartao aoTocar={() => setModo('nascimento')}>
          <Linha gap={espaco.md}>
            <MaterialIcons name="child-care" size={32} color={c.primaria} />
            <View style={{ flex: 1 }}>
              <Txt v="h3">Bezerra(o) recém-nascida(o)</Txt>
              <Txt v="caption" cor={c.textoSecundario}>
                Ficha de nascimentos + checklist de colostro e cura do umbigo.
              </Txt>
            </View>
          </Linha>
        </Cartao>
        <Espaco h={espaco.md} />
        <Cartao aoTocar={() => setModo('novo')}>
          <Linha gap={espaco.md}>
            <MaterialIcons name="move-to-inbox" size={32} color={c.primaria} />
            <View style={{ flex: 1 }}>
              <Txt v="h3">Animal novo no rebanho</Txt>
              <Txt v="caption" cor={c.textoSecundario}>
                Compra ou transferência: protocolo de quarentena e exames.
              </Txt>
            </View>
          </Linha>
        </Cartao>
      </Tela>
    );
  }

  return <FormularioAnimal modo={modo} aoVoltar={() => setModo('escolha')} />;
}
