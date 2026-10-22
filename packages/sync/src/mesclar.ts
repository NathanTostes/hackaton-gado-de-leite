/**
 * Mesclagem determinística de dois instantâneos.
 *
 * Regra: *last-write-wins* por linha, comparando `updated_at` (ISO, ordenável
 * como texto). Empate resolve pelo JSON da linha — arbitrário, porém igual nos
 * dois aparelhos, que é o que importa: mesclar A com B e B com A precisa dar o
 * mesmo resultado, senão os aparelhos nunca convergem.
 *
 * Exclusão é lógica (`deleted_at`): a linha excluída continua no instantâneo
 * como lápide, com `updated_at` mais novo, e por isso vence a versão antiga do
 * outro aparelho. Tabela sem `deleted_at` não propaga exclusão — o registro
 * apagado num aparelho volta do outro na próxima sincronização.
 */
import { TABELAS_IMUTAVEIS, TABELAS_SINCRONIZADAS, VERSAO_PROTOCOLO, type Instantaneo, type Linha } from './tipos';

function idDe(linha: Linha): string {
  return String(linha.id ?? '');
}

/** Ordem total entre duas versões da mesma linha. Positivo = `a` é a vencedora. */
function comparar(a: Linha, b: Linha): number {
  const ta = String(a.updated_at ?? '');
  const tb = String(b.updated_at ?? '');
  if (ta !== tb) return ta > tb ? 1 : -1;
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja === jb) return 0;
  return ja > jb ? 1 : -1;
}

/** Versão vencedora de cada linha presente em um dos dois lados. */
function mesclarTabela(tabela: string, a: Linha[], b: Linha[]): Linha[] {
  const imutavel = TABELAS_IMUTAVEIS.has(tabela);
  const porId = new Map<string, Linha>();

  for (const linha of a) porId.set(idDe(linha), linha);
  for (const linha of b) {
    const id = idDe(linha);
    const atual = porId.get(id);
    if (!atual) porId.set(id, linha);
    else if (!imutavel && comparar(linha, atual) > 0) porId.set(id, linha);
  }

  // Ordem estável por id: o instantâneo é comparado byte a byte nos testes.
  return [...porId.entries()].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)).map(([, linha]) => linha);
}

export function instantaneoVazio(dispositivo: string, geradoEm = new Date().toISOString()): Instantaneo {
  const tabelas: Record<string, Linha[]> = {};
  for (const t of TABELAS_SINCRONIZADAS) tabelas[t] = [];
  return { versao: VERSAO_PROTOCOLO, dispositivo, geradoEm, tabelas };
}

export function mesclar(a: Instantaneo, b: Instantaneo): Instantaneo {
  const tabelas: Record<string, Linha[]> = {};
  for (const t of TABELAS_SINCRONIZADAS) {
    tabelas[t] = mesclarTabela(t, a.tabelas[t] ?? [], b.tabelas[t] ?? []);
  }
  const geradoEm = a.geradoEm > b.geradoEm ? a.geradoEm : b.geradoEm;
  return { versao: VERSAO_PROTOCOLO, dispositivo: b.dispositivo, geradoEm, tabelas };
}

/**
 * Linhas de `alvo` que `base` não tem ou tem diferentes — o que de fato precisa
 * ser gravado. Evita reescrever a base inteira a cada sincronização.
 */
export function diferenca(base: Instantaneo, alvo: Instantaneo): Record<string, Linha[]> {
  const saida: Record<string, Linha[]> = {};
  for (const t of TABELAS_SINCRONIZADAS) {
    const atuais = new Map((base.tabelas[t] ?? []).map((l) => [idDe(l), JSON.stringify(l)]));
    const novas = (alvo.tabelas[t] ?? []).filter((l) => atuais.get(idDe(l)) !== JSON.stringify(l));
    if (novas.length) saida[t] = novas;
  }
  return saida;
}

export function contarLinhas(i: Instantaneo): number {
  return TABELAS_SINCRONIZADAS.reduce((total, t) => total + (i.tabelas[t]?.length ?? 0), 0);
}

/** Validação do que chega pela rede: o servidor aceita só o formato esperado. */
export function validarInstantaneo(valor: unknown): Instantaneo {
  if (!valor || typeof valor !== 'object') throw new Error('instantâneo ausente');
  const i = valor as Partial<Instantaneo>;
  if (i.versao !== VERSAO_PROTOCOLO) {
    throw new Error(`versão de protocolo incompatível: ${String(i.versao)} (esperada ${VERSAO_PROTOCOLO})`);
  }
  if (!i.tabelas || typeof i.tabelas !== 'object') throw new Error('instantâneo sem tabelas');
  const tabelas: Record<string, Linha[]> = {};
  for (const t of TABELAS_SINCRONIZADAS) {
    const linhas = (i.tabelas as Record<string, unknown>)[t];
    if (linhas === undefined) {
      tabelas[t] = [];
      continue;
    }
    if (!Array.isArray(linhas)) throw new Error(`tabela ${t} não é uma lista`);
    for (const linha of linhas) {
      if (!linha || typeof linha !== 'object' || Array.isArray(linha)) throw new Error(`linha inválida em ${t}`);
      if (!(linha as Linha).id) throw new Error(`linha sem id em ${t}`);
    }
    tabelas[t] = linhas as Linha[];
  }
  return {
    versao: VERSAO_PROTOCOLO,
    dispositivo: typeof i.dispositivo === 'string' ? i.dispositivo : 'aparelho',
    geradoEm: typeof i.geradoEm === 'string' ? i.geradoEm : new Date().toISOString(),
    tabelas,
  };
}
