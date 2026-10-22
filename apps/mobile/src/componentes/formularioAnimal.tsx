/**
 * Triagem de entrada: animal novo no rebanho e bezerra recém-nascida.
 * Os campos da ficha de nascimentos seguem exatamente a ficha da Embrapa (p. 22).
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import {
  registrarEntradaAnimal,
  ROTULO_ORIGEM,
  ROTULO_REPRODUCAO,
  type AnimalComResumo,
} from '@drmoo/db';
import { hoje, formatarBR, ROTULO_CATEGORIA, type CategoriaAnimal } from '@drmoo/domain';
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
} from './base';
import { useTema } from '../tema';

const CHECK_QUARENTENA = [
  'Isolar o animal por 21 a 30 dias, longe do rebanho em lactação.',
  'Conferir a GTA e a procedência do animal.',
  'Checar se as vacinas obrigatórias estão em dia (aftosa, raiva, brucelose).',
  'Solicitar exames de brucelose e tuberculose antes de juntar ao rebanho.',
  'Fazer o teste de CMT nos quatro quartos antes de entrar na linha de ordenha.',
  'Registrar peso e escore de condição corporal na entrada.',
  'Ordenhar por último durante toda a quarentena.',
];

const CHECK_NEONATAL = [
  'Fornecer colostro de boa qualidade nas primeiras 6 horas de vida.',
  'Fazer a cura do umbigo com solução adequada, repetindo nas horas seguintes.',
  'Identificar com brinco e registrar pelagem e sinal.',
  'Pesar a bezerra e anotar na ficha de nascimentos.',
  'Alojar em bezerreiro limpo, seco e com cama trocada.',
  'Observar fezes e umbigo diariamente na primeira semana.',
];

export function FormularioAnimal({ modo, aoVoltar, animal }: {
  modo: 'novo' | 'nascimento';
  aoVoltar: () => void;
  animal?: AnimalComResumo;
}) {
  const { c, espaco } = useTema();
  const ehNascimento = modo === 'nascimento';

  const [brinco, setBrinco] = useState(animal?.brinco ?? '');
  const [nome, setNome] = useState(animal?.nome ?? '');
  const [sexo, setSexo] = useState<'M' | 'F'>(animal?.sexo ?? 'F');
  const [peso, setPeso] = useState(String(animal?.peso_nascimento ?? ''));
  const [pelagem, setPelagem] = useState(String(animal?.pelagem_sinal ?? ''));
  const [pai, setPai] = useState(animal?.pai_identificacao ?? '');
  const [observacoes, setObservacoes] = useState(String(animal?.observacoes ?? ''));
  const [feitos, setFeitos] = useState<Set<string>>(new Set());
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [categoria, setCategoria] = useState<CategoriaAnimal>(
    animal?.categoria ?? (ehNascimento ? 'bezerro_mamando' : 'vaca_lactacao'),
  );
  const [origem, setOrigem] = useState<'nascimento' | 'compra' | 'transferencia'>(
    animal?.origem ?? (ehNascimento ? 'nascimento' : 'compra'),
  );
  const [erro, setErro] = useState('');
  const [cadastro, setCadastro] = useState({
    raca: animal?.raca ?? '',
    nascimento: animal?.data_nascimento ? formatarBR(animal.data_nascimento) : (ehNascimento && !animal ? formatarBR(hoje()) : ''),
    entrada: animal?.data_entrada ? formatarBR(animal.data_entrada) : formatarBR(hoje()),
    mae: animal?.mae_identificacao ?? '',
    idade: String(animal?.idade_estimada_meses ?? ''),
    pesoEntrada: String(animal?.peso_entrada ?? ''),
    procedencia: animal?.procedencia ?? '',
    valor: String(animal?.valor_aquisicao ?? ''),
    gta: animal?.numero_gta ?? '',
    historico: animal?.historico_sanitario ?? '',
    reproducao: animal?.situacao_reprodutiva ?? '',
    parto: animal?.ultimo_parto_entrada ? formatarBR(animal.ultimo_parto_entrada) : '',
    lactacoes: String(animal?.numero_lactacoes_entrada ?? ''),
  });
  const mudar = (campo: keyof typeof cadastro, valor: string) =>
    setCadastro((atual) => ({ ...atual, [campo]: valor }));
  const reproduz = sexo === 'F' && ['vaca_lactacao', 'vaca_seca', 'novilha'].includes(categoria);
  const campoCadastro = (campo: keyof typeof cadastro, rotulo: string, numerico = false, placeholder?: string) => (
    <Campo
      key={campo}
      rotulo={rotulo}
      valor={cadastro[campo]}
      aoMudar={(valor) => mudar(campo, valor)}
      teclado={numerico ? 'numeric' : undefined}
      placeholder={placeholder}
    />
  );

  useEffect(() => {
    if (animal) setSalvo(false);
  }, [animal, brinco, nome, sexo, peso, pelagem, pai, observacoes, cadastro, categoria, origem]);
  const checklist = ehNascimento ? CHECK_NEONATAL : CHECK_QUARENTENA.filter((item) =>
    (sexo === 'F' && categoria === 'vaca_lactacao') || (!item.includes('CMT') && !item.includes('Ordenhar')),
  );

  const salvar = async () => {
    if (!brinco.trim() || salvando) return;
    setErro('');
    setSalvando(true);
    try {
      const hj = hoje();
      const nascimento = lerData(cadastro.nascimento);
      const entrada = lerData(cadastro.entrada);
      if (!animal && ehNascimento && !nascimento) throw new Error('Informe a data de nascimento.');
      if (!entrada) throw new Error('Informe a data de entrada.');
      await registrarEntradaAnimal({
        ...animal,
        brinco: brinco.trim(),
        nome: nome.trim() || null,
        sexo,
        categoria,
        data_nascimento: nascimento,
        peso_nascimento: lerNumero(peso),
        pelagem_sinal: pelagem.trim() || null,
        pai_nome: pai.trim() || null,
        origem,
        data_entrada: entrada,
        status: animal?.status ?? (ehNascimento ? 'saudavel' : 'quarentena'),
        raca: cadastro.raca.trim() || null,
        mae_nome: cadastro.mae.trim() || null,
        idade_estimada_meses: nascimento ? null : lerNumero(cadastro.idade),
        idade_estimada_em: nascimento || !cadastro.idade.trim() ? null :
          (animal?.idade_estimada_meses === lerNumero(cadastro.idade) ? animal.idade_estimada_em : hj),
        peso_entrada: lerNumero(cadastro.pesoEntrada),
        procedencia: cadastro.procedencia.trim() || null,
        valor_aquisicao: lerNumero(cadastro.valor),
        numero_gta: cadastro.gta.trim() || null,
        historico_sanitario: cadastro.historico.trim() || null,
        situacao_reprodutiva: reproduz ? cadastro.reproducao || null : null,
        ultimo_parto_entrada: reproduz ? lerData(cadastro.parto) : null,
        numero_lactacoes_entrada: reproduz ? lerNumero(cadastro.lactacoes) : null,
        observacoes: observacoes.trim() || null,
      }, modo);
      setSalvo(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar o animal.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Tela>
      <Txt v="h2">{animal ? 'Editar cadastro do animal' : ehNascimento ? 'Nova bezerra(o)' : 'Animal novo no rebanho'}</Txt>

      {erro.length > 0 && <Alerta tipo="alerta" titulo="Confira os dados" texto={erro} />}
      {salvo && (
        <>
          <Espaco h={espaco.md} />
          <Alerta
            tipo="ok"
            titulo={animal ? "Cadastro atualizado" : "Animal registrado"}
            texto={animal
              ? 'Os dados cadastrais foram atualizados.'
              : ehNascimento
                ? 'Eventos de colostragem e desmame criados no calendário.'
                : categoria === 'vaca_lactacao'
                  ? 'Quarentena de 30 dias e CMT de entrada criados no calendário.'
                  : 'Quarentena de 30 dias criada no calendário.'
            }
          />
        </>
      )}

      <TituloSecao icone="badge">
        {ehNascimento ? 'Ficha de nascimento' : 'Identificação'}
      </TituloSecao>
      <Cartao>
        <Campo rotulo="Número ou brinco *" valor={brinco} aoMudar={setBrinco} placeholder="Ex.: 238" />
        <Campo rotulo="Nome" valor={nome} aoMudar={setNome} />
        <Txt v="caption">
          Preencha os dados que souber. Datas: DD/MM/AAAA. Valores: use vírgula ou ponto decimal,
          sem separador de milhar.
        </Txt>

        <Txt v="caption" cor={c.textoSecundario}>
          Sexo
        </Txt>
        <Linha gap={espaco.sm} style={{ marginTop: 4, marginBottom: espaco.md }}>
          <Chip texto="Fêmea" ativo={sexo === 'F'} aoTocar={() => { setSexo('F'); if (['touro', 'novilho', 'boi_carro'].includes(categoria)) setCategoria('bezerro_mamando'); }} />
          <Chip texto="Macho" ativo={sexo === 'M'} aoTocar={() => { setSexo('M'); if (['vaca_lactacao', 'vaca_seca', 'novilha', 'bezerra_1_2_anos'].includes(categoria)) setCategoria('bezerro_mamando'); }} />
        </Linha>

        {campoCadastro('raca', 'Raça ou cruzamento')}
        <Campo rotulo="Pelagem e sinais particulares" valor={pelagem} aoMudar={setPelagem} />
        {campoCadastro('nascimento', ehNascimento ? 'Data de nascimento *' : 'Data de nascimento', false, 'DD/MM/AAAA')}
        {!ehNascimento && !cadastro.nascimento.trim() && campoCadastro('idade', 'Idade estimada (meses)', true)}
        {cadastro.idade.trim().length > 0 && !cadastro.nascimento && <Txt v="caption">Estimativa em {animal?.idade_estimada_em && String(animal.idade_estimada_meses) === cadastro.idade ? formatarBR(animal.idade_estimada_em) : formatarBR(hoje())}. Não será tratada como idade exata na anamnese.</Txt>}
        {campoCadastro('mae', 'Nome ou número da mãe')}
        <Campo rotulo="Nome ou número do pai" valor={pai} aoMudar={setPai} />
        <Campo rotulo="Peso ao nascer (kg), se conhecido" valor={peso} aoMudar={setPeso} teclado="numeric" />
        {!ehNascimento && <>
          <Txt v="caption">Categoria</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm, marginBottom: espaco.md }}>
            {(Object.keys(ROTULO_CATEGORIA) as CategoriaAnimal[]).filter((cat) => sexo === 'F'
              ? !['touro', 'novilho', 'boi_carro'].includes(cat)
              : !['vaca_lactacao', 'vaca_seca', 'novilha', 'bezerra_1_2_anos'].includes(cat)).map((cat) => (
              <Chip key={cat} texto={ROTULO_CATEGORIA[cat]} ativo={categoria === cat} aoTocar={() => setCategoria(cat)} />
            ))}
          </View>
        </>}
      </Cartao>

      <TituloSecao icone="move-to-inbox">{ehNascimento ? 'Registro na propriedade' : 'Entrada no rebanho'}</TituloSecao>
      <Cartao>
        {campoCadastro('entrada', 'Data de entrada *', false, 'DD/MM/AAAA')}
        {!ehNascimento && <>
          <Txt v="caption">Origem</Txt>
          <Linha gap={espaco.sm} style={{ marginBottom: espaco.md }}>
            {(animal ? (['nascimento', 'compra', 'transferencia'] as const) : (['compra', 'transferencia'] as const)).map((opcao) => <Chip key={opcao} texto={ROTULO_ORIGEM[opcao]} ativo={origem === opcao} aoTocar={() => setOrigem(opcao)} />)}
          </Linha>
          {campoCadastro('pesoEntrada', 'Peso na entrada (kg)', true)}
          {campoCadastro('procedencia', 'Propriedade de origem / vendedor')}
          {campoCadastro('valor', 'Valor de aquisição (R$)', true)}
          {campoCadastro('gta', 'Número da GTA')}
          {campoCadastro('historico', 'Histórico sanitário, vacinas e exames')}
        </>}
      </Cartao>
      {!ehNascimento && reproduz && <>
        <TituloSecao icone="child-care">Reprodução — informações na entrada</TituloSecao>
        <Cartao>
          <Txt v="caption">Situação reprodutiva informada</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm, marginBottom: espaco.md }}>
            {Object.entries(ROTULO_REPRODUCAO).map(([valor, rotulo]) => <Chip key={valor} texto={rotulo} ativo={(cadastro.reproducao || 'nao_informada') === valor} aoTocar={() => mudar('reproducao', valor === 'nao_informada' ? '' : valor)} />)}
          </View>
          {campoCadastro('parto', 'Data do último parto', false, 'DD/MM/AAAA')}
          {campoCadastro('lactacoes', 'Número de lactações', true)}
          <Txt v="caption">O histórico de partos e coberturas registrados na propriedade tem prioridade sobre os dados de entrada.</Txt>
        </Cartao>
      </>}
      <TituloSecao icone="description">Observações</TituloSecao>
      <Cartao>
        <Campo
          rotulo="Observações"
          valor={observacoes}
          aoMudar={setObservacoes}
          placeholder={ehNascimento ? 'Ex.: parto normal' : 'Ex.: procedência, GTA'}
        />
      </Cartao>

      {!animal && <>
        <TituloSecao icone="checklist">Checklist obrigatório</TituloSecao>
        <Cartao>
          {checklist.map((item) => {
            const marcado = feitos.has(item);
            return (
              <Pressable
                key={item}
                onPress={() =>
                  setFeitos((s) => {
                    const n = new Set(s);
                    if (n.has(item)) n.delete(item);
                    else n.add(item);
                    return n;
                  })
                }
              >
                <Linha centro={false} gap={espaco.sm} style={{ minHeight: 40 }}>
                  <MaterialIcons
                    name={marcado ? 'check-box' : 'check-box-outline-blank'}
                    size={24}
                    color={marcado ? c.ok : c.textoSecundario}
                  />
                  <Txt v="label" style={{ flex: 1 }} cor={marcado ? c.textoSecundario : c.texto}>
                    {item}
                  </Txt>
                </Linha>
              </Pressable>
            );
          })}
          <Separador />
          <Txt v="caption" cor={c.textoSecundario}>
            {feitos.size} de {checklist.length} concluídos.
            {ehNascimento
              ? ' Sem colostro suficiente nas primeiras horas, a bezerra fica sem defesa — o Dr. Moo passa a tratá-la como animal de alto risco.'
              : ' A quarentena evita que um animal comprado traga mastite contagiosa para o rebanho.'}
          </Txt>
        </Cartao>

      </>}
      <Espaco h={espaco.lg} />
      <Botao
        grande
        titulo={salvo ? 'Salvo' : animal ? 'Salvar alterações' : 'Registrar animal'}
        icone={salvo ? 'check' : 'save'}
        desabilitado={!brinco.trim() || salvo || salvando}
        aoTocar={salvar}
      />
      <Espaco h={espaco.sm} />
      <Linha gap={espaco.sm}>
        <Botao titulo="Voltar" variante="secundario" style={{ flex: 1 }} aoTocar={aoVoltar} />
        <Botao
          titulo="Ver rebanho"
          variante="secundario"
          style={{ flex: 1 }}
          aoTocar={() => router.replace('/rebanho')}
        />
      </Linha>
    </Tela>
  );
}

// A identidade do componente deve permanecer estável para preservar o foco ao digitar.
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
  const variasLinhas = rotulo.startsWith('Observações') || rotulo.startsWith('Histórico');
  // Chrome pode ignorar autocomplete="off" em inputs classificados como cartão.
  // Na web, uma textarea de uma linha evita essa classificação dos dados do animal.
  const usarTextArea = Platform.OS === 'web' || variasLinhas;

  return (
    <View style={{ marginBottom: espaco.md }}>
      <Txt v="caption" cor={c.textoSecundario}>
        {rotulo}
      </Txt>
      <TextInput
        autoComplete="off"
        importantForAutofill="no"
        textContentType="none"
        accessibilityLabel={rotulo}
        multiline={usarTextArea}
        numberOfLines={variasLinhas ? 3 : 1}
        value={valor}
        onChangeText={(texto) => aoMudar(variasLinhas ? texto : texto.replace(/[\r\n]+/g, ' '))}
        onKeyPress={(evento) => {
          if (Platform.OS === 'web' && !variasLinhas && evento.nativeEvent.key === 'Enter') {
            evento.preventDefault();
          }
        }}
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

function lerNumero(valor: string): number | null {
  if (!valor.trim()) return null;
  const texto = valor.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(texto)) throw new Error('Informe valores numéricos válidos, sem separador de milhar.');
  return Number(texto);
}

function lerData(valor: string): string | null {
  if (!valor.trim()) return null;
  const texto = valor.trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  throw new Error('Informe as datas no formato DD/MM/AAAA.');
}
