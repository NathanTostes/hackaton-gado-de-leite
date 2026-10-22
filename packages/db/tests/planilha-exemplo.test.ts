/**
 * A planilha de exemplo.
 *
 * Ela é oferecida como "baixe, abra e importe": se uma única linha dela for
 * recusada pela importação, o primeiro contato do produtor com o app é uma
 * tela de erro. Por isso o teste importa o arquivo de verdade, pelo mesmo
 * caminho de uma planilha preenchida à mão, e exige **zero** linhas com
 * problema.
 */
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { gerarArquivoExemplo, lerArquivo, NOME_ARQUIVO_EXEMPLO } from '@drmoo/planilha';
import {
  consultar,
  definirBackend,
  importarPlanilha,
  listarRebanho,
  obterPropriedade,
  type BackendSQLite,
} from '@drmoo/db';

function backendNode(): BackendSQLite {
  const db = new DatabaseSync(':memory:');
  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, params) {
      db.prepare(sql).run(...params);
    },
    async getAllAsync<T>(sql: string, params: (string | number | null)[]) {
      return db.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, params: (string | number | null)[]) {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async withTransactionAsync(fn) {
      db.exec('BEGIN');
      try {
        await fn();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

// Data fixa: o exemplo monta as datas em relação a "hoje", e um teste que
// depende do relógio é um teste que quebra sozinho.
const HOJE = new Date('2026-06-15T12:00:00.000Z');

describe('planilha de exemplo', () => {
  beforeEach(() => {
    definirBackend(backendNode());
  });

  it('tem o nome de arquivo que o download usa', () => {
    expect(NOME_ARQUIVO_EXEMPLO.endsWith('.xlsx')).toBe(true);
  });

  it('vem com 10 vacas e dados de apoio em todas as abas que importam', () => {
    const { conteudo } = lerArquivo(gerarArquivoExemplo(HOJE));

    const vacas = (conteudo.Animais ?? []).filter((a) =>
      String(a.Categoria).startsWith('vaca_'),
    );
    expect(vacas).toHaveLength(10);

    // "E mais alguns dados": o exemplo só serve se as telas tiverem o que mostrar.
    expect(conteudo.Lotes?.length).toBeGreaterThanOrEqual(3);
    expect(conteudo.Lactacoes?.length).toBe(10);
    expect(conteudo.ControleLeiteiro?.length).toBeGreaterThanOrEqual(20);
    expect(conteudo.ProducaoPropriedade?.length).toBe(7);
    expect(conteudo.ExamesCMT?.length).toBeGreaterThanOrEqual(8);
    expect(conteudo.ExamesCCS?.length).toBeGreaterThanOrEqual(4);
    expect(conteudo.Medicamentos?.length).toBeGreaterThanOrEqual(3);
    expect(conteudo.Tratamentos?.length).toBeGreaterThanOrEqual(2);
    expect(conteudo.Vacinacoes?.length).toBeGreaterThanOrEqual(4);
    expect(conteudo.Coberturas?.length).toBeGreaterThanOrEqual(4);
    expect(conteudo.Despesas?.length).toBeGreaterThanOrEqual(5);
    expect(conteudo.Receitas?.length).toBeGreaterThanOrEqual(3);
    expect(conteudo.Eventos?.length).toBeGreaterThanOrEqual(3);
  });

  it('importa inteira, sem uma única linha recusada', async () => {
    const relatorio = await importarPlanilha(gerarArquivoExemplo(HOJE), { substituir: true });

    expect(relatorio.erros).toEqual([]);
    expect(relatorio.total).toBeGreaterThan(80);

    const propriedade = await obterPropriedade();
    expect(propriedade?.nome).toContain('Boa Esperança');

    const rebanho = await listarRebanho();
    expect(rebanho.filter((a) => a.categoria.startsWith('vaca_'))).toHaveLength(10);
    // Lote e medicamento entram por nome; se a referência não resolvesse, a
    // linha teria virado erro em vez de vínculo.
    expect(rebanho.every((a) => a.lote_id)).toBe(true);
  });

  it('o leite pesado por vaca bate com o total somado na importação', async () => {
    await importarPlanilha(gerarArquivoExemplo(HOJE), { substituir: true });

    const linhas = await consultar<{ litros_manha: number; litros_tarde: number; litros_total: number }>(
      'SELECT litros_manha, litros_tarde, litros_total FROM controle_leiteiro',
    );
    expect(linhas.length).toBeGreaterThanOrEqual(20);
    for (const l of linhas) {
      expect(l.litros_total).toBeCloseTo(l.litros_manha + l.litros_tarde, 5);
      expect(l.litros_total).toBeGreaterThan(0);
    }
  });

  it('a planilha baixada hoje e a de amanhã contam a mesma história', () => {
    const amanha = new Date(HOJE.getTime() + 86400 * 1000);
    const hoje = lerArquivo(gerarArquivoExemplo(HOJE)).conteudo;
    const depois = lerArquivo(gerarArquivoExemplo(amanha)).conteudo;

    // Mesmos animais e mesmos litros; só as datas andam junto com o calendário.
    expect(depois.Animais?.map((a) => a.Brinco)).toEqual(hoje.Animais?.map((a) => a.Brinco));
    expect(depois.ControleLeiteiro?.map((l) => l['Litros da manhã'])).toEqual(
      hoje.ControleLeiteiro?.map((l) => l['Litros da manhã']),
    );
    expect(depois.ControleLeiteiro?.[0]?.Data).not.toBe(hoje.ControleLeiteiro?.[0]?.Data);
  });
});
