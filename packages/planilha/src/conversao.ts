/**
 * Conversão entre linha de planilha e linha de banco.
 *
 * Funções puras: recebem as linhas e um contexto com os nomes já conhecidos
 * (brincos, lotes, medicamentos, vacinas) e devolvem o que gravar e o que deu
 * errado. Nada de I/O aqui — é isto que torna a importação testável sem Excel
 * e sem banco.
 *
 * Princípio da importação: **nunca falhar calada**. Linha com problema vira um
 * erro descrito com aba, número da linha e motivo; o resto entra.
 */
import type { AbaPlanilha, ColunaPlanilha } from './mapa';

export type Valor = string | number | null;
export type LinhaBanco = Record<string, Valor>;
export type LinhaPlanilha = Record<string, unknown>;

export interface ContextoConversao {
  /** brinco → id do animal. */
  animais: Map<string, string>;
  /** nome do lote → id. */
  lotes: Map<string, string>;
  medicamentos: Map<string, string>;
  vacinas: Map<string, string>;
  /** id existente para a chave natural da linha, quando já estiver no banco. */
  idExistente?: (tabela: string, linha: LinhaBanco) => string | undefined;
  novoId: (prefixo: string) => string;
  agora: () => string;
}

export interface ErroImportacao {
  aba: string;
  /** Número da linha como aparece no Excel (1 é o cabeçalho). */
  linha: number;
  coluna?: string;
  motivo: string;
}

export interface ResultadoConversao {
  tabela: string;
  linhas: LinhaBanco[];
  erros: ErroImportacao[];
}

const SIM = new Set(['sim', 's', 'true', 'verdadeiro', '1', 'x', 'yes']);
const NAO = new Set(['nao', 'não', 'n', 'false', 'falso', '0', '']);

/** Excel guarda data como número de dias desde 1899-12-30. */
function dataDeSerialExcel(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Aceita 2026-03-15, 15/03/2026, o serial do Excel e o objeto Date. */
export function normalizarData(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'number') return dataDeSerialExcel(valor);

  const texto = String(valor).trim();
  if (!texto) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);

  const br = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(texto);
  if (br) {
    const [, dia, mes, ano] = br;
    const anoCheio = ano!.length === 2 ? `20${ano}` : ano!;
    return `${anoCheio}-${mes!.padStart(2, '0')}-${dia!.padStart(2, '0')}`;
  }
  return null;
}

export function normalizarNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  // "1.234,56" (pt-BR) e "1234.56" precisam dar o mesmo número.
  const texto = String(valor).trim().replace(/[R$\s]/g, '');
  const limpo = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

export function normalizarBooleano(valor: unknown): 0 | 1 | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'boolean') return valor ? 1 : 0;
  if (typeof valor === 'number') return valor ? 1 : 0;
  const texto = String(valor).trim().toLowerCase();
  if (SIM.has(texto)) return 1;
  if (NAO.has(texto)) return 0;
  return null;
}

function referenciaDe(ctx: ContextoConversao, tipo: NonNullable<ColunaPlanilha['referencia']>): Map<string, string> {
  return tipo === 'animal'
    ? ctx.animais
    : tipo === 'lote'
      ? ctx.lotes
      : tipo === 'medicamento'
        ? ctx.medicamentos
        : ctx.vacinas;
}

function vazia(linha: LinhaPlanilha): boolean {
  return Object.values(linha).every((v) => v === null || v === undefined || String(v).trim() === '');
}

/**
 * Converte as linhas de uma aba em linhas de banco.
 *
 * `id`, `created_at` e `updated_at` são preenchidos aqui: a planilha é do
 * produtor, não do esquema.
 */
