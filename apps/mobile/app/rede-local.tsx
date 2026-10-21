/**
 * Rede local — PROTÓTIPO DE TELA.
 *
 * Não há sincronização implementada. Esta tela existe para mostrar o desenho
 * pretendido e para que ninguém saia da demonstração achando que o recurso está
 * pronto: prometer o que não existe é pior do que não ter.
 */
import { View } from 'react-native';
import {
  Alerta,
  Botao,
  Cartao,
  Chip,
  Espaco,
  Linha,
  MaterialIcons,
  Separador,
  Tela,
  TituloSecao,
  Txt,
} from '../src/componentes/base';
import { useTema } from '../src/tema';

const DISPOSITIVOS_EXEMPLO = [
  { nome: 'Celular do Sr. João', papel: 'Servidor', estado: 'este aparelho' },
  { nome: 'Celular do retireiro', papel: 'Cliente', estado: 'visto há 2 h' },
  { nome: 'Tablet do veterinário', papel: 'Cliente', estado: 'nunca pareado' },
];

export default function RedeLocal() {
  const { c, espaco } = useTema();

  return (
    <Tela>
      <Alerta
        tipo="atencao"
        icone="construction"
        titulo="Tela protótipo — recurso não implementado"
        texto="A sincronização entre aparelhos ainda não funciona. O que você vê abaixo é o desenho pretendido, apresentado aqui para avaliação da arquitetura."
      />

      <TituloSecao icone="devices">Dispositivos na propriedade</TituloSecao>
      <View style={{ gap: espaco.sm }}>
        {DISPOSITIVOS_EXEMPLO.map((d, i) => (
          <Cartao key={d.nome}>
            <Linha entre>
              <Linha gap={espaco.md} style={{ flex: 1 }}>
                <MaterialIcons
                  name={i === 0 ? 'smartphone' : i === 1 ? 'phone-android' : 'tablet'}
                  size={26}
                  color={c.textoSecundario}
                />
                <View style={{ flex: 1 }}>
                  <Txt v="corpoForte">{d.nome}</Txt>
                  <Txt v="caption" cor={c.textoSecundario}>
                    {d.estado}
                  </Txt>
                </View>
              </Linha>
              <Chip texto={d.papel} />
            </Linha>
          </Cartao>
        ))}
      </View>

      <Espaco h={espaco.lg} />
      <Botao titulo="Parear novo aparelho" icone="qr-code" desabilitado />
      <Espaco h={espaco.sm} />
      <Botao titulo="Sincronizar agora" icone="sync" variante="secundario" desabilitado />

      <TituloSecao icone="architecture">Como vai funcionar</TituloSecao>
      <Cartao>
        <Item
          icone="router"
          titulo="Servidor HTTP na própria LAN"
          texto="Um aparelho assume o papel de servidor e expõe a base na rede Wi-Fi da propriedade. Nada sai para a internet."
        />
        <Separador />
        <Item
          icone="pin"
          titulo="Pareamento por código de 6 dígitos"
          texto="O aparelho cliente digita o código mostrado no servidor. Sem conta, sem cadastro, sem nuvem."
        />
        <Separador />
        <Item
          icone="merge-type"
          titulo="Resolução de conflito por last-write-wins"
          texto="Cada entidade carrega updated_at e deleted_at; na divergência vence a escrita mais recente, com log de alterações por registro para auditoria."
        />
        <Separador />
        <Item
          icone="backup"
          titulo="Alternativa que já funciona hoje"
          texto="Exportar e importar o arquivo SQLite do aparelho serve como transferência manual entre dispositivos."
        />
      </Cartao>

      <Espaco h={espaco.lg} />
      <Txt v="caption" cor={c.textoSecundario}>
        A solução roda inteiramente em localhost, conforme o regulamento do Hackathon.
        A sincronização em rede local, quando existir, continuará sem depender de
        servidor externo.
      </Txt>
    </Tela>
  );
}

function Item({
  icone,
  titulo,
  texto,
}: {
  icone: React.ComponentProps<typeof MaterialIcons>['name'];
  titulo: string;
  texto: string;
}) {
  const { c, espaco } = useTema();
  return (
    <Linha gap={espaco.md} centro={false}>
      <MaterialIcons name={icone} size={22} color={c.primaria} />
      <View style={{ flex: 1 }}>
        <Txt v="corpoForte">{titulo}</Txt>
        <Txt v="caption" cor={c.textoSecundario}>
          {texto}
        </Txt>
      </View>
    </Linha>
  );
}
