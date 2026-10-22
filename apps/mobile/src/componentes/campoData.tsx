import { createElement, useId, useState, type ChangeEvent } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { formatarBR, hoje } from '@drmoo/domain';
import { useTema } from '../tema';
import { Botao, Linha, Txt } from './base';
import { dataCadastro } from './validarCampos';
import { useCampoFormulario } from './validacaoFormulario';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Datas de calendário em ISO, sem conversão para UTC ou dependência de rede. */
export function CampoData({ rotulo, valor, aoMudar, obrigatorio = false, permitirFuturas = false }: {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  obrigatorio?: boolean;
  permitirFuturas?: boolean;
}) {
  const { c, espaco, raio } = useTema();
  const campo = useCampoFormulario(rotulo);
  const erroId = useId();
  const data = dataCadastro(valor);
  const limite = permitirFuturas ? '9999-12-31' : hoje();
  const [aberto, setAberto] = useState(false);
  const [mes, setMes] = useState(() => (data || hoje()).slice(0, 7));
  const [ano, numeroMes] = mes.split('-').map(Number) as [number, number];
  const primeiroDia = new Date(ano, numeroMes - 1, 1).getDay();
  const dias = new Date(ano, numeroMes, 0).getDate();
  const selecionar = (nova: string) => {
    campo.limpar();
    aoMudar(nova);
    setAberto(false);
  };
  const navegar = (meses: number) => {
    const proximo = new Date(ano, numeroMes - 1 + meses, 1);
    const destino = `${proximo.getFullYear()}-${String(proximo.getMonth() + 1).padStart(2, '0')}`;
    setMes(destino <= limite.slice(0, 7) ? destino : limite.slice(0, 7));
  };
  const borda = campo.erro ? c.alerta : c.borda;

  return (
    <View ref={campo.ref} collapsable={false} style={{ marginBottom: espaco.md }}>
      <Txt v="caption" cor={c.textoSecundario}>{rotulo}</Txt>
      {Platform.OS === 'web' ? createElement('input', {
        type: 'date', value: data, max: limite, required: obrigatorio,
        autoComplete: 'off', 'aria-label': rotulo, 'aria-invalid': !!campo.erro,
        'aria-describedby': campo.erro ? erroId : undefined,
        onChange: (evento: ChangeEvent<HTMLInputElement>) => selecionar(evento.target.value),
        style: { display: 'block', boxSizing: 'border-box', width: '100%', minWidth: 0,
          minHeight: 48, border: `1px solid ${borda}`, borderRadius: raio.input,
          padding: '10px 12px', marginTop: 4, backgroundColor: c.superficieAlt,
          color: c.texto, fontFamily: 'Inter_400Regular, sans-serif', fontSize: 16 },
      }) : (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel={rotulo}
            accessibilityHint={campo.erro ?? 'Abre o calendário para selecionar a data'}
            onPress={() => { setMes((data || hoje()).slice(0, 7)); setAberto(true); }}
            style={{ minHeight: 48, borderWidth: 1, borderColor: borda, borderRadius: raio.input,
              padding: espaco.md, marginTop: 4, backgroundColor: c.superficieAlt }}>
            <Txt cor={data ? c.texto : c.textoSecundario}>{data ? formatarBR(data) : 'Selecionar data'}</Txt>
          </Pressable>
          {aberto && <Modal transparent animationType="fade" onRequestClose={() => setAberto(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: espaco.md }}>
              <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 400, alignSelf: 'center',
                backgroundColor: c.superficie, borderRadius: raio.card, padding: espaco.md }}>
                <Txt v="h2">{rotulo}</Txt>
                <Linha entre style={{ marginTop: espaco.sm }}>
                  <Botao titulo="Ano anterior" variante="texto" style={{ flex: 1, paddingHorizontal: 4 }} aoTocar={() => navegar(-12)} />
                  <Botao titulo="Próximo ano" variante="texto" style={{ flex: 1, paddingHorizontal: 4 }} desabilitado={ano >= Number(limite.slice(0, 4))} aoTocar={() => navegar(12)} />
                </Linha>
                <Linha entre>
                  <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" onPress={() => navegar(-1)}
                    style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.borda, borderRadius: raio.input }}><Txt>‹</Txt></Pressable>
                  <Txt v="corpoForte">{MESES[numeroMes - 1]} {ano}</Txt>
                  <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" disabled={mes >= limite.slice(0, 7)}
                    accessibilityState={{ disabled: mes >= limite.slice(0, 7) }} onPress={() => navegar(1)}
                    style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.borda, borderRadius: raio.input, opacity: mes >= limite.slice(0, 7) ? 0.45 : 1 }}><Txt>›</Txt></Pressable>
                </Linha>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: espaco.sm }}>
                  {SEMANA.map((dia) => <View key={dia} style={{ width: '14.285714%', alignItems: 'center' }}><Txt v="caption">{dia}</Txt></View>)}
                  {Array.from({ length: primeiroDia + dias }, (_, i) => {
                    const dia = i - primeiroDia + 1;
                    const iso = `${mes}-${String(dia).padStart(2, '0')}`;
                    if (dia < 1) return <View key={i} style={{ width: '14.285714%', height: 48 }} />;
                    return <Pressable key={i} accessibilityRole="button" accessibilityLabel={formatarBR(iso)}
                      accessibilityState={{ selected: iso === data, disabled: iso > limite }} disabled={iso > limite}
                      onPress={() => selecionar(iso)} style={{ width: '14.285714%', minHeight: 48, alignItems: 'center',
                        justifyContent: 'center', borderRadius: raio.input, backgroundColor: iso === data ? c.primaria : 'transparent',
                        opacity: iso > limite ? 0.35 : 1 }}>
                      <Txt cor={iso === data ? '#FFFFFF' : c.texto}>{dia}</Txt>
                    </Pressable>;
                  })}
                </View>
                <Linha entre>
                  <Botao titulo="Limpar" variante="texto" aoTocar={() => selecionar('')} />
                  <Botao titulo="Cancelar" variante="secundario" aoTocar={() => setAberto(false)} />
                </Linha>
              </View>
            </View>
          </Modal>}
        </>
      )}
      {!!campo.erro && <View nativeID={erroId}><Txt v="caption" cor={c.alerta}>{campo.erro}</Txt></View>}
    </View>
  );
}
