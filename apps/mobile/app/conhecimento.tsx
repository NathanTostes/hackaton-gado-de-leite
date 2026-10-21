/**
 * Tela "Base de Conhecimento".
 *
 * É a prova visível de que o Dr. Moo não é uma caixa-preta: todas as regras de
 * produção em linguagem natural, com a fonte citada e o status de validação, e
 * os casos de teste rodando ao vivo diante de quem estiver olhando.
 */
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { ENGINE_VERSAO, regraEmLinguagemNatural, type Regra } from '@drmoo/engine';
import {
  baseCompilada,
  baseDeConhecimento,
  casos,
  executarCasos,
  regrasPorGrupo,
  rotulos,
} from '@drmoo/knowledge';
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
  Vazio,
} from '../src/componentes/base';
import { useTema } from '../src/tema';

const ROTULO_GRUPO: Record<string, string> = {
  triagem: 'Triagem geral',
  mastite: 'Mastite',
  metabolicas: 'Metabólicas',
  pos_parto: 'Pós-parto / reprodutivas',
  digestivas: 'Digestivas',
  locomotor: 'Locomotor',
  parasitarias: 'Parasitárias e infecciosas',
  notificacao_obrigatoria: 'Notificação obrigatória',
  emergencia: 'Emergências',
  bezerras: 'Bezerras',
  rebanho: 'Indicadores de rebanho',
};

export default function BaseDeConhecimento() {
  const { c, espaco } = useTema();
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ReturnType<typeof executarCasos> | null>(null);
  const [rodando, setRodando] = useState(false);

  const grupos = useMemo(() => [...regrasPorGrupo().keys()], []);

  const regrasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return baseDeConhecimento.regras.filter((r) => {
      if (grupo && r.grupo !== grupo) return false;
      if (!termo) return true;
      return (
        r.id.toLowerCase().includes(termo) ||
        r.titulo.toLowerCase().includes(termo) ||
        r.porque.toLowerCase().includes(termo) ||
        JSON.stringify(r.se).toLowerCase().includes(termo)
      );
    });
  }, [busca, grupo]);

  const validadas = baseDeConhecimento.regras.filter((r) => r.status === 'validada').length;

  const rodarCasos = () => {
    setRodando(true);
    // setTimeout dá um quadro para a UI mostrar o estado antes de bloquear.
    setTimeout(() => {
      setResultados(executarCasos(baseCompilada));
      setRodando(false);
    }, 16);
  };

  const passaram = resultados?.filter((r) => r.passou).length ?? 0;

  return (
    <Tela>
      <Cartao>
        <Txt v="h2">Base de conhecimento v{baseDeConhecimento.versao}</Txt>
        <Espaco h={espaco.sm} />
        <Linha gap={6} style={{ flexWrap: 'wrap' }}>
          <Chip texto={`${baseDeConhecimento.regras.length} regras`} icone="rule" />
          <Chip texto={`${validadas} validadas`} cor={c.ok} icone="verified" />
          <Chip
            texto={`${baseDeConhecimento.regras.length - validadas} a revisar`}
            cor={c.atencao}
            icone="pending"
          />
          <Chip texto={`${baseDeConhecimento.perguntas.length} perguntas`} icone="help-outline" />
          <Chip texto={`motor v${ENGINE_VERSAO}`} icone="settings" />
        </Linha>
        <Espaco h={espaco.md} />
        <Txt v="caption" cor={c.textoSecundario}>
          {baseDeConhecimento.changelog[0]?.notas}
        </Txt>
      </Cartao>

      {/* ------------------- Casos de teste ------------------- */}
      <TituloSecao icone="science">Casos de teste</TituloSecao>
      <Cartao>
        <Txt v="label" cor={c.textoSecundario}>
          {casos.length} casos com resultado esperado, definidos junto com o conhecimento
          do domínio. Rodam contra a versão atual da base, aqui mesmo.
        </Txt>
        <Espaco h={espaco.md} />
        <Botao
          grande
          titulo={rodando ? 'Rodando…' : `Rodar os ${casos.length} casos`}
          icone="play-arrow"
          desabilitado={rodando}
          aoTocar={rodarCasos}
        />

        {resultados && (
          <>
            <Espaco h={espaco.md} />
            <Alerta
              tipo={passaram === resultados.length ? 'ok' : 'alerta'}
              titulo={`${passaram} de ${resultados.length} casos passaram`}
              texto={
                passaram === resultados.length
                  ? 'A base atual reproduz todos os resultados esperados.'
                  : 'Há divergências — veja abaixo.'
              }
            />
            <Espaco h={espaco.sm} />
            {resultados.map((r) => (
              <View key={r.caso.id} style={{ marginBottom: espaco.sm }}>
                <Linha gap={6} centro={false}>
                  <MaterialIcons
                    name={r.passou ? 'check-circle' : 'cancel'}
                    size={18}
                    color={r.passou ? c.ok : c.alerta}
                  />
                  <View style={{ flex: 1 }}>
                    <Txt v="label">
                      {r.caso.id} — {r.caso.descricao}
                    </Txt>
                    <Txt v="caption" cor={c.textoSecundario}>
                      {r.obtido.diagnosticoPrincipal
                        ? `${r.obtido.diagnosticoPrincipal} (CF ${r.obtido.cf?.toFixed(2)})`
                        : 'nenhuma conclusão'}
                      {' · '}
                      {r.obtido.regrasDisparadas.length} regra(s)
                    </Txt>
                    {!r.passou && (
                      <Txt v="caption" cor={c.alerta}>
                        {r.falhas.join(' | ')}
                      </Txt>
                    )}
                  </View>
                </Linha>
              </View>
            ))}
          </>
        )}
      </Cartao>

      {/* ------------------- Regras ------------------- */}
      <TituloSecao icone="rule">Regras de produção</TituloSecao>

      <Linha
        style={{
          borderWidth: 1,
          borderColor: c.borda,
          borderRadius: 8,
          paddingHorizontal: espaco.md,
          backgroundColor: c.superficieAlt,
        }}
      >
        <MaterialIcons name="search" size={20} color={c.textoSecundario} />
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por regra, variável ou texto"
          placeholderTextColor={c.textoSecundario}
          style={{
            flex: 1,
            minHeight: 48,
            color: c.texto,
            fontFamily: 'Inter_400Regular',
            fontSize: 16,
          }}
        />
      </Linha>

      <Espaco h={espaco.sm} />
      <Linha gap={6} style={{ flexWrap: 'wrap' }}>
        <Chip texto="Todos" ativo={grupo === null} aoTocar={() => setGrupo(null)} />
        {grupos.map((g) => (
          <Chip
            key={g}
            texto={ROTULO_GRUPO[g] ?? g}
            ativo={grupo === g}
            aoTocar={() => setGrupo(g === grupo ? null : g)}
          />
        ))}
      </Linha>

      <Espaco h={espaco.md} />
      {regrasFiltradas.length === 0 ? (
        <Vazio icone="search-off" titulo="Nenhuma regra encontrada" />
      ) : (
        <View style={{ gap: espaco.sm }}>
          {regrasFiltradas.map((r) => (
            <CartaoRegra key={r.id} regra={r} />
          ))}
        </View>
      )}
    </Tela>
  );
}

