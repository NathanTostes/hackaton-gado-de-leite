/**
 * Esqueleto dos relatórios.
 *
 * HTML é o formato intermediário porque é o que vira PDF nos dois mundos: o
 * `expo-print` imprime no aparelho e a janela de impressão do navegador imprime
 * no computador. Nada de biblioteca de PDF — menos peso no bundle e o mesmo
 * resultado nos dois.
 *
 * O CSS é embutido e pensado para papel: A4, sem cor de fundo chapada, quebra
 * de página controlada e a paleta da marca só nos detalhes.
 */

export function escapar(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const TEAL = '#015B66';
export const ALERTA = '#B3261E';
export const ATENCAO = '#B26A00';
export const OK = '#2E7D32';

const ESTILO = `
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1A1C1E; margin: 0; font-size: 11pt; line-height: 1.45;
  }
  header.capa {
    border-bottom: 3px solid ${TEAL}; padding-bottom: 10px; margin-bottom: 18px;
    display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
  }
  header.capa h1 { font-size: 19pt; margin: 0; color: ${TEAL}; }
  header.capa .sub { font-size: 10pt; color: #44474A; margin-top: 2px; }
  header.capa .marca { font-size: 9pt; color: #6B6F72; text-align: right; white-space: nowrap; }
  h2 {
    font-size: 13pt; margin: 22px 0 8px; color: ${TEAL};
    border-bottom: 1px solid #DDE2E4; padding-bottom: 4px; page-break-after: avoid;
  }
  h3 { font-size: 11pt; margin: 14px 0 6px; page-break-after: avoid; }
  p { margin: 6px 0; }
  .nota { font-size: 9pt; color: #6B6F72; }
  .cartoes { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
  .cartao {
    border: 1px solid #DDE2E4; border-radius: 6px; padding: 8px 10px;
    min-width: 150px; flex: 1 1 150px;
  }
  .cartao .rotulo { font-size: 8.5pt; color: #6B6F72; text-transform: uppercase; letter-spacing: .4px; }
  .cartao .valor { font-size: 15pt; font-weight: 700; }
  .cartao .meta { font-size: 8.5pt; color: #6B6F72; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9.5pt; }
  th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #E6EAEC; vertical-align: top; }
  th { background: #F2F5F6; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .3px; color: #44474A; }
  td.numero, th.numero { text-align: right; font-variant-numeric: tabular-nums; }
  .secao { page-break-inside: avoid; }
  .destaque { border-left: 4px solid ${TEAL}; background: #F2F5F6; padding: 8px 10px; border-radius: 0 6px 6px 0; }
  .destaque.alerta { border-left-color: ${ALERTA}; background: #FDECEA; }
  .destaque.atencao { border-left-color: ${ATENCAO}; background: #FFF4E5; }
  .destaque .titulo { font-weight: 700; }
  footer {
    margin-top: 24px; border-top: 1px solid #DDE2E4; padding-top: 8px;
    font-size: 8.5pt; color: #6B6F72;
  }
  .quebra { page-break-before: always; }
`;

export interface CabecalhoRelatorio {
  titulo: string;
  subtitulo?: string;
  propriedade?: string | null;
  /** Data/hora de geração, em ISO. Injetável para o teste ser determinístico. */
  geradoEm: string;
}

function dataHoraBR(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function documento(cabecalho: CabecalhoRelatorio, corpo: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapar(cabecalho.titulo)}</title>
<style>${ESTILO}</style>
</head>
<body>
<header class="capa">
  <div>
    <h1>${escapar(cabecalho.titulo)}</h1>
    ${cabecalho.subtitulo ? `<div class="sub">${escapar(cabecalho.subtitulo)}</div>` : ''}
    ${cabecalho.propriedade ? `<div class="sub">${escapar(cabecalho.propriedade)}</div>` : ''}
  </div>
  <div class="marca">
    <strong>Dr. Moo</strong><br />
    Anamnese e triagem de<br />bovinos leiteiros<br />
    ${escapar(dataHoraBR(cabecalho.geradoEm))}
  </div>
</header>
${corpo}
<footer>
  Documento gerado pelo Dr. Moo em ${escapar(dataHoraBR(cabecalho.geradoEm))}, a partir dos dados
  da própria propriedade, sem envio para a internet. O parecer do sistema é apoio à decisão e
  não substitui a avaliação de médico veterinário.
</footer>
</body>
</html>`;
}

export function cartao(rotulo: string, valor: string, meta?: string): string {
  return `<div class="cartao">
    <div class="rotulo">${escapar(rotulo)}</div>
    <div class="valor">${escapar(valor)}</div>
    ${meta ? `<div class="meta">${escapar(meta)}</div>` : ''}
  </div>`;
}

export function cartoes(itens: string[]): string {
  return itens.length ? `<div class="cartoes">${itens.join('')}</div>` : '';
}

export interface ColunaTabela<T> {
  titulo: string;
  valor: (linha: T) => string;
  numero?: boolean;
}

export function tabela<T>(colunas: ColunaTabela<T>[], linhas: T[], vazio = 'Sem registros no período.'): string {
  if (!linhas.length) return `<p class="nota">${escapar(vazio)}</p>`;
  const cabecalho = colunas
    .map((c) => `<th${c.numero ? ' class="numero"' : ''}>${escapar(c.titulo)}</th>`)
    .join('');
  const corpo = linhas
    .map(
      (l) =>
        `<tr>${colunas
          .map((c) => `<td${c.numero ? ' class="numero"' : ''}>${escapar(c.valor(l))}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  return `<table><thead><tr>${cabecalho}</tr></thead><tbody>${corpo}</tbody></table>`;
}

export function destaque(titulo: string, texto: string, tipo: 'info' | 'alerta' | 'atencao' = 'info'): string {
  const classe = tipo === 'info' ? '' : ` ${tipo}`;
  return `<div class="destaque${classe}">
    <div class="titulo">${escapar(titulo)}</div>
    <div>${escapar(texto)}</div>
  </div>`;
}
