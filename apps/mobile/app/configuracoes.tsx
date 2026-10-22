import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { obterPropriedade, salvarPropriedade, recriarDemonstracao } from '@drmoo/db';
import { METAS } from '@drmoo/domain';
import {
  Alerta,
  Botao,
  Cartao,
  Carregando,
  Espaco,
  Linha,
  Separador,
  Tela,
  TituloSecao,
  Txt,
} from '../src/componentes/base';
import { useDados } from '../src/hooks';
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
  const [resetando, setResetando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [demoRecriada, setDemoRecriada] = useState(false);

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
    setSalvando(true);
    setErro('');
    setSalvo(false);
    try {
      await salvarPropriedade({
        id: dados?.id,
        nome: form.nome,
        area_propria_ha: Number(form.area_propria_ha) || 0,
        area_arrendada_ha: Number(form.area_arrendada_ha) || 0,
        mao_de_obra_pessoas: Number(form.mao_de_obra_pessoas) || 1,
        preco_leite_litro: Number(form.preco_leite_litro) || 0,
        mao_de_obra_familiar_mes: Number(form.mao_de_obra_familiar_mes) || 0,
        reposicao_investimento_mes: Number(form.reposicao_investimento_mes) || 0,
        gestacao_dias: Number(form.gestacao_dias) || 283,
      });
      setSalvo(true);
      recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  const recriarDemo = async () => {
    setResetando(true);
    setErro('');
    setSalvo(false);
    setDemoRecriada(false);
    try {
      await recriarDemonstracao();
      setDemoRecriada(true);
      recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setResetando(false);
    }
  };

  const alterarCampo = (chave: keyof typeof form, valor: string) => {
    setForm((f) => ({ ...f, [chave]: valor }));
    setSalvo(false);
  };

  return (
    <Tela>
      {!!(erro || erroCarga) && <Alerta tipo="alerta" titulo="Não foi possível concluir" texto={erro || erroCarga || ''} />}
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
      {salvo && <Alerta tipo="ok" titulo="Configurações salvas" />}
      <Espaco h={espaco.sm} />
      <Botao grande titulo={salvando ? "Salvando…" : "Salvar"} icone="save" desabilitado={resetando || salvando || carregando || !!erroCarga} aoTocar={salvar} />

      {demoRecriada && <Alerta tipo="ok" titulo="Dados de demonstração recriados" />}
      <TituloSecao icone="science">Demonstração</TituloSecao>
      <Cartao>
        <Txt v="label" cor={c.textoSecundario}>
          Recria o rebanho de demonstração (propriedade do Sr. João, da cartilha). Apaga
          todos os dados atuais. O gerador é determinístico: o resultado é sempre o mesmo.
        </Txt>
        <Espaco h={espaco.md} />
        <Botao
          titulo={resetando ? 'Recriando…' : 'Recriar dados de demonstração'}
          icone="refresh"
          variante="perigo"
          desabilitado={resetando || salvando || carregando}
          aoTocar={recriarDemo}
        />
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
  return (
    <View style={{ marginBottom: espaco.md }}>
      <Txt v="caption" cor={c.textoSecundario}>
        {rotulo}
      </Txt>
      <TextInput
        value={valor}
        onChangeText={aoMudar}
        autoComplete="off"
        importantForAutofill="no"
        textContentType="none"
        accessibilityLabel={rotulo}
        keyboardType={numerico ? 'numeric' : 'default'}
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: c.borda,
          borderRadius: raio.input,
          paddingHorizontal: espaco.md,
          backgroundColor: c.superficieAlt,
          color: c.texto,
          fontFamily: 'Inter_400Regular',
          fontSize: 16,
          marginTop: 4,
        }}
      />
      {!!nota && (
        <Txt v="caption" cor={c.textoSecundario} style={{ marginTop: 2 }}>
          {nota}
        </Txt>
      )}
    </View>
  );
}
