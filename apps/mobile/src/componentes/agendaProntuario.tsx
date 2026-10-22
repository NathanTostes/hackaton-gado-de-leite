import { useState } from 'react';
import { TextInput, View } from 'react-native';
import type { Parecer } from '@drmoo/engine';
import { ROTULO_EVENTO, type TipoEvento } from '@drmoo/db';
import { itensDaAgenda, type AjustesAgenda } from '../agendaConsulta';
import { useTema } from '../tema';
import { Botao, Cartao, Chip, Espaco, Linha, Txt } from './base';
import { CampoData } from './campoData';

const TIPOS: TipoEvento[] = ['vacinacao', 'medicacao', 'consulta', 'exame_cmt', 'exame_ccs', 'reavaliacao', 'manejo'];

export function AgendaProntuario({ parecer, feitas = [], ajustes, aoMudar, dataAtendimento, aoMudarData, bloqueado = false }: {
  parecer: Parecer; feitas?: string[]; ajustes: AjustesAgenda; aoMudar: (ajustes: AjustesAgenda) => void;
  dataAtendimento: string; aoMudarData: (data: string) => void; bloqueado?: boolean;
}) {
  const { c, espaco, raio } = useTema();
  const [expandido, setExpandido] = useState(false);
  const [novo, setNovo] = useState('');
  const [tipoNovo, setTipoNovo] = useState<TipoEvento>('vacinacao');
  const itens = itensDaAgenda(parecer, feitas, ajustes);
  const alterar = (titulo: string, valor: object) => { if (!bloqueado) aoMudar({ ...ajustes, [titulo]: { ...ajustes[titulo], ...valor } }); };
  return <View style={{ opacity: bloqueado ? 0.6 : 1 }}>
    <Espaco />
    <Txt v="h2">Datas e compromissos do prontuário</Txt>
    <Espaco />
    <CampoData rotulo="Data do atendimento" valor={dataAtendimento} aoMudar={aoMudarData} desabilitado={bloqueado} obrigatorio />
    <Txt v="caption">As ações pendentes abaixo serão incluídas no calendário ao salvar. Escolha as datas ou desmarque o que não deseja agendar. As ações já concluídas não são agendadas.</Txt>
    <Espaco />
    <View style={{ gap: espaco.md }}>
      {(expandido ? itens : itens.slice(0, 3)).map((item) => <Cartao key={item.titulo}>
        <Txt v="corpoForte">{item.titulo}</Txt>
        <Chip texto={item.agendar ? 'Agendar no calendário' : 'Não agendar'} icone={item.agendar ? 'check-box' : 'check-box-outline-blank'}
          ativo={item.agendar} aoTocar={() => alterar(item.titulo, { agendar: !item.agendar })} />
        {item.agendar && <>
          <CampoData rotulo={`Data — ${item.titulo}`} valor={item.data} aoMudar={(data) => alterar(item.titulo, { data })} permitirFuturas desabilitado={bloqueado} obrigatorio />
          <Linha style={{ flexWrap: 'wrap' }}>{TIPOS.map((tipo) => <Chip key={tipo} texto={ROTULO_EVENTO[tipo]} ativo={item.tipo === tipo}
            aoTocar={() => alterar(item.titulo, { tipo })} />)}</Linha>
        </>}
      </Cartao>)}
    </View>
    {itens.length > 3 && <Botao titulo={expandido ? 'Ver menos' : `Ver mais (${itens.length - 3})`}
      variante="texto" aoTocar={() => setExpandido((v) => !v)} />}
    <Espaco />
    {!bloqueado && <Cartao>
      <Txt v="corpoForte">Adicionar vacina, medicamento ou outro compromisso</Txt>
      <Txt v="caption">Registre o que já foi orientado para o animal. O agendamento não registra uma aplicação ou um tratamento realizado.</Txt>
      <TextInput accessibilityLabel="Nome do compromisso" value={novo} onChangeText={setNovo} autoComplete="off"
        placeholder="Nome da vacina, medicamento ou atividade" placeholderTextColor={c.textoSecundario}
        style={{ minHeight: 48, borderWidth: 1, borderColor: c.borda, borderRadius: raio.input, padding: espaco.sm,
          marginVertical: espaco.sm, color: c.texto, backgroundColor: c.superficieAlt, fontSize: 16 }} />
      <Linha style={{ flexWrap: 'wrap' }}>{TIPOS.map((tipo) => <Chip key={tipo} texto={ROTULO_EVENTO[tipo]} ativo={tipoNovo === tipo}
        aoTocar={() => setTipoNovo(tipo)} />)}</Linha>
      <Espaco />
      <Botao titulo="Adicionar compromisso" variante="secundario" desabilitado={!novo.trim()} aoTocar={() => {
        alterar(novo.trim(), { extra: true, agendar: true, tipo: tipoNovo }); setNovo(''); setExpandido(true);
      }} />
    </Cartao>}
  </View>;
}
