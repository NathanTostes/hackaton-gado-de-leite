import { validarCampos } from '../../../src/componentes/validarCampos';
import { useFormulario, useCampoFormulario } from '../../../src/componentes/validacaoFormulario';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { controleLeiteiroDoAnimal, obterAnimal, registrarControleLeiteiro } from '@drmoo/db';
import { formatarBR, hoje, numero } from '@drmoo/domain';
import {
  Acoes,
  Alerta,
  Botao,
  CabecalhoPagina,
  Cartao,
  Carregando,
  Espaco,
  Linha,
  Separador,
  Tela,
  Txt,
  Vazio,
} from '../../../src/componentes/base';
import { useDados } from '../../../src/hooks';
import { useTema } from '../../../src/tema';

export default function LancarLeite() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, espaco, raio } = useTema();

  const { dados, carregando, recarregar } = useDados(async () => {
    if (!id) return null;
    const [animal, historico] = await Promise.all([obterAnimal(id), controleLeiteiroDoAnimal(id)]);
    return { animal, historico };
  }, [id]);

  const [data, setData] = useState(hoje());
  const [manha, setManha] = useState('');
  const [tarde, setTarde] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const formulario = useFormulario();
  const [salvo, setSalvo] = useState(false);

  if (carregando || !dados) return <Carregando />;
  if (!dados.animal) return <Vazio icone="error-outline" titulo="Animal não encontrado" />;

  const litrosManha = Number(manha.replace(',', '.')) || 0;
  const litrosTarde = Number(tarde.replace(',', '.')) || 0;
  const total = litrosManha + litrosTarde;

  const salvar = async () => {
    setErro('');
    setSalvo(false);
    const erros = validarCampos([
      { rotulo: 'Data da ordenha (AAAA-MM-DD)', valor: data, tipo: 'data', obrigatorio: true },
      { rotulo: 'Litros — manhã', valor: manha, tipo: 'numero' },
      { rotulo: 'Litros — tarde', valor: tarde, tipo: 'numero' },
    ]);
    if (formulario.mostrarErros(erros)) {
      setErro('Corrija os campos destacados.');
      return;
    }
    setSalvando(true);
    try {
      await registrarControleLeiteiro(id, data, litrosManha, litrosTarde, observacoes.trim() || null);
      setSalvo(true);
      setObservacoes('');
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      formulario.scroll.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Tela formulario={formulario}>
      <CabecalhoPagina
        titulo={`Produção de leite — ${dados.animal.nome ?? `Brinco ${dados.animal.brinco}`}`}
        subtitulo="Lançamento diário, manhã e tarde, como na ficha de controle leiteiro"
      />

      {!!erro && <Alerta tipo="alerta" titulo="Não foi possível salvar" texto={erro} />}

      <Cartao>
        <Campo rotulo="Data da ordenha (AAAA-MM-DD)" valor={data} aoMudar={setData} numerico={false} />
        <Linha gap={espaco.md}>
          <View style={{ flex: 1 }}>
            <Campo rotulo="Litros — manhã" valor={manha} aoMudar={setManha} />
          </View>
          <View style={{ flex: 1 }}>
            <Campo rotulo="Litros — tarde" valor={tarde} aoMudar={setTarde} />
          </View>
        </Linha>
        <Txt v="label" cor={c.textoSecundario}>
          Total do dia: {numero(total)} L
        </Txt>
        <Espaco h={espaco.md} />
        <Campo rotulo="Observações (opcional)" valor={observacoes} aoMudar={setObservacoes} numerico={false} />
      </Cartao>

      <Acoes aviso={salvo ? <Alerta tipo="ok" titulo="Produção lançada" /> : null}>
        <Botao
          grande
          titulo={salvando ? 'Salvando…' : 'Salvar'}
          icone="save"
          desabilitado={salvando}
          aoTocar={salvar}
        />
      </Acoes>

      <Espaco h={espaco.lg} />
      <Txt v="h3">Últimos lançamentos</Txt>
      <Espaco h={espaco.sm} />
      {dados.historico.length === 0 ? (
        <Vazio icone="water-drop" titulo="Nenhum lançamento ainda" />
      ) : (
        <Cartao>
          {dados.historico.map((h, i) => (
            <View key={h.data}>
              {i > 0 && <Separador />}
              <Linha entre>
                <Txt v="corpoForte">{formatarBR(h.data)}</Txt>
                <Txt v="label" cor={c.textoSecundario}>
                  {numero(h.litros_total)} L
                </Txt>
              </Linha>
              {h.observacoes && (
                <Txt v="caption" cor={c.textoSecundario}>
                  {h.observacoes}
                </Txt>
              )}
            </View>
          ))}
        </Cartao>
      )}

      <Espaco h={espaco.lg} />
      <Botao titulo="Voltar" variante="secundario" aoTocar={() => router.back()} />
    </Tela>
  );
}

function Campo({
  rotulo,
  valor,
  aoMudar,
  numerico = true,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  numerico?: boolean;
}) {
  const { c, espaco, raio } = useTema();
  const campo = useCampoFormulario(rotulo);
  return (
    <View ref={campo.ref} collapsable={false} style={{ marginBottom: espaco.md }}>
      <Txt v="caption" cor={c.textoSecundario}>
        {rotulo}
      </Txt>
      <TextInput
        value={valor}
        onChangeText={(texto) => { campo.limpar(); aoMudar(texto); }}
        autoComplete="off"
        importantForAutofill="no"
        textContentType="none"
        accessibilityLabel={rotulo}
        accessibilityHint={campo.erro}
        aria-invalid={!!campo.erro}
        keyboardType={numerico ? 'numeric' : 'default'}
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: campo.erro ? c.alerta : c.borda,
          borderRadius: raio.input,
          paddingHorizontal: espaco.md,
          backgroundColor: c.superficieAlt,
          color: c.texto,
          fontFamily: 'Inter_400Regular',
          fontSize: 16,
          marginTop: 4,
        }}
      />
      {!!campo.erro && <Txt v="caption" cor={c.alerta}>{campo.erro}</Txt>}
    </View>
  );
}
