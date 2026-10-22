import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Sessao, tracoEmTexto, type Fato, type Parecer, type RespostaUsuario } from '@drmoo/engine';
import { baseCompilada, rotulos } from '@drmoo/knowledge';
import { obterAnimal, obterAtendimento } from '@drmoo/db';
import { formatarBR } from '@drmoo/domain';
import { htmlProntuario } from '@drmoo/relatorio';
import {
  Acoes,
  Alerta,
  AvisoVeterinario,
  Botao,
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
import { entregarPdf } from '../../src/arquivos';
import { useDados } from '../../src/hooks';
import { useTema } from '../../src/tema';

export default function Prontuario() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, espaco } = useTema();
  const [exportando, setExportando] = useState(false);
  const [avisoExport, setAvisoExport] = useState<string | null>(null);

  const { dados, carregando, erro, recarregar } = useDados(async () => {
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

  if (carregando) return <Carregando />;
  if (erro) return (
    <Tela>
      <Alerta tipo="alerta" titulo="Não foi possível carregar o prontuário" texto={erro} />
      <Botao titulo="Tentar novamente" aoTocar={recarregar} />
    </Tela>
  );
  if (!dados) return <Vazio icone="error-outline" titulo="Prontuário não encontrado" />;

  const { atendimento, animal, parecer, respostas, reproduz } = dados;
  const versaoMudou = atendimento.kb_versao !== parecer.kbVersao;

  const exportar = async () => {
    setExportando(true);
    setAvisoExport(null);
    try {
      const html = htmlProntuario({
        propriedade: null,
        animal: {
          brinco: animal?.brinco ?? '—',
          nome: animal?.nome ?? null,
          categoria: animal?.categoria ?? '',
          raca: animal?.raca ?? null,
          idadeMeses: animal?.idade_meses ?? null,
          del: animal?.del ?? null,
          producaoMediaDia: animal?.producao_media_dia ?? null,
          lote: animal?.lote_nome ?? null,
        },
        atendimento: {
          id: atendimento.id,
          dataHora: atendimento.data_hora,
          queixaPrincipal: atendimento.queixa_principal,
          kbVersao: atendimento.kb_versao,
          engineVersao: atendimento.engine_versao,
          motivoParada: atendimento.motivo_parada,
        },
        hipoteses: parecer.hipoteses.map((h) => ({
          id: h.id,
          rotulo: h.rotulo,
          descricao: h.descricao,
          confianca: h.confianca,
          cf: h.cf,
          bandeiraVermelha: h.bandeiraVermelha,
          conduta: h.conduta,
          fontes: h.fontes,
          status: h.status,
        })),
        bandeiraVermelha: parecer.bandeiraVermelha
          ? {
              id: parecer.bandeiraVermelha.id,
              rotulo: parecer.bandeiraVermelha.rotulo,
              descricao: parecer.bandeiraVermelha.descricao,
              confianca: parecer.bandeiraVermelha.confianca,
              cf: parecer.bandeiraVermelha.cf,
              bandeiraVermelha: true,
              conduta: parecer.bandeiraVermelha.conduta,
              fontes: parecer.bandeiraVermelha.fontes,
              status: parecer.bandeiraVermelha.status,
            }
          : null,
        respostas: respostas.map((r) => ({
          variavel: r.variavel,
          rotulo: rotulos.get(r.variavel) ?? r.variavel,
          valor: typeof r.valor === 'boolean' ? (r.valor ? 'sim' : 'não') : String(r.valor),
          cf: r.cf,
        })),
        traco: tracoEmTexto(parecer.traco),
        reproduz,
        geradoEm: new Date().toISOString(),
      });

      const nome = `prontuario-${animal?.brinco ?? 'animal'}-${atendimento.data_hora.slice(0, 10)}.pdf`;
      const destino = await entregarPdf({ html, nome, titulo: 'Prontuário Dr. Moo' });
      setAvisoExport(
        destino === 'impressao'
          ? 'Abrimos a janela de impressão: escolha "Salvar como PDF" para guardar o arquivo.'
          : destino === 'compartilhado'
            ? 'PDF gerado. Escolha o WhatsApp (ou outro aplicativo) para enviar.'
            : 'PDF gerado e salvo neste aparelho.',
      );
    } catch (e) {
      setAvisoExport(e instanceof Error ? e.message : String(e));
    } finally {
      setExportando(false);
    }
  };

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

      <TituloSecao icone="picture-as-pdf">Levar este prontuário</TituloSecao>
      <Acoes>
        <Botao
          titulo={
            exportando
              ? 'Gerando PDF…'
              : Platform.OS === 'web'
                ? 'Baixar prontuário em PDF'
                : 'Enviar prontuário em PDF'
          }
          icone={Platform.OS === 'web' ? 'download' : 'share'}
          grande
          desabilitado={exportando}
          aoTocar={() => void exportar()}
        />
      </Acoes>
      {avisoExport && (
        <>
          <Espaco h={espaco.sm} />
          <Alerta tipo="info" icone="info" titulo="Exportação" texto={avisoExport} />
        </>
      )}

      <Espaco h={espaco.lg} />
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
