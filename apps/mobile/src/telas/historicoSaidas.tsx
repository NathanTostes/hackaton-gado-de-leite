import { router } from 'expo-router';
import { View } from 'react-native';
import { historicoSaidas, type TipoSaida } from '@drmoo/db';
import { formatarBR, moeda } from '@drmoo/domain';
import { Alerta, Botao, CabecalhoPagina, Carregando, Cartao, Espaco, Tela, Txt, Vazio } from '../componentes/base';
import { useDados } from '../hooks';
import { useTema } from '../tema';

export function HistoricoSaidas({ tipo }: { tipo: TipoSaida }) {
  const morte = tipo === 'falecimento';
  const { espaco } = useTema();
  const { dados, carregando, erro } = useDados(() => historicoSaidas(tipo), [tipo]);
  return <Tela>
    <CabecalhoPagina titulo={morte ? 'Gado falecido' : 'Gado vendido'} subtitulo="Histórico de saídas do rebanho" />
    <Txt v="h2">{morte ? 'Histórico de falecimentos' : 'Histórico de vendas'}</Txt>
    <Espaco />
    {erro ? <Alerta tipo="alerta" titulo="Não foi possível carregar o histórico" texto={erro} />
      : carregando ? <Carregando />
      : !dados?.length ? <Vazio icone="history" titulo={morte ? 'Nenhum falecimento registrado' : 'Nenhuma venda registrada'} />
      : <View style={{ gap: espaco.md }}>{dados.map((registro) => <Cartao key={registro.id}>
        <Txt v="h3">{registro.nome ?? `Brinco ${registro.brinco}`}</Txt>
        <Txt>Brinco {registro.brinco}</Txt>
        <Txt>Data: {registro.data ? formatarBR(registro.data) : 'Não informada'}</Txt>
        {morte ? <>
          <Txt>Hora: {registro.hora ?? 'Não informada'}</Txt>
          <Txt>Causa: {registro.causa ?? 'Não informada'}</Txt>
        </> : <>
          <Txt>Valor: {registro.valor != null ? moeda(registro.valor) : 'Não informado'}</Txt>
          <Txt>Destinatário: {registro.destinatario ?? 'Não informado'}</Txt>
        </>}
        <Espaco />
        <Botao titulo="Ver ficha e prontuários" variante="secundario" aoTocar={() => router.push(`/animal/${registro.animal_id}`)} />
      </Cartao>)}</View>}
    <Espaco />
    <Botao titulo="Ver rebanho ativo" variante="secundario" aoTocar={() => router.replace('/rebanho')} />
  </Tela>;
}
