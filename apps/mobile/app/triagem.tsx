/**
 * Triagem de entrada: animal novo no rebanho e bezerra recém-nascida.
 * Os campos da ficha de nascimentos seguem exatamente a ficha da Embrapa (p. 22).
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { criarEvento, salvarAnimal } from '@drmoo/db';
import { hoje, somarDias } from '@drmoo/domain';
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

type Modo = 'escolha' | 'novo' | 'nascimento';

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

export default function Triagem() {
  const { c, espaco } = useTema();
  const [modo, setModo] = useState<Modo>('escolha');

  if (modo === 'escolha') {
    return (
      <Tela>
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

  return <Formulario modo={modo} aoVoltar={() => setModo('escolha')} />;
}

function Formulario({ modo, aoVoltar }: { modo: 'novo' | 'nascimento'; aoVoltar: () => void }) {
  const { c, espaco, raio } = useTema();
  const ehNascimento = modo === 'nascimento';

  const [brinco, setBrinco] = useState('');
  const [nome, setNome] = useState('');
  const [sexo, setSexo] = useState<'M' | 'F'>('F');
  const [peso, setPeso] = useState('');
  const [pelagem, setPelagem] = useState('');
  const [pai, setPai] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [feitos, setFeitos] = useState<Set<string>>(new Set());
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const checklist = ehNascimento ? CHECK_NEONATAL : CHECK_QUARENTENA;

  const salvar = async () => {
    if (!brinco.trim() || salvando) return;
    setSalvando(true);
    try {
      const hj = hoje();
      const id = await salvarAnimal({
        brinco: brinco.trim(),
        nome: nome.trim() || null,
        sexo,
        categoria: ehNascimento ? 'bezerro_mamando' : 'vaca_lactacao',
        data_nascimento: ehNascimento ? hj : null,
        peso_nascimento: peso ? Number(peso) : null,
        pelagem_sinal: pelagem.trim() || null,
        pai_nome: pai.trim() || null,
        origem: ehNascimento ? 'nascimento' : 'compra',
        data_entrada: hj,
        status: ehNascimento ? 'saudavel' : 'quarentena',
        observacoes: observacoes.trim() || null,
      });

      if (ehNascimento) {
        await criarEvento({
          tipo: 'consulta',
          animalId: id,
          titulo: `Conferir colostragem — bezerra ${brinco}`,
          descricao: 'Verificar se recebeu colostro de boa qualidade nas primeiras 6 horas.',
          data: hj,
          origem: 'regra',
        });
        await criarEvento({
          tipo: 'desmame',
          animalId: id,
          titulo: `Desmame previsto — ${brinco}`,
          data: somarDias(hj, 60),
          origem: 'automatico',
        });
      } else {
        await criarEvento({
          tipo: 'quarentena',
          animalId: id,
          titulo: `Fim da quarentena — ${brinco}`,
          descricao: 'Liberar para o rebanho após exames e CMT negativos.',
          data: somarDias(hj, 30),
          origem: 'regra',
        });
        await criarEvento({
          tipo: 'exame_cmt',
          animalId: id,
          titulo: `CMT antes de entrar na ordenha — ${brinco}`,
          data: somarDias(hj, 28),
          origem: 'regra',
        });
      }

      setSalvo(true);
    } finally {
      setSalvando(false);
    }
  };

  const Campo = ({
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
  }) => (
    <View style={{ marginBottom: espaco.md }}>
      <Txt v="caption" cor={c.textoSecundario}>
        {rotulo}
      </Txt>
      <TextInput
        value={valor}
        onChangeText={aoMudar}
        keyboardType={teclado}
        placeholder={placeholder}
        placeholderTextColor={c.textoSecundario}
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
    </View>
  );

  return (
    <Tela>
      <Txt v="h2">{ehNascimento ? 'Nova bezerra(o)' : 'Animal novo no rebanho'}</Txt>

      {salvo && (
        <>
          <Espaco h={espaco.md} />
          <Alerta
            tipo="ok"
            titulo="Animal registrado"
            texto={
              ehNascimento
                ? 'Eventos de colostragem e desmame criados no calendário.'
                : 'Quarentena de 30 dias e CMT de entrada criados no calendário.'
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

        <Txt v="caption" cor={c.textoSecundario}>
          Sexo
        </Txt>
        <Linha gap={espaco.sm} style={{ marginTop: 4, marginBottom: espaco.md }}>
          <Chip texto="Fêmea" ativo={sexo === 'F'} aoTocar={() => setSexo('F')} />
          <Chip texto="Macho" ativo={sexo === 'M'} aoTocar={() => setSexo('M')} />
        </Linha>

        {ehNascimento && (
          <>
            <Campo rotulo="Peso ao nascer (kg)" valor={peso} aoMudar={setPeso} teclado="numeric" />
            <Campo
              rotulo="Pelagem e sinal"
              valor={pelagem}
              aoMudar={setPelagem}
              placeholder="Ex.: P e B com mancha preta na barriga"
            />
            <Campo rotulo="Nome ou número do pai" valor={pai} aoMudar={setPai} />
          </>
        )}

        <Campo
          rotulo="Observações"
          valor={observacoes}
          aoMudar={setObservacoes}
          placeholder={ehNascimento ? 'Ex.: parto normal' : 'Ex.: procedência, GTA'}
        />
      </Cartao>

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

      <Espaco h={espaco.lg} />
      <Botao
        grande
        titulo={salvo ? 'Registrado' : 'Registrar animal'}
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