function CartaoRegra({ regra }: { regra: Regra }) {
  const { c, espaco } = useTema();
  const [aberto, setAberto] = useState(false);
  const validada = regra.status === 'validada';

  return (
    <Cartao destaque={validada ? c.ok : c.atencao} aoTocar={() => setAberto((v) => !v)}>
      <Linha entre>
        <View style={{ flex: 1 }}>
          <Txt v="corpoForte">{regra.titulo}</Txt>
          <Txt v="caption" cor={c.textoSecundario}>
            {regra.id} · prioridade {regra.prioridade}
          </Txt>
        </View>
        <Chip
          texto={validada ? 'Validada' : 'A revisar'}
          cor={validada ? c.ok : c.atencao}
          icone={validada ? 'verified' : 'pending'}
        />
      </Linha>

      {aberto && (
        <>
          <Separador />
          <Txt v="caption" style={{ fontFamily: 'Inter_500Medium' }}>
            {regraEmLinguagemNatural(regra.se, regra.entao, rotulos)}
          </Txt>

          <Espaco h={espaco.md} />
          <Txt v="caption" cor={c.textoSecundario}>
            Por quê: {regra.porque}
          </Txt>

          {regra.conduta && regra.conduta.length > 0 && (
            <>
              <Espaco h={espaco.sm} />
              <Txt v="label">Conduta</Txt>
              {regra.conduta.map((item) => (
                <Txt key={item} v="caption" cor={c.textoSecundario}>
                  · {item}
                </Txt>
              ))}
            </>
          )}

          <Espaco h={espaco.sm} />
          <Linha gap={6} centro={false}>
            <MaterialIcons name="menu-book" size={14} color={c.textoSecundario} />
            <Txt v="caption" cor={c.textoSecundario} style={{ flex: 1, fontStyle: 'italic' }}>
              {regra.fonte}
            </Txt>
          </Linha>
        </>
      )}
    </Cartao>
  );
}
