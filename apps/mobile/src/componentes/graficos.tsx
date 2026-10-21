/**
 * Gráficos mínimos em SVG.
 *
 * Bibliotecas prontas de chart pesam demais para o aparelho-alvo; estes três
 * componentes cobrem tudo que o app precisa com react-native-svg puro.
 */
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { corCMT, siglaCMT } from '@drmoo/ui';
import { useTema } from '../tema';
import { Linha, Txt } from './base';

export function GraficoLinha({
  valores,
  altura = 90,
  cor,
}: {
  valores: number[];
  altura?: number;
  cor?: string;
}) {
  const { c, espaco } = useTema();
  const corLinha = cor ?? c.primaria;
  const largura = 320;

  const caminho = useMemo(() => {
    if (valores.length < 2) return '';
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const amplitude = max - min || 1;
    const passo = largura / (valores.length - 1);
    return valores
      .map((v, i) => {
        const x = i * passo;
        const y = altura - ((v - min) / amplitude) * (altura - 8) - 4;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [valores, altura]);

  if (valores.length < 2) {
    return (
      <Txt v="caption" cor={c.textoSecundario}>
        Dados insuficientes para o gráfico.
      </Txt>
    );
  }

  return (
    <View style={{ marginVertical: espaco.sm }}>
      <Svg width="100%" height={altura} viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none">
        <Line x1={0} y1={altura - 1} x2={largura} y2={altura - 1} stroke={c.borda} strokeWidth={1} />
        <Path d={caminho} stroke={corLinha} strokeWidth={2.5} fill="none" />
      </Svg>
      <Linha entre>
        <Txt v="caption" cor={c.textoSecundario}>
          mín {Math.round(Math.min(...valores))}
        </Txt>
        <Txt v="caption" cor={c.textoSecundario}>
          máx {Math.round(Math.max(...valores))}
        </Txt>
      </Linha>
    </View>
  );
}

export function GraficoBarras({
  itens,
  formatar,
}: {
  itens: { rotulo: string; valor: number; cor?: string }[];
  formatar?: (v: number) => string;
}) {
  const { c, espaco } = useTema();
  const max = Math.max(...itens.map((i) => i.valor), 1);

  return (
    <View style={{ gap: espaco.sm }}>
      {itens.map((i) => (
        <View key={i.rotulo} style={{ gap: 3 }}>
          <Linha entre>
            <Txt v="label" numberOfLines={1} style={{ flex: 1 }}>
              {i.rotulo}
            </Txt>
            <Txt v="label" cor={c.textoSecundario}>
              {formatar ? formatar(i.valor) : String(i.valor)}
            </Txt>
          </Linha>
          <Svg width="100%" height={10}>
            <Rect x={0} y={0} width="100%" height={10} rx={5} fill={c.borda} />
            <Rect
              x={0}
              y={0}
              width={`${(i.valor / max) * 100}%`}
              height={10}
              rx={5}
              fill={i.cor ?? c.primaria}
            />
          </Svg>
        </View>
      ))}
    </View>
  );
}

/**
 * Úbere em quatro quartos. Resultado sempre acompanhado da sigla — nenhuma
 * informação é transmitida só por cor (specsDrMoo.md §8.3).
 */
export function UbereQuatroQuartos({
  valores,
  aoTocar,
  tamanho = 120,
}: {
  valores: { ad: string | null; ae: string | null; pd: string | null; pe: string | null };
  aoTocar?: (quarto: 'ad' | 'ae' | 'pd' | 'pe') => void;
  tamanho?: number;
}) {
  const { c, raio, espaco } = useTema();

  const quartos: { chave: 'ae' | 'ad' | 'pe' | 'pd'; rotulo: string }[] = [
    { chave: 'ae', rotulo: 'AE' },
    { chave: 'ad', rotulo: 'AD' },
    { chave: 'pe', rotulo: 'PE' },
    { chave: 'pd', rotulo: 'PD' },
  ];

  return (
    <View style={{ width: tamanho * 2 + espaco.xs, gap: espaco.xs }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.xs }}>
        {quartos.map((q) => {
          const v = valores[q.chave];
          const cor = v ? corCMT[v] ?? c.borda : c.borda;
          return (
            <Pressable
              key={q.chave}
              onPress={aoTocar ? () => aoTocar(q.chave) : undefined}
              style={{
                width: tamanho,
                height: tamanho * 0.62,
                borderRadius: raio.card,
                backgroundColor: v ? `${cor}22` : c.superficieAlt,
                borderWidth: 2,
                borderColor: cor,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt v="caption" cor={c.textoSecundario}>
                {q.rotulo}
              </Txt>
              <Txt v="h2" cor={v ? cor : c.textoSecundario}>
                {v ? siglaCMT[v] ?? v : '—'}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      <Txt v="caption" cor={c.textoSecundario}>
        A = anterior · P = posterior · D = direito · E = esquerdo
      </Txt>
    </View>
  );
}
