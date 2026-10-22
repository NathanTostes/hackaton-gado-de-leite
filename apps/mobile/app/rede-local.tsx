/**
 * Rede local — sincronização entre aparelhos da mesma propriedade.
 *
 * Um aparelho (ou o computador que já serve o app) roda `npm run sync` e vira o
 * servidor da propriedade; os demais digitam o endereço e o código de 6 dígitos
 * mostrados no terminal daquele aparelho. A troca acontece dentro da rede Wi-Fi
 * local: nenhuma requisição sai para a internet.
 */
import { useCallback, useEffect, useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import {
  configuracaoSync,
  salvarConfiguracaoSync,
  sincronizar,
  verificarServidor,
  type ConfiguracaoSync,
} from '@drmoo/db';
import type { DispositivoConhecido, ResultadoSincronizacao } from '@drmoo/sync';
import {
  Acoes,
  Alerta,
  Botao,
  CabecalhoPagina,
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

/** Chute inicial: o servidor costuma ser a mesma máquina que serve o app. */
function enderecoSugerido(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return '';
  const host = window.location?.hostname;
  return host ? `http://${host}:8787` : '';
}

type Estado =
  | { tipo: 'ocioso' }
  | { tipo: 'trabalhando'; texto: string }
  | { tipo: 'erro'; texto: string }
  | { tipo: 'conectado'; propriedade: string; dispositivos: DispositivoConhecido[] }
  | { tipo: 'sincronizado'; resultado: ResultadoSincronizacao };

export default function RedeLocal() {
  const { c, espaco } = useTema();
  const [config, setConfig] = useState<ConfiguracaoSync | null>(null);
  const [endereco, setEndereco] = useState('');
  const [codigo, setCodigo] = useState('');
  const [dispositivo, setDispositivo] = useState('');
  const [estado, setEstado] = useState<Estado>({ tipo: 'ocioso' });

  useEffect(() => {
    let ativo = true;
    void configuracaoSync().then((c0) => {
      if (!ativo) return;
      setConfig(c0);
      setEndereco(c0.endereco || enderecoSugerido());
      setCodigo(c0.codigo);
      setDispositivo(c0.dispositivo);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const testar = useCallback(async () => {
    setEstado({ tipo: 'trabalhando', texto: 'Procurando o servidor na rede…' });
    try {
      const saude = await verificarServidor(endereco);
      setEstado({ tipo: 'conectado', propriedade: saude.propriedade, dispositivos: saude.dispositivos });
    } catch (e) {
      setEstado({ tipo: 'erro', texto: e instanceof Error ? e.message : String(e) });
    }
  }, [endereco]);

  const sincronizarAgora = useCallback(async () => {
    setEstado({ tipo: 'trabalhando', texto: 'Trocando dados com os outros aparelhos…' });
    try {
      const resultado = await sincronizar({ endereco, codigo, dispositivo });
      setEstado({ tipo: 'sincronizado', resultado });
      setConfig(await configuracaoSync());
    } catch (e) {
      setEstado({ tipo: 'erro', texto: e instanceof Error ? e.message : String(e) });
    }
  }, [endereco, codigo, dispositivo]);

  const renomear = useCallback(
    (nome: string) => {
      setDispositivo(nome);
      void salvarConfiguracaoSync({ dispositivo: nome });
    },
    [setDispositivo],
  );

  const ocupado = estado.tipo === 'trabalhando';
  const dispositivos =
    estado.tipo === 'conectado'
      ? estado.dispositivos
      : estado.tipo === 'sincronizado'
        ? estado.resultado.dispositivos
        : [];

  return (
    <Tela>
      <CabecalhoPagina
        titulo="Rede local"
        subtitulo="Sincronização entre os aparelhos da propriedade, sem internet"
      />
      <Alerta
        tipo="info"
        icone="wifi"
        titulo="Sincronização na rede da propriedade"
        texto="Um aparelho roda o servidor (npm run sync) e mostra o endereço e o código de 6 dígitos. Os outros digitam esses dados aqui. Nada sai para a internet — a troca acontece dentro do Wi-Fi local."
      />

      <TituloSecao icone="settings-ethernet">Servidor da propriedade</TituloSecao>
      <Cartao>
        <Campo
          rotulo="Endereço na rede local"
          valor={endereco}
          aoMudar={setEndereco}
          placeholder="http://192.168.0.10:8787"
        />
        <Campo
          rotulo="Código de pareamento (6 dígitos)"
          valor={codigo}
          aoMudar={(v) => setCodigo(v.replace(/\D/g, '').slice(0, 6))}
          teclado="numeric"
          placeholder="000000"
        />
        <Campo
          rotulo="Nome deste aparelho"
          valor={dispositivo}
          aoMudar={renomear}
          placeholder="Celular do retireiro"
        />
        <Txt v="caption" cor={c.textoSecundario}>
          {config?.ultimaSincronizacao
            ? `Última sincronização: ${new Date(config.ultimaSincronizacao).toLocaleString('pt-BR')}`
            : 'Este aparelho ainda não sincronizou.'}
        </Txt>
      </Cartao>

      <Espaco h={espaco.lg} />
      <Acoes>
        <Botao
          titulo={ocupado ? 'Aguarde…' : 'Sincronizar agora'}
          icone="sync"
          desabilitado={ocupado || !endereco.trim() || codigo.length !== 6}
          aoTocar={() => void sincronizarAgora()}
        />
        <Botao
          titulo="Testar conexão"
          icone="network-check"
          variante="secundario"
          desabilitado={ocupado || !endereco.trim()}
          aoTocar={() => void testar()}
        />
      </Acoes>

      <Espaco h={espaco.lg} />
      <Resultado estado={estado} />

      {dispositivos.length > 0 && (
        <>
          <TituloSecao icone="devices">Aparelhos da propriedade</TituloSecao>
          <View style={{ gap: espaco.sm }}>
            {dispositivos.map((d) => (
              <Cartao key={d.nome}>
                <Linha entre>
                  <Linha gap={espaco.md} style={{ flex: 1 }}>
                    <MaterialIcons name="smartphone" size={26} color={c.textoSecundario} />
                    <View style={{ flex: 1 }}>
                      <Txt v="corpoForte">{d.nome}</Txt>
                      <Txt v="caption" cor={c.textoSecundario}>
                        {`${d.linhas} registros · visto ${new Date(d.visto).toLocaleString('pt-BR')}`}
                      </Txt>
                    </View>
                  </Linha>
                  {d.nome === dispositivo && <Chip texto="este aparelho" />}
                </Linha>
              </Cartao>
            ))}
          </View>
        </>
      )}

      <TituloSecao icone="architecture">Como funciona</TituloSecao>
      <Cartao>
        <Item
          icone="router"
          titulo="Servidor HTTP na própria LAN"
          texto="O aparelho servidor guarda a base mesclada e a expõe na rede Wi-Fi da propriedade. Nenhuma conexão sai para a internet."
        />
        <Separador />
        <Item
          icone="pin"
          titulo="Pareamento por código de 6 dígitos"
          texto="O código é gerado pelo servidor a cada execução e exigido em toda sincronização. Sem conta, sem cadastro, sem nuvem."
        />
        <Separador />
        <Item
          icone="merge-type"
          titulo="Resolução de conflito por last-write-wins"
          texto="Cada registro carrega updated_at (e deleted_at, quando há exclusão lógica); na divergência vence a escrita mais recente. O mesmo lançamento feito nos dois aparelhos — a ordenha de um animal num dia, a produção da propriedade numa data — é unificado pela data, e não pelo código interno do registro, para a produção não aparecer somada em dobro. A mesclagem é a mesma nos dois lados, então os aparelhos convergem."
        />
        <Separador />
        <Item
          icone="warning-amber"
          titulo="O que a mesclagem não resolve sozinha"
          texto="Dois aparelhos que cadastram o mesmo brinco criam registros distintos: o segundo é recusado pelo banco e aparece como conflito para decisão humana."
        />
      </Cartao>

      <Espaco h={espaco.lg} />
      <Txt v="caption" cor={c.textoSecundario}>
        A solução continua offline: o servidor escuta apenas na rede local da propriedade e o app
        nunca acessa a internet em tempo de execução.
      </Txt>
    </Tela>
  );
}

function Resultado({ estado }: { estado: Estado }) {
  const { c, espaco } = useTema();

  if (estado.tipo === 'trabalhando') {
    return <Alerta tipo="info" icone="sync" titulo="Sincronizando" texto={estado.texto} />;
  }
  if (estado.tipo === 'erro') {
    return <Alerta tipo="alerta" icone="wifi-off" titulo="Não foi possível sincronizar" texto={estado.texto} />;
  }
  if (estado.tipo === 'conectado') {
    return (
      <Alerta
        tipo="ok"
        icone="check-circle"
        titulo="Servidor encontrado"
        texto={`${estado.propriedade} · ${estado.dispositivos.length} aparelho(s) conhecido(s). Informe o código para sincronizar.`}
      />
    );
  }
  if (estado.tipo === 'sincronizado') {
    const { aplicadas, removidas, conflitos, enviadas } = estado.resultado;
    const recebidas = Object.values(aplicadas).reduce((t, n) => t + n, 0);
    const duplicatas = Object.values(removidas).reduce((t, n) => t + n, 0);
    const detalhe = Object.entries(aplicadas)
      .map(([t, n]) => `${t}: ${n}`)
      .join(' · ');
    return (
      <View style={{ gap: espaco.sm }}>
        <Alerta
          tipo="ok"
          icone="cloud-done"
          titulo="Sincronizado"
          texto={
            `${enviadas} registros enviados, ${recebidas} gravados neste aparelho.${detalhe ? ` (${detalhe})` : ''}` +
            (duplicatas
              ? ` ${duplicatas} lançamento(s) repetido(s) do mesmo dia foram unificados: ficou a versão mais recente.`
              : '')
          }
        />
        {conflitos.length > 0 && (
          <Alerta
            tipo="atencao"
            icone="error-outline"
            titulo={`${conflitos.length} registro(s) em conflito`}
            texto={conflitos
              .slice(0, 5)
              .map((x) => `${x.tabela} ${x.id}: ${x.motivo}`)
              .join('\n')}
          />
        )}
      </View>
    );
  }
  return <Txt v="caption" cor={c.textoSecundario}>Nenhuma sincronização nesta sessão.</Txt>;
}

// Identidade estável do componente: preserva o foco enquanto o usuário digita.
function Campo({
  rotulo,
  valor,
  aoMudar,
  teclado,
  placeholder,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  teclado?: 'numeric';
  placeholder?: string;
}) {
  const { c, espaco, raio } = useTema();
  return (
    <View style={{ marginBottom: espaco.md }}>
      <Txt v="caption" cor={c.textoSecundario}>
        {rotulo}
      </Txt>
      <TextInput
        autoComplete="off"
        importantForAutofill="no"
        textContentType="none"
        autoCapitalize="none"
        accessibilityLabel={rotulo}
        value={valor}
        onChangeText={(texto) => aoMudar(texto.replace(/[\r\n]+/g, ''))}
        keyboardType={teclado}
        placeholder={placeholder}
        placeholderTextColor={c.textoSecundario}
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: c.borda,
          borderRadius: raio.input,
          paddingHorizontal: espaco.md,
          paddingVertical: 12,
          backgroundColor: c.superficieAlt,
          color: c.texto,
          fontFamily: 'Inter_400Regular',
          fontSize: 16,
          lineHeight: 22,
          marginTop: 4,
        }}
      />
    </View>
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
