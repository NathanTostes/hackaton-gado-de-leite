import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { apagarTudo, obterPropriedade, salvarPropriedade, semear } from '@drmoo/db';
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
  const { c, espaco, raio } = useTema();
  const { dados, carregando, recarregar } = useDados(() => obterPropriedade(), []);

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
  };

  const recriarDemo = async () => {
    setResetando(true);
    try {
      await apagarTudo();
      await semear();
      recarregar();
    } finally {
      setResetando(false);
    }
  };

  const Campo = ({
    rotulo,
    chave,
    nota,
    numerico = true,
  }: {
    rotulo: string;
    chave: keyof typeof form;
    nota?: string;
    numerico?: boolean;
  }) => (
    <View style={{ marginBottom: espaco.md }}>
      <Txt v="caption" cor={c.textoSecundario}>
        {rotulo}
      </Txt>
      <TextInput
        value={form[chave]}
        onChangeText={(v) => {
          setForm((f) => ({ ...f, [chave]: v }));
          setSalvo(false);
        }}
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
      {nota && (
        <Txt v="caption" cor={c.textoSecundario} style={{ marginTop: 2 }}>
          {nota}
        </Txt>
      )}
    </View>
  );

  return (
    <Tela>
      <TituloSecao icone="home-work">Propriedade</TituloSecao>
      <Cartao>
        <Campo rotulo="Nome da propriedade" chave="nome" numerico={false} />
        <Linha gap={espaco.md}>
          <View style={{ flex: 1 }}>
            <Campo rotulo="Área própria (ha)" chave="area_propria_ha" />
          </View>
          <View style={{ flex: 1 }}>
            <Campo rotulo="Área arrendada (ha)" chave="area_arrendada_ha" />
          </View>
        </Linha>
        <Campo
          rotulo="Pessoas na atividade leiteira"
          chave="mao_de_obra_pessoas"
          nota="Usado no indicador leite por mão de obra por dia."
        />
        <Campo
          rotulo="Preço recebido pelo litro (R$)"
          chave="preco_leite_litro"
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
          chave="mao_de_obra_familiar_mes"
          nota="Quanto a família deveria receber se trabalhasse em outra atividade."
        />
        <Campo
          rotulo="Reposição e investimento por mês (R$)"
          chave="reposicao_investimento_mes"
          nota="Reserva para trocar equipamentos e reformar instalações."
        />
      </Cartao>

      <TituloSecao icone="pregnant-woman">Reprodução</TituloSecao>
      <Cartao>
        <Campo
          rotulo="Período de gestação (dias)"
          chave="gestacao_dias"
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
      <Botao grande titulo="Salvar" icone="save" aoTocar={salvar} />

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
          desabilitado={resetando}
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
