import { createElement, useState, type ChangeEvent } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Platform, TextInput, View } from 'react-native';
import { obterAnimal, registrarSaida } from '@drmoo/db';
import { hoje } from '@drmoo/domain';
import { Alerta, Botao, Carregando, Cartao, Espaco, Tela, Txt, Vazio } from '../../src/componentes/base';
import { CampoData } from '../../src/componentes/campoData';
import { useCampoFormulario, useFormulario } from '../../src/componentes/validacaoFormulario';
import { validarCampos } from '../../src/componentes/validarCampos';
import { useDados } from '../../src/hooks';
import { useTema } from '../../src/tema';

export default function RegistrarSaida() {
  const { id, tipo } = useLocalSearchParams<{ id: string; tipo: string }>();
  const morte = tipo === 'falecimento';
  const { dados: animal, carregando, erro: erroCarga } = useDados(() => obterAnimal(id), [id]);
  const formulario = useFormulario();
  const [data, setData] = useState(hoje());
  const [hora, setHora] = useState(() => {
    const agora = new Date();
    return `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
  });
  const [causa, setCausa] = useState('');
  const [valor, setValor] = useState('');
  const [destinatario, setDestinatario] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  if (erroCarga) return <Tela><Alerta tipo="alerta" titulo="Não foi possível carregar o animal" texto={erroCarga} /></Tela>;
  if (carregando) return <Carregando />;
  if (!animal) return <Vazio icone="error-outline" titulo="Animal não encontrado" />;
  if (!['falecimento', 'venda'].includes(tipo)) return <Vazio icone="error-outline" titulo="Tipo de saída inválido" />;
  if (['morto', 'vendido', 'descartado'].includes(animal.status)) return <Tela>
    <Alerta tipo="info" titulo="Este animal já saiu do rebanho" />
    <Botao titulo="Voltar à ficha" aoTocar={() => router.replace(`/animal/${id}`)} />
  </Tela>;

  const salvar = async () => {
    if (salvando) return;
    const erros = validarCampos([
      { rotulo: 'Data', valor: data, tipo: 'data', obrigatorio: true },
      ...(morte ? [{ rotulo: 'Causa do falecimento', valor: causa, obrigatorio: true }] : [
        { rotulo: 'Valor da venda (R$)', valor, tipo: 'numero' as const, obrigatorio: true, positivo: true },
        { rotulo: 'Destinatário', valor: destinatario, obrigatorio: true },
      ]),
    ]);
    if (morte && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) erros.Hora = 'Informe uma hora válida (HH:mm).';
    if (formulario.mostrarErros(erros)) { setErro('Corrija os campos destacados.'); return; }
    setErro(''); setSalvando(true);
    try {
      await registrarSaida(morte
        ? { tipo: 'falecimento', animalId: id, data, hora, causa }
        : { tipo: 'venda', animalId: id, data, valor: Number(valor.replace(',', '.')), destinatario });
      router.replace(`/animal/${id}`);
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : 'Não foi possível registrar a saída.';
      setErro(mensagem);
      if (mensagem.toLowerCase().includes('hora')) formulario.mostrarErros({ Hora: mensagem });
      else if (mensagem.includes('anterior')) formulario.mostrarErros({ Data: mensagem });
      else formulario.scroll.current?.scrollTo({ y: 0, animated: true });
    } finally { setSalvando(false); }
  };
  return <Tela formulario={formulario}>
    <Txt v="h1">{morte ? 'Registrar falecimento' : 'Registrar venda'}</Txt>
    <Txt>{animal.nome ?? `Brinco ${animal.brinco}`} · Brinco {animal.brinco}</Txt>
    <Espaco />
    <Alerta tipo="info" titulo="O histórico do animal será preservado" texto={morte
      ? 'O animal sairá da lista ativa e ficará disponível no histórico de falecidos.'
      : 'O animal sairá da lista ativa. A venda será registrada no histórico e como receita no financeiro.'} />
    <Espaco />
    {!!erro && <Alerta tipo="alerta" titulo="Confira os dados" texto={erro} />}
    <Cartao>
      <CampoData rotulo="Data" valor={data} aoMudar={setData} obrigatorio />
      {morte ? <>
        <Campo rotulo="Hora" valor={hora} aoMudar={setHora} tipo="hora" />
        <Campo rotulo="Causa do falecimento" valor={causa} aoMudar={setCausa} />
      </> : <>
        <Campo rotulo="Valor da venda (R$)" valor={valor} aoMudar={setValor} tipo="numero" />
        <Campo rotulo="Destinatário" valor={destinatario} aoMudar={setDestinatario} />
      </>}
    </Cartao>
    <Espaco />
    <Botao grande titulo={salvando ? 'Salvando…' : morte ? 'Registrar falecimento' : 'Registrar venda'}
      variante={morte ? 'perigo' : 'primario'} desabilitado={salvando} aoTocar={salvar} />
    <Espaco />
    <Botao titulo="Cancelar" variante="secundario" desabilitado={salvando} aoTocar={() => router.back()} />
  </Tela>;
}

function Campo({ rotulo, valor, aoMudar, tipo = 'texto' }: {
  rotulo: string; valor: string; aoMudar: (valor: string) => void; tipo?: 'texto' | 'numero' | 'hora';
}) {
  const { c, espaco, raio } = useTema();
  const campo = useCampoFormulario(rotulo);
  const mudar = (texto: string) => { campo.limpar(); aoMudar(texto); };
  return <View ref={campo.ref} collapsable={false} style={{ marginBottom: espaco.md }}>
    <Txt v="caption" cor={c.textoSecundario}>{rotulo}</Txt>
    {tipo === 'hora' && Platform.OS === 'web' ? createElement('input', {
      type: 'time', value: valor, required: true, 'aria-label': rotulo, 'aria-invalid': !!campo.erro,
      onChange: (e: ChangeEvent<HTMLInputElement>) => mudar(e.target.value),
      style: { boxSizing: 'border-box', width: '100%', minHeight: 48, border: `1px solid ${campo.erro ? c.alerta : c.borda}`,
        borderRadius: raio.input, padding: 12, backgroundColor: c.superficieAlt, color: c.texto, fontSize: 16 },
    }) : <TextInput value={valor} onChangeText={(texto) => {
      if (tipo !== 'hora') { mudar(texto); return; }
      const digitos = texto.replace(/\D/g, '').slice(0, 4);
      mudar(digitos.length > 2 ? `${digitos.slice(0, 2)}:${digitos.slice(2)}` : digitos);
    }} accessibilityLabel={rotulo} accessibilityHint={campo.erro} aria-invalid={!!campo.erro}
      keyboardType={tipo === 'texto' ? 'default' : 'numeric'} autoComplete="off" importantForAutofill="no"
      placeholder={tipo === 'hora' ? 'HH:mm' : undefined}
      style={{ minHeight: 48, borderWidth: 1, borderColor: campo.erro ? c.alerta : c.borda, borderRadius: raio.input,
        paddingHorizontal: espaco.md, marginTop: 4, backgroundColor: c.superficieAlt, color: c.texto, fontSize: 16 }} />}
    {!!campo.erro && <Txt v="caption" cor={c.alerta}>{campo.erro}</Txt>}
  </View>;
}
