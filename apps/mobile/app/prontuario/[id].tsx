import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Sessao, tracoEmTexto, type Fato, type Parecer, type RespostaUsuario } from '@drmoo/engine';
import { baseCompilada } from '@drmoo/knowledge';
import { obterAnimal, obterAtendimento } from '@drmoo/db';
import { formatarBR } from '@drmoo/domain';
import {
  Alerta,
  AvisoVeterinario,
  Cartao,
  Carregando,
  Espaco,
  Linha,
  MaterialIcons,
  Tela,
  TituloSecao,
  Txt,
  Vazio,
} from '../../src/componentes/base';
import { CartaoHipotese, ComoChegueiNisso } from '../../src/componentes/parecer';
import { useDados } from '../../src/hooks';
import { useTema } from '../../src/tema';

export default function Prontuario() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, espaco } = useTema();

  const { dados, carregando } = useDados(async () => {
    if (!id) return null;
    const atendimento = await obterAtendimento(id);
    if (!atendimento) return null;
    const animal = await obterAnimal(atendimento.animal_id);

    /**
     * Reprodutibilidade (specsDrMoo.md §4.9): em vez de só mostrar o que ficou
     * gravado, o prontuário RE-EXECUTA o motor com os fatos e respostas da época.
     * Se a base de conhecimento mudou de versão desde então, isso fica visível.
     */
    const fatosIniciais = JSON.parse(atendimento.fatos_iniciais) as Fato[];
    const respostas = JSON.parse(atendimento.respostas) as RespostaUsuario[];
    const sessao = Sessao.restaurar(baseCompilada, { fatosIniciais, respostas });
    const passo = sessao.proximo();
    const parecer: Parecer = passo.parecer ?? sessao.encerrar();

    const gravado = JSON.parse(atendimento.conclusoes) as { id: string }[];
    const reproduz =
      JSON.stringify(gravado.map((h) => h.id)) ===
      JSON.stringify(parecer.hipoteses.map((h) => h.id));

    return { atendimento, animal, parecer, respostas, reproduz };
  }, [id]);

  if (carregando || !dados) return <Carregando />;
  if (!dados.atendimento) return <Vazio icone="error-outline" titulo="Prontuário não encontrado" />;

  const { atendimento, animal, parecer, respostas, reproduz } = dados;
  const versaoMudou = atendimento.kb_versao !== parecer.kbVersao;

  return (
    <Tela>
      <Txt v="h2">{animal?.nome ?? `Brinco ${animal?.brinco ?? ''}`}</Txt>
      <Txt v="label" cor={c.textoSecundario}>
        Anamnese de {formatarBR(atendimento.data_hora.slice(0, 10))} ·{' '}
        {respostas.length} pergunta(s) respondida(s)
      </Txt>

      <Espaco h={espaco.md} />
      {versaoMudou ? (
        <Alerta
          tipo="atencao"
          icone="history"
          titulo="A base de conhecimento mudou desde este atendimento"
          texto={`Gravado com a base v${atendimento.kb_versao}; a base atual é a v${parecer.kbVersao}. O parecer abaixo foi recalculado com a base atual.`}
        />
      ) : reproduz ? (
        <Alerta
          tipo="ok"
          icone="verified"
          titulo="Parecer reproduzido"
          texto={`Re-executar o motor com os mesmos fatos e a base v${atendimento.kb_versao} devolveu exatamente o mesmo resultado.`}
        />
      ) : (
        <Alerta
          tipo="atencao"
          icone="warning"
          titulo="Divergência na reprodução"
          texto="O resultado recalculado difere do gravado. Verifique o changelog da base de conhecimento."
        />
      )}

      {parecer.bandeiraVermelha && (
        <>
          <Espaco h={espaco.md} />
          <Alerta
            tipo="alerta"
            icone="warning"
            titulo={parecer.bandeiraVermelha.rotulo}
            texto={parecer.bandeiraVermelha.descricao}
          />
        </>
      )}

      <TituloSecao icone="fact-check">Parecer</TituloSecao>
      {parecer.hipoteses.length === 0 ? (
        <Alerta tipo="info" titulo="Nenhuma alteração foi detectada nesta anamnese" />
      ) : (
        <View style={{ gap: espaco.md }}>
          {parecer.hipoteses.map((h, i) => (
            <View key={h.id}>
              <CartaoHipotese hipotese={h} principal={i === 0} />
              <ComoChegueiNisso parecer={parecer} chave={`diagnostico=${h.id}`} />
            </View>
          ))}
        </View>
      )}

      <TituloSecao icone="list">Respostas coletadas</TituloSecao>
      <Cartao>
        {respostas.map((r) => (
          <Linha key={r.variavel} entre style={{ minHeight: 30 }}>
            <Txt v="label" style={{ flex: 1 }} numberOfLines={2}>
              {r.variavel}
            </Txt>
            <Txt v="label" cor={c.textoSecundario}>
              {typeof r.valor === 'boolean' ? (r.valor ? 'sim' : 'não') : String(r.valor)}
              {r.cf !== 1 && r.cf !== 0 ? ` (CF ${Math.abs(r.cf).toFixed(1)})` : ''}
            </Txt>
          </Linha>
        ))}
      </Cartao>

      <TituloSecao icone="account-tree">Traço completo da inferência</TituloSecao>
      <Cartao>
        <Txt v="caption" style={{ fontFamily: 'Inter_400Regular' }}>
          {tracoEmTexto(parecer.traco) || 'Nenhuma regra disparou.'}
        </Txt>
      </Cartao>

      <AvisoVeterinario />
      <Espaco h={espaco.md} />
      <Linha gap={6} centro={false}>
        <MaterialIcons name="fingerprint" size={16} color={c.textoSecundario} />
        <Txt v="caption" cor={c.textoSecundario} style={{ flex: 1 }}>
          Atendimento {atendimento.id} · base v{atendimento.kb_versao} · motor v
          {atendimento.engine_versao}
        </Txt>
      </Linha>
    </Tela>
  );
}
