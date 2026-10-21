/**
 * Apresentação do parecer e do traço de inferência.
 *
 * É aqui que o sistema "mostra o serviço": toda conclusão vem com fator de
 * certeza traduzido em palavras, conduta acionável, fonte citada e a cadeia
 * completa de regras que levou até ela (specsDrMoo.md §4.8).
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { explicarConclusao, type Hipotese, type NoExplicacao, type Parecer } from '@drmoo/engine';
import { rotulos } from '@drmoo/knowledge';
import {
  Alerta,
  Barra,
  Cartao,
  Chip,
  Espaco,
  Linha,
  MaterialIcons,
  Separador,
  Txt,
} from './base';
import { useTema } from '../tema';

export function CartaoHipotese({
  hipotese,
  principal,
  condutaMarcada,
  aoMarcarConduta,
}: {
  hipotese: Hipotese;
  principal?: boolean;
  condutaMarcada?: Set<string>;
  aoMarcarConduta?: (item: string) => void;
}) {
  const { c, espaco } = useTema();
  const cor = hipotese.bandeiraVermelha
    ? c.alerta
    : hipotese.cf >= 0.85
      ? c.alerta
      : hipotese.cf >= 0.6
        ? c.atencao
        : c.primaria;

  return (
    <Cartao destaque={principal ? cor : undefined}>
      <Linha entre>
        <Txt v={principal ? 'h2' : 'h3'} style={{ flex: 1 }}>
          {hipotese.rotulo}
        </Txt>
        <Chip texto={hipotese.confianca} cor={cor} ativo={principal} />
      </Linha>

      <Espaco h={6} />
      <Barra fracao={hipotese.cf} cor={cor} />
      <Txt v="caption" cor={c.textoSecundario} style={{ marginTop: 4 }}>
        Fator de certeza {hipotese.cf.toFixed(2).replace('.', ',')}
      </Txt>

      <Espaco h={espaco.sm} />
      <Txt v="label" cor={c.textoSecundario}>
        {hipotese.descricao}
      </Txt>

      {hipotese.status === 'revisar' && (
        <>
          <Espaco h={espaco.sm} />
          <Alerta
            tipo="atencao"
            icone="rule"
            titulo="Requer validação técnica"
            texto="Esta conclusão vem de regras formalizadas a partir de consenso veterinário geral, ainda não conferidas com fonte primária. Confirme com o médico-veterinário."
          />
        </>
      )}

      {hipotese.conduta.length > 0 && (
        <>
          <Separador />
          <Txt v="corpoForte">O que fazer</Txt>
          <Espaco h={6} />
          {hipotese.conduta.map((item) => {
            const marcado = condutaMarcada?.has(item) ?? false;
            return (
              <Linha
                key={item}
                centro={false}
                gap={espaco.sm}
                style={{ marginBottom: espaco.sm, minHeight: 32 }}
              >
                <Pressable onPress={aoMarcarConduta ? () => aoMarcarConduta(item) : undefined}>
                  <MaterialIcons
                    name={marcado ? 'check-box' : 'check-box-outline-blank'}
                    size={24}
                    color={marcado ? c.ok : c.textoSecundario}
                  />
                </Pressable>
                <Txt
                  v="label"
                  style={{ flex: 1, textDecorationLine: marcado ? 'line-through' : 'none' }}
                  cor={marcado ? c.textoSecundario : c.texto}
                >
                  {item}
                </Txt>
              </Linha>
            );
          })}
        </>
      )}

      {hipotese.fontes.length > 0 && (
        <>
          <Separador />
          <Linha centro={false} gap={6}>
            <MaterialIcons name="menu-book" size={16} color={c.textoSecundario} />
            <Txt v="caption" cor={c.textoSecundario} style={{ flex: 1 }}>
              {hipotese.fontes.join(' · ')}
            </Txt>
          </Linha>
        </>
      )}
    </Cartao>
  );
}

/** "Como você chegou nisso?" — a cadeia de regras, de trás para frente. */
export function ComoChegueiNisso({
  parecer,
  chave,
}: {
  parecer: Parecer;
  chave: string;
}) {
  const [aberto, setAberto] = useState(false);
  const { c, espaco } = useTema();

  if (!aberto) {
    return (
      <Pressable onPress={() => setAberto(true)}>
        <Linha gap={6} style={{ paddingVertical: espaco.sm }}>
          <MaterialIcons name="account-tree" size={20} color={c.primaria} />
          <Txt v="corpoForte" cor={c.primaria}>
            Como cheguei nisso?
          </Txt>
        </Linha>
      </Pressable>
    );
  }

  const arvore = explicarConclusao(parecer, chave);

  return (
    <Cartao>
      <Linha entre>
        <Txt v="h3">Como cheguei nisso</Txt>
        <Pressable onPress={() => setAberto(false)}>
          <MaterialIcons name="close" size={22} color={c.textoSecundario} />
        </Pressable>
      </Linha>
      <Espaco h={espaco.sm} />
      {arvore.length === 0 ? (
        <Txt v="label" cor={c.textoSecundario}>
          Nenhuma regra disparou para esta conclusão.
        </Txt>
      ) : (
        arvore.map((no, i) => <NoDaArvore key={i} no={no} nivel={0} />)
      )}
      <Espaco h={espaco.sm} />
      <Txt v="caption" cor={c.textoSecundario}>
        Base de conhecimento v{parecer.kbVersao} · motor v{parecer.engineVersao}
      </Txt>
    </Cartao>
  );
}

function NoDaArvore({ no, nivel }: { no: NoExplicacao; nivel: number }) {
  const { c, espaco } = useTema();
  const ehRegra = no.tipo === 'regra';
  const rotulo = ehRegra ? no.titulo : (rotulos.get(no.titulo) ?? no.titulo);

  return (
    <View
      style={{
        marginLeft: nivel * 10,
        borderLeftWidth: nivel > 0 ? 2 : 0,
        borderLeftColor: c.borda,
        paddingLeft: nivel > 0 ? espaco.sm : 0,
        marginBottom: espaco.sm,
      }}
    >
      <Linha gap={6} centro={false}>
        <MaterialIcons
          name={ehRegra ? 'rule' : 'label-important-outline'}
          size={16}
          color={ehRegra ? c.primaria : c.textoSecundario}
        />
        <View style={{ flex: 1 }}>
          <Txt v="label" cor={ehRegra ? c.primaria : c.texto}>
            {rotulo}
          </Txt>
          <Txt v="caption" cor={c.textoSecundario}>
            {no.detalhe}
            {no.cf !== undefined ? ` · CF ${no.cf.toFixed(2).replace('.', ',')}` : ''}
          </Txt>
          {no.fonte && (
            <Txt v="caption" cor={c.textoSecundario} style={{ fontStyle: 'italic' }}>
              {no.fonte}
            </Txt>
          )}
        </View>
      </Linha>
      {no.filhos.map((f, i) => (
        <NoDaArvore key={i} no={f} nivel={nivel + 1} />
      ))}
    </View>
  );
}
