/**
 * Leitura e escrita do arquivo `.xlsx`.
 *
 * Usa SheetJS, que é JavaScript puro: o mesmo código monta a planilha no
 * navegador e no aparelho, sem servidor e sem conversor externo — continua
 * tudo offline.
 */
import * as XLSX from 'xlsx';
import { ABAS, ABA_INSTRUCOES, type AbaPlanilha } from './mapa';
import type { LinhaPlanilha } from './conversao';

export type ConteudoPlanilha = Record<string, LinhaPlanilha[]>;

/** Largura de coluna agradável de ler, limitada para não virar uma faixa. */
function largura(titulo: string, linhas: LinhaPlanilha[]): number {
  const maior = linhas.reduce((max, l) => Math.max(max, String(l[titulo] ?? '').length), titulo.length);
  return Math.min(Math.max(maior + 2, 12), 42);
}

function abaInstrucoes(): XLSX.WorkSheet {
  const linhas: string[][] = [
    ['Dr. Moo — planilha de dados da propriedade'],
    [],
    ['Como usar'],
    ['1. Cada aba corresponde a um cadastro do sistema. Não renomeie nem apague abas e cabeçalhos.'],
    ['2. Referências são feitas pelo BRINCO do animal e pelo NOME do lote, do medicamento e da vacina.'],
    ['3. Datas aceitam 2026-03-15 ou 15/03/2026. Sim/não aceita sim, não, x, verdadeiro, falso.'],
    ['4. Deixe em branco o que não souber. Linhas em branco são ignoradas.'],
    ['5. Ao importar, cada linha é gravada ou atualizada; linhas com problema são relatadas e o resto entra.'],
    [],
    ['Abas', 'Para que serve', 'Campos obrigatórios'],
    ...ABAS.map((a) => [
      a.nome,
      a.descricao,
      a.colunas
        .filter((c) => c.obrigatoria)
        .map((c) => c.titulo)
        .join(', ') || '—',
    ]),
  ];
  const aba = XLSX.utils.aoa_to_sheet(linhas);
  aba['!cols'] = [{ wch: 22 }, { wch: 74 }, { wch: 38 }];
  return aba;
}

function abaDeDados(definicao: AbaPlanilha, linhas: LinhaPlanilha[]): XLSX.WorkSheet {
  const titulos = definicao.colunas.map((c) => c.titulo);
  // Mesmo sem dados a aba sai com cabeçalho: é isso que faz dela um template.
  const aba = XLSX.utils.json_to_sheet(linhas, { header: titulos });
  aba['!cols'] = titulos.map((t) => ({ wch: largura(t, linhas) }));
  aba['!freeze'] = { xSplit: 0, ySplit: 1 };
  return aba;
}

/**
 * Monta o arquivo. Abas sem dados saem só com o cabeçalho — é assim que a
 * exportação do banco cheio e o template em branco são o MESMO arquivo, e o
 * produtor pode preencher a planilha que acabou de baixar.
 */
export function gerarArquivo(conteudo: ConteudoPlanilha): Uint8Array {
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, abaInstrucoes(), ABA_INSTRUCOES);
  for (const definicao of ABAS) {
    XLSX.utils.book_append_sheet(livro, abaDeDados(definicao, conteudo[definicao.nome] ?? []), definicao.nome);
  }
  return new Uint8Array(XLSX.write(livro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

/** Base64 — formato que o sistema de arquivos do aparelho aceita escrever. */
export function gerarArquivoBase64(conteudo: ConteudoPlanilha): string {
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, abaInstrucoes(), ABA_INSTRUCOES);
  for (const definicao of ABAS) {
    XLSX.utils.book_append_sheet(livro, abaDeDados(definicao, conteudo[definicao.nome] ?? []), definicao.nome);
  }
  return XLSX.write(livro, { type: 'base64', bookType: 'xlsx' }) as string;
}

export interface ArquivoLido {
  conteudo: ConteudoPlanilha;
  /** Abas do arquivo que o sistema não conhece — avisadas, nunca aplicadas. */
  abasDesconhecidas: string[];
}

export function lerArquivo(dados: Uint8Array | ArrayBuffer | string): ArquivoLido {
  const livro =
    typeof dados === 'string'
      ? XLSX.read(dados, { type: 'base64', cellDates: true })
      : XLSX.read(dados instanceof Uint8Array ? dados : new Uint8Array(dados), {
          type: 'array',
          cellDates: true,
        });

  const conteudo: ConteudoPlanilha = {};
  const conhecidas = new Set<string>([ABA_INSTRUCOES, ...ABAS.map((a) => a.nome)]);
  const abasDesconhecidas: string[] = [];

  for (const nome of livro.SheetNames) {
    if (!conhecidas.has(nome)) {
      abasDesconhecidas.push(nome);
      continue;
    }
    if (nome === ABA_INSTRUCOES) continue;
    const aba = livro.Sheets[nome];
    if (!aba) continue;
    conteudo[nome] = XLSX.utils.sheet_to_json<LinhaPlanilha>(aba, { defval: '', raw: true });
  }

  return { conteudo, abasDesconhecidas };
}