export function abaParaBanco(
  aba: AbaPlanilha,
  linhas: LinhaPlanilha[],
  ctx: ContextoConversao,
): ResultadoConversao {
  const saida: LinhaBanco[] = [];
  const erros: ErroImportacao[] = [];
  const agora = ctx.agora();

  linhas.forEach((bruta, i) => {
    const numeroLinha = i + 2; // 1 é o cabeçalho no Excel
    if (vazia(bruta)) return;

    const destino: LinhaBanco = {};
    let invalida = false;

    for (const col of aba.colunas) {
      const cru = bruta[col.titulo];
      const texto = cru === null || cru === undefined ? '' : String(cru).trim();

      if (!texto) {
        if (col.obrigatoria) {
          erros.push({ aba: aba.nome, linha: numeroLinha, coluna: col.titulo, motivo: 'campo obrigatório vazio' });
          invalida = true;
        }
        // Célula vazia não vira NULL: a coluna fica de fora, e com isso o
        // banco aplica o seu padrão (status "saudável", origem "nascimento")
        // e a reimportação não apaga o que já estava preenchido.
        continue;
      }

      if (col.referencia) {
        const id = referenciaDe(ctx, col.referencia).get(texto);
        if (!id) {
          erros.push({
            aba: aba.nome,
            linha: numeroLinha,
            coluna: col.titulo,
            motivo: `"${texto}" não existe (${col.referencia}). Cadastre antes, na aba correspondente.`,
          });
          invalida = true;
          continue;
        }
        destino[col.coluna] = id;
        continue;
      }

      switch (col.tipo) {
        case 'data': {
          const data = normalizarData(cru);
          if (!data) {
            erros.push({ aba: aba.nome, linha: numeroLinha, coluna: col.titulo, motivo: `data inválida: "${texto}"` });
            invalida = true;
          } else destino[col.coluna] = data;
          break;
        }
        case 'numero':
        case 'inteiro': {
          const n = normalizarNumero(cru);
          if (n === null) {
            erros.push({ aba: aba.nome, linha: numeroLinha, coluna: col.titulo, motivo: `número inválido: "${texto}"` });
            invalida = true;
          } else destino[col.coluna] = col.tipo === 'inteiro' ? Math.round(n) : n;
          break;
        }
        case 'booleano': {
          const b = normalizarBooleano(cru);
          if (b === null) {
            erros.push({
              aba: aba.nome,
              linha: numeroLinha,
              coluna: col.titulo,
              motivo: `responda sim ou não: "${texto}"`,
            });
            invalida = true;
          } else destino[col.coluna] = b;
          break;
        }
        default: {
          if (col.valores && !col.valores.includes(texto)) {
            erros.push({
              aba: aba.nome,
              linha: numeroLinha,
              coluna: col.titulo,
              motivo: `valor não aceito: "${texto}". Use um de: ${col.valores.join(', ')}`,
            });
            invalida = true;
          } else destino[col.coluna] = texto;
        }
      }
    }

    if (invalida) return;

    Object.assign(destino, aba.derivar?.(destino) ?? {});
    const existente = ctx.idExistente?.(aba.tabela, destino);
    destino.id = existente ?? ctx.novoId(aba.tabela.slice(0, 4));
    destino.created_at = agora;
    destino.updated_at = agora;
    saida.push(destino);
  });

  return { tabela: aba.tabela, linhas: saida, erros };
}

/** Converte linhas do banco para o formato da planilha (cabeçalhos em português). */
export function bancoParaAba(
  aba: AbaPlanilha,
  linhas: LinhaBanco[],
  nomePorId: {
    animais: Map<string, string>;
    lotes: Map<string, string>;
    medicamentos: Map<string, string>;
    vacinas: Map<string, string>;
  },
): LinhaPlanilha[] {
  return linhas.map((linha) => {
    const saida: LinhaPlanilha = {};
    for (const col of aba.colunas) {
      const valor = linha[col.coluna];
      if (valor === null || valor === undefined) {
        saida[col.titulo] = '';
        continue;
      }
      if (col.referencia) {
        const mapa =
          col.referencia === 'animal'
            ? nomePorId.animais
            : col.referencia === 'lote'
              ? nomePorId.lotes
              : col.referencia === 'medicamento'
                ? nomePorId.medicamentos
                : nomePorId.vacinas;
        saida[col.titulo] = mapa.get(String(valor)) ?? '';
        continue;
      }
      if (col.tipo === 'booleano') {
        saida[col.titulo] = Number(valor) ? 'sim' : 'não';
        continue;
      }
      if (col.tipo === 'data') {
        saida[col.titulo] = String(valor).slice(0, 10);
        continue;
      }
      saida[col.titulo] = valor;
    }
    return saida;
  });
}
