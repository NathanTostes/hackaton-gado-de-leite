import { useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { ROTULO_EVENTO, type EventoComAnimal } from '@drmoo/db';
import { formatarBR } from '@drmoo/domain';
import { Botao, Cartao, Txt, TituloSecao } from './base';
import { useTema } from '../tema';

export function CompromissosProntuario({ eventos }: { eventos: EventoComAnimal[] }) {
  const [expandido, setExpandido] = useState(false);
  const { espaco } = useTema();
  return <>
    <TituloSecao icone="event">Compromissos no calendário</TituloSecao>
    {!eventos.length ? <Txt v="caption">Nenhum compromisso foi agendado neste prontuário.</Txt>
      : <View style={{ gap: espaco.sm }}>{(expandido ? eventos : eventos.slice(0, 3)).map((evento) => <Cartao key={evento.id}>
        <Txt v="corpoForte">{evento.titulo}</Txt>
        <Txt v="caption">{ROTULO_EVENTO[evento.tipo]} · {formatarBR(evento.data)} · {evento.status === 'feito' ? 'Concluído' : 'Pendente'}</Txt>
      </Cartao>)}</View>}
    {eventos.length > 3 && <Botao titulo={expandido ? 'Ver menos' : `Ver mais (${eventos.length - 3})`}
      variante="texto" aoTocar={() => setExpandido((v) => !v)} />}
    <Botao titulo="Ver calendário" variante="secundario" aoTocar={() => router.push('/calendario')} />
  </>;
}
