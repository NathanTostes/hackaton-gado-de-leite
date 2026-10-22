import { validarCampos } from '../src/componentes/validarCampos';
import { useFormulario, useCampoFormulario } from '../src/componentes/validacaoFormulario';
import { useEffect, useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import {
  bancoEmMemoria,
  exportarPlanilha,
  importarPlanilha,
  obterPropriedade,
  salvarPropriedade,
  type RelatorioImportacao,
} from '@drmoo/db';
import { METAS } from '@drmoo/domain';
import {
  Acoes,
  Alerta,
  CabecalhoPagina,
  Botao,
  Cartao,
  Carregando,
  Chip,
  Espaco,
  Linha,
  Separador,
  Tela,
  TituloSecao,
  Txt,
} from '../src/componentes/base';
import { entregarArquivo, escolherArquivo } from '../src/arquivos';
import { useDados } from '../src/hooks';
import { useModoVoz } from '../src/modoVoz';
import { useTema } from '../src/tema';

export default function Configuracoes() {
  const { c, espaco } = useTema();
  const { dados, carregando, recarregar, erro: erroCarga } = useDados(() => obterPropriedade(), []);

  const [form, setForm] = useState({
    nome: '',
    area_propria_ha: '',
    area_arrendada_ha: '',
    mao_de_obra_pessoas: '',
    preco_leite_litro: '',
    mao_de_obra_familiar_mes: '',
    reposicao_investimento_mes: '',
    gestacao_dias: '',
  });
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const formulario = useFormulario();
  const [planilhaOcupada, setPlanilhaOcupada] = useState<'exportando' | 'importando' | null>(null);
  const [avisoPlanilha, setAvisoPlanilha] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioImportacao | null>(null);
  const [substituir, setSubstituir] = useState(false);
  const modoVoz = useModoVoz();

  useEffect(() => {
    if (!dados) return;
    setForm({
      nome: dados.nome,
      area_propria_ha: String(dados.area_propria_ha),
      area_arrendada_ha: String(dados.area_arrendada_ha),
      mao_de_obra_pessoas: String(dados.mao_de_obra_pessoas),
      preco_leite_litro: String(dados.preco_leite_litro),
      mao_de_obra_familiar_mes: String(dados.mao_de_obra_familiar_mes),
      reposicao_investimento_mes: String(dados.reposicao_investimento_mes),
      gestacao_dias: String(dados.gestacao_dias),
    });
  }, [dados]);

  if (carregando && !dados) return <Carregando />;

  const salvar = async () => {
    const erros = validarCampos([
      { rotulo: 'Nome da propriedade', valor: form.nome, obrigatorio: true },
      { rotulo: 'Área própria (ha)', valor: form.area_propria_ha, tipo: 'numero' },
      { rotulo: 'Área arrendada (ha)', valor: form.area_arrendada_ha, tipo: 'numero' },
      { rotulo: 'Pessoas na atividade leiteira', valor: form.mao_de_obra_pessoas, tipo: 'numero', positivo: true, inteiro: true },
      { rotulo: 'Preço recebido pelo litro (R$)', valor: form.preco_leite_litro, tipo: 'numero' },
      { rotulo: 'Mão de obra familiar por mês (R$)', valor: form.mao_de_obra_familiar_mes, tipo: 'numero' },
      { rotulo: 'Reposição e investimento por mês (R$)', valor: form.reposicao_investimento_mes, tipo: 'numero' },
      { rotulo: 'Período de gestação (dias)', valor: form.gestacao_dias, tipo: 'numero', positivo: true, inteiro: true },
    ]);
    if (formulario.mostrarErros(erros)) {
      setSalvo(false);
      setErro('Corrija os campos destacados.');
      return;
    }
    setSalvando(true);
    setErro('');
    setSalvo(false);
    try {
      await salvarPropriedade({
        id: dados?.id,
        nome: form.nome,
        area_propria_ha: Number(form.area_propria_ha.replace(',', '.')) || 0,
        area_arrendada_ha: Number(form.area_arrendada_ha.replace(',', '.')) || 0,
        mao_de_obra_pessoas: Number(form.mao_de_obra_pessoas.replace(',', '.')) || 1,
        preco_leite_litro: Number(form.preco_leite_litro.replace(',', '.')) || 0,
        mao_de_obra_familiar_mes: Number(form.mao_de_obra_familiar_mes.replace(',', '.')) || 0,
        reposicao_investimento_mes: Number(form.reposicao_investimento_mes.replace(',', '.')) || 0,
        gestacao_dias: Number(form.gestacao_dias.replace(',', '.')) || 283,
      });
      setSalvo(true);
      recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      formulario.scroll.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSalvando(false);
    }
  };

  const alterarCampo = (chave: keyof typeof form, valor: string) => {
    setForm((f) => ({ ...f, [chave]: valor }));
    setSalvo(false);
  };

  const baixarPlanilha = async () => {
    setPlanilhaOcupada('exportando');
    setAvisoPlanilha(null);
    setRelatorio(null);
    try {
      const bytes = await exportarPlanilha();
      const destino = await entregarArquivo({
        nome: `drmoo-${(dados?.nome ?? 'propriedade').replace(/\s+/g, '-').toLowerCase()}-${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`,
        bytes,
        titulo: 'Planilha da propriedade — Dr. Moo',
      });
      setAvisoPlanilha(
        destino === 'download'
          ? 'Planilha baixada. Ela já vem com os dados atuais e serve como modelo para preencher e importar de volta.'
          : destino === 'compartilhado'
            ? 'Planilha gerada. Escolha para onde enviar.'
            : 'Planilha gerada e salva neste aparelho.',
      );
    } catch (e) {
      setAvisoPlanilha(e instanceof Error ? e.message : String(e));
    } finally {
      setPlanilhaOcupada(null);
    }
  };

  const importar = async () => {
    setAvisoPlanilha(null);
    setRelatorio(null);
    try {
      const arquivo = await escolherArquivo(['xlsx']);
      if (!arquivo) return;
      setPlanilhaOcupada('importando');
      const resultado = await importarPlanilha(arquivo.bytes, { substituir });
      setRelatorio(resultado);
      recarregar();
      setAvisoPlanilha(
        `${resultado.total} registro(s) gravados a partir de ${arquivo.nome}` +
          (resultado.erros.length ? ` · ${resultado.erros.length} linha(s) com problema` : ''),
      );
    } catch (e) {
      setAvisoPlanilha(e instanceof Error ? e.message : String(e));
    } finally {
      setPlanilhaOcupada(null);
    }
  };

  return (
    <Tela formulario={formulario}>
      <CabecalhoPagina
        titulo="Configurações"
        subtitulo="Dados da propriedade, metas e planilha"
      />
      {!!(erro || erroCarga) && <Alerta tipo="alerta" titulo="Não foi possível concluir" texto={erro || erroCarga || ''} />}
      {bancoEmMemoria() && (
        <Alerta
          tipo="atencao"
          icone="memory"
          titulo="Esta aba está usando um banco temporário"
          texto="O arquivo do banco já está aberto em outra aba ou janela do navegador, e o navegador só permite um acesso de escrita por vez. Esta aba funciona normalmente, mas o que você alterar aqui não será salvo. Feche as outras abas do Dr. Moo e recarregue a página."
        />
      )}
      <TituloSecao icone="record-voice-over">Modo leitura em voz alta</TituloSecao>
      <Cartao>
        <Txt v="label" cor={c.textoSecundario}>
          Troca o app inteiro por uma única tela de prontuário, com botões bem grandes
          e o aparelho falando cada pergunta e o resultado em voz alta. Pensado para
          quem prefere ouvir a ler. Um botão discreto no canto da tela volta ao app normal
          a qualquer momento.
        </Txt>
        <Espaco h={espaco.md} />
        <Chip
          texto={modoVoz.ativo ? 'Ativado' : 'Desativado'}
          icone={modoVoz.ativo ? 'check-circle' : 'record-voice-over'}
          cor={modoVoz.ativo ? c.ok : c.primaria}
          ativo={modoVoz.ativo}
          aoTocar={() => void modoVoz.definir(!modoVoz.ativo)}
        />
      </Cartao>

      <TituloSecao icone="home-work">Propriedade</TituloSecao>
      <Cartao>
        <Campo rotulo="Nome da propriedade" valor={form.nome} aoMudar={(v) => alterarCampo('nome', v)} numerico={false} />
        <Linha gap={espaco.md}>
          <View style={{ flex: 1 }}>
            <Campo rotulo="Área própria (ha)" valor={form.area_propria_ha} aoMudar={(v) => alterarCampo('area_propria_ha', v)} />
          </View>
          <View style={{ flex: 1 }}>
            <Campo rotulo="Área arrendada (ha)" valor={form.area_arrendada_ha} aoMudar={(v) => alterarCampo('area_arrendada_ha', v)} />
          </View>
        </Linha>
        <Campo
          rotulo="Pessoas na atividade leiteira"
          valor={form.mao_de_obra_pessoas} aoMudar={(v) => alterarCampo('mao_de_obra_pessoas', v)}
          nota="Usado no indicador leite por mão de obra por dia."
        />
        <Campo
          rotulo="Preço recebido pelo litro (R$)"
          valor={form.preco_leite_litro} aoMudar={(v) => alterarCampo('preco_leite_litro', v)}
          nota="Base do custo por litro e da margem por vaca."
        />
      </Cartao>

      <TituloSecao icone="savings">Mão de obra familiar e investimentos</TituloSecao>
      <Cartao>
        <Txt v="caption" cor={c.textoSecundario}>
          Valores que deveriam ser reservados todo mês. Entram no custo operacional
          total e na margem líquida, conforme a planilha da Embrapa.
        </Txt>
        <Espaco h={espaco.md} />
        <Campo
          rotulo="Mão de obra familiar por mês (R$)"
          valor={form.mao_de_obra_familiar_mes} aoMudar={(v) => alterarCampo('mao_de_obra_familiar_mes', v)}
          nota="Quanto a família deveria receber se trabalhasse em outra atividade."
        />
        <Campo
          rotulo="Reposição e investimento por mês (R$)"
          valor={form.reposicao_investimento_mes} aoMudar={(v) => alterarCampo('reposicao_investimento_mes', v)}
          nota="Reserva para trocar equipamentos e reformar instalações."
        />
      </Cartao>

      <TituloSecao icone="pregnant-woman">Reprodução</TituloSecao>
      <Cartao>
        <Campo
          rotulo="Período de gestação (dias)"
          valor={form.gestacao_dias} aoMudar={(v) => alterarCampo('gestacao_dias', v)}
          nota="Usado para calcular a data provável do parto. Padrão zootécnico: 283 dias."
        />
      </Cartao>

      <TituloSecao icone="flag">Metas de referência</TituloSecao>
      <Cartao>
        <LinhaMeta rotulo="Mastite clínica no mês" valor={`≤ ${METAS.mastiteClinica}%`} />
        <LinhaMeta rotulo="Mastite subclínica" valor={`≤ ${METAS.mastiteSubclinica}%`} />
        <LinhaMeta rotulo="Vacas em lactação" valor={`~${METAS.vacasEmLactacao}%`} />
        <LinhaMeta rotulo="Vacas no rebanho" valor={`~${METAS.vacasNoRebanho}%`} />
        <LinhaMeta rotulo="Intervalo entre CMTs" valor={`${METAS.intervaloCmtDias} dias`} />
        <Separador />
        <Txt v="caption" cor={c.textoSecundario}>
          Metas publicadas pela Embrapa Gado de Leite. Não são editáveis para evitar que
          o indicador perca a referência técnica.
        </Txt>
      </Cartao>

      <Espaco h={espaco.lg} />
      <Acoes aviso={salvo ? <Alerta tipo="ok" titulo="Configurações salvas" /> : null}>
        <Botao
          grande
          titulo={salvando ? 'Salvando…' : 'Salvar'}
          icone="save"
          desabilitado={salvando || carregando || !!erroCarga}
          aoTocar={salvar}
        />
      </Acoes>

      <TituloSecao icone="table-view">Planilha da propriedade (Excel)</TituloSecao>
      <Cartao>
        <Txt v="label" cor={c.textoSecundario}>
          A planilha exportada JÁ É o modelo: uma aba por cadastro, cabeçalhos em português
          e os dados atuais dentro. Preencha ou corrija no Excel e importe de volta. Os
          animais são identificados pelo brinco, e lote, medicamento e vacina pelo nome.
        </Txt>
        <Espaco h={espaco.md} />
        <Acoes>
          <Botao
            titulo={
              planilhaOcupada === 'exportando'
                ? 'Gerando planilha…'
                : Platform.OS === 'web'
                  ? 'Baixar planilha'
                  : 'Exportar planilha'
            }
            icone={Platform.OS === 'web' ? 'download' : 'share'}
            desabilitado={planilhaOcupada !== null}
            aoTocar={() => void baixarPlanilha()}
          />
          <Botao
            titulo={planilhaOcupada === 'importando' ? 'Importando…' : 'Importar planilha preenchida'}
            icone="upload-file"
            variante="secundario"
            desabilitado={planilhaOcupada !== null}
            aoTocar={() => void importar()}
          />
        </Acoes>
        <Espaco h={espaco.md} />
        <Linha gap={espaco.sm}>
          <Chip
            texto={substituir ? 'Vai APAGAR os dados atuais' : 'Acrescenta e atualiza'}
            icone={substituir ? 'delete-forever' : 'playlist-add'}
            cor={substituir ? c.alerta : c.primaria}
            ativo={substituir}
            aoTocar={() => setSubstituir((v) => !v)}
          />
          <Txt v="caption" cor={c.textoSecundario} style={{ flex: 1 }}>
            {substituir
              ? 'Modo substituição: o banco é esvaziado antes de importar.'
              : 'Modo padrão: linhas novas entram, linhas existentes são atualizadas pelo brinco/nome/data.'}
          </Txt>
        </Linha>

        {avisoPlanilha && (
          <>
            <Espaco h={espaco.md} />
            <Alerta
              tipo={relatorio?.erros.length ? 'atencao' : 'ok'}
              icone="table-chart"
              titulo="Planilha"
              texto={avisoPlanilha}
            />
          </>
        )}

        {relatorio && (
          <>
            <Separador />
            <Txt v="corpoForte">Resumo da importação</Txt>
            {Object.entries(relatorio.gravadas).map(([aba, total]) => (
              <Linha key={aba} entre style={{ minHeight: 28 }}>
                <Txt v="label">{aba}</Txt>
                <Txt v="label" cor={c.textoSecundario}>{`${total} registro(s)`}</Txt>
              </Linha>
            ))}
            {relatorio.erros.length > 0 && (
              <>
                <Separador />
                <Txt v="corpoForte" cor={c.alerta}>
                  {`${relatorio.erros.length} linha(s) não entraram`}
                </Txt>
                {relatorio.erros.slice(0, 12).map((e, i) => (
                  <Txt key={`${e.aba}-${e.linha}-${i}`} v="caption" cor={c.textoSecundario}>
                    {`${e.aba}, linha ${e.linha}${e.coluna ? ` (${e.coluna})` : ''}: ${e.motivo}`}
                  </Txt>
                ))}
                {relatorio.erros.length > 12 && (
                  <Txt v="caption" cor={c.textoSecundario}>
                    {`… e mais ${relatorio.erros.length - 12}.`}
                  </Txt>
                )}
              </>
            )}
          </>
        )}
      </Cartao>

    </Tela>
  );
}

function LinhaMeta({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Linha entre style={{ minHeight: 34 }}>
      <Txt v="label">{rotulo}</Txt>
      <Txt v="corpoForte">{valor}</Txt>
    </Linha>
  );
}

function Campo({
  rotulo,
  valor,
  aoMudar,
  nota,
  numerico = true,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  nota?: string;
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
      {!!nota && (
        <Txt v="caption" cor={c.textoSecundario} style={{ marginTop: 2 }}>
          {nota}
        </Txt>
      )}
    </View>
  );
}
