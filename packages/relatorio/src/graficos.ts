/**
 * Gráficos em SVG puro, escritos como texto.
 *
 * Sem biblioteca: o PDF é gerado a partir de HTML, e SVG inline imprime nítido
 * em qualquer tamanho, inclusive no PDF do aparelho. São três formas, que é o
 * que os dados da propriedade pedem — série no tempo, comparação entre
 * categorias e composição do rebanho.
 */
import { escapar, TEAL } from './html';

const PALETA = ['#015B66', '#2E7D32', '#B26A00', '#B3261E', '#4A6572', '#7B5EA7', '#00796B', '#8D6E63'];

export interface PontoSerie {
  rotulo: string;
  valor: number;
}

function nenhumDado(mensagem = 'Sem dados para o período.'): string {
  return `<p class="nota">${escapar(mensagem)}</p>`;
}

function formatarPadrao(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

/** Linha do tempo — produção diária, por exemplo. */
export function graficoLinha(
  pontos: PontoSerie[],
  opcoes: { altura?: number; largura?: number; unidade?: string } = {},
): string {
  if (pontos.length < 2) return nenhumDado();

  const largura = opcoes.largura ?? 720;
  const altura = opcoes.altura ?? 200;
  const margem = { topo: 12, direita: 10, baixo: 26, esquerda: 48 };
  const w = largura - margem.esquerda - margem.direita;
  const h = altura - margem.topo - margem.baixo;

  const valores = pontos.map((p) => p.valor);
  const maximo = Math.max(...valores);
  const minimo = Math.min(0, ...valores);
  const amplitude = maximo - minimo || 1;

  const x = (i: number) => margem.esquerda + (i / (pontos.length - 1)) * w;
  const y = (v: number) => margem.topo + h - ((v - minimo) / amplitude) * h;

  const linha = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
  const area = `${linha} L${x(pontos.length - 1).toFixed(1)},${margem.topo + h} L${margem.esquerda},${margem.topo + h} Z`;

  const marcas = [minimo, minimo + amplitude / 2, maximo];
  const grade = marcas
    .map(
      (v) =>
        `<line x1="${margem.esquerda}" y1="${y(v).toFixed(1)}" x2="${largura - margem.direita}" y2="${y(v).toFixed(1)}" stroke="#E6EAEC" stroke-width="1" />
         <text x="${margem.esquerda - 6}" y="${(y(v) + 3).toFixed(1)}" font-size="9" fill="#6B6F72" text-anchor="end">${escapar(formatarPadrao(v))}</text>`,
    )
    .join('');

  // Um rótulo a cada N pontos: num mês de produção, 30 datas viram borrão.
  const passo = Math.max(1, Math.ceil(pontos.length / 8));
  const eixoX = pontos
    .map((p, i) =>
      i % passo === 0 || i === pontos.length - 1
        ? `<text x="${x(i).toFixed(1)}" y="${altura - 8}" font-size="8.5" fill="#6B6F72" text-anchor="middle">${escapar(p.rotulo)}</text>`
        : '',
    )
    .join('');

  return `<svg viewBox="0 0 ${largura} ${altura}" width="100%" height="${altura}" role="img">
    ${grade}
    <path d="${area}" fill="${TEAL}1A" />
    <path d="${linha}" fill="none" stroke="${TEAL}" stroke-width="2" stroke-linejoin="round" />
    ${eixoX}
    ${opcoes.unidade ? `<text x="${margem.esquerda}" y="10" font-size="8.5" fill="#6B6F72">${escapar(opcoes.unidade)}</text>` : ''}
  </svg>`;
}

/** Barras horizontais — categorias de despesa, custo por vaca, diagnósticos. */
export function graficoBarras(
  itens: PontoSerie[],
  opcoes: { formatar?: (v: number) => string; largura?: number; cor?: string } = {},
): string {
  if (!itens.length) return nenhumDado();

  const formatar = opcoes.formatar ?? formatarPadrao;
  const largura = opcoes.largura ?? 720;
  const alturaLinha = 22;
  const altura = itens.length * alturaLinha + 8;
  const rotuloW = 150;
  const valorW = 92;
  const trilho = largura - rotuloW - valorW - 8;
  const maximo = Math.max(...itens.map((i) => Math.abs(i.valor)), 1);

  const barras = itens
    .map((item, i) => {
      const y = i * alturaLinha + 4;
      const comprimento = Math.max(2, (Math.abs(item.valor) / maximo) * trilho);
      const cor = opcoes.cor ?? PALETA[i % PALETA.length];
      return `<text x="0" y="${y + 13}" font-size="9.5" fill="#1A1C1E">${escapar(item.rotulo)}</text>
        <rect x="${rotuloW}" y="${y + 3}" width="${trilho}" height="12" fill="#F2F5F6" rx="3" />
        <rect x="${rotuloW}" y="${y + 3}" width="${comprimento.toFixed(1)}" height="12" fill="${cor}" rx="3" />
        <text x="${largura}" y="${y + 13}" font-size="9.5" fill="#44474A" text-anchor="end">${escapar(formatar(item.valor))}</text>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${largura} ${altura}" width="100%" height="${altura}" role="img">${barras}</svg>`;
}

/** Rosca — composição do rebanho por categoria. */
export function graficoRosca(itens: PontoSerie[], opcoes: { tamanho?: number } = {}): string {
  const total = itens.reduce((t, i) => t + i.valor, 0);
  if (!total) return nenhumDado();

  const tamanho = opcoes.tamanho ?? 190;
  const raio = tamanho / 2 - 6;
  const centro = tamanho / 2;
  const interno = raio * 0.58;

  let angulo = -Math.PI / 2;
  const fatias = itens
    .filter((i) => i.valor > 0)
    .map((item, indice) => {
      const fracao = item.valor / total;
      const fim = angulo + fracao * Math.PI * 2;
      const grande = fracao > 0.5 ? 1 : 0;
      const p = (r: number, a: number) => `${(centro + r * Math.cos(a)).toFixed(2)},${(centro + r * Math.sin(a)).toFixed(2)}`;
      // Fatia única não pode fechar o arco em si mesma: vira um círculo cheio.
      const caminho =
        fracao >= 0.999
          ? `M ${p(raio, 0)} A ${raio} ${raio} 0 1 1 ${p(raio, Math.PI)} A ${raio} ${raio} 0 1 1 ${p(raio, 0)} Z
             M ${p(interno, 0)} A ${interno} ${interno} 0 1 0 ${p(interno, Math.PI)} A ${interno} ${interno} 0 1 0 ${p(interno, 0)} Z`
          : `M ${p(raio, angulo)} A ${raio} ${raio} 0 ${grande} 1 ${p(raio, fim)}
             L ${p(interno, fim)} A ${interno} ${interno} 0 ${grande} 0 ${p(interno, angulo)} Z`;
      angulo = fim;
      return `<path d="${caminho}" fill="${PALETA[indice % PALETA.length]}" fill-rule="evenodd" />`;
    })
    .join('');

  const legenda = itens
    .filter((i) => i.valor > 0)
    .map(
      (item, indice) =>
        `<li><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${
          PALETA[indice % PALETA.length]
        };margin-right:6px"></span>${escapar(item.rotulo)} — <strong>${escapar(formatarPadrao(item.valor))}</strong>
        <span class="nota">(${((item.valor / total) * 100).toFixed(1)}%)</span></li>`,
    )
    .join('');

  return `<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
    <svg viewBox="0 0 ${tamanho} ${tamanho}" width="${tamanho}" height="${tamanho}" role="img">
      ${fatias}
      <text x="${centro}" y="${centro - 2}" font-size="17" font-weight="700" text-anchor="middle" fill="#1A1C1E">${escapar(
        formatarPadrao(total),
      )}</text>
      <text x="${centro}" y="${centro + 13}" font-size="9" text-anchor="middle" fill="#6B6F72">total</text>
    </svg>
    <ul style="list-style:none;padding:0;margin:0;font-size:10pt;line-height:1.8">${legenda}</ul>
  </div>`;
}
