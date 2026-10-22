/**
 * Planilha: exportar o banco, reimportar o arquivo e conferir que nada se
 * perdeu nem se duplicou.
 *
 * Este é o teste que protege a apresentação: a planilha baixada é a mesma que
 * vai alimentar o sistema no palco.
 */
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { ABAS, lerArquivo, type LinhaPlanilha } from '@drmoo/planilha';
import {
  definirBackend,
  exportarPlanilha,
  importarPlanilha,
  listarRebanho,
  obterPropriedade,
  salvarAnimal,
  salvarPropriedade,
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

/** Monta um arquivo .xlsx a partir de linhas em português, como o produtor faria. */
async function arquivoCom(abas: Record<string, LinhaPlanilha[]>): Promise<Uint8Array> {
  const XLSX = await import('xlsx');
  const livro = XLSX.utils.book_new();
  for (const definicao of ABAS) {
    const linhas = abas[definicao.nome] ?? [];
    const aba = XLSX.utils.json_to_sheet(linhas, { header: definicao.colunas.map((c) => c.titulo) });
    XLSX.utils.book_append_sheet(livro, aba, definicao.nome);
  }
  return new Uint8Array(XLSX.write(livro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

describe('planilha da propriedade', () => {
  beforeEach(async () => {
    definirBackend(backendNode());
    await salvarPropriedade({ nome: 'Sítio Boa Esperança', area_propria_ha: 28, preco_leite_litro: 1.07 });
  });

  it('exporta um arquivo com uma aba por cadastro, mesmo vazio (é o template)', async () => {
    const bytes = await exportarPlanilha();
    const { conteudo } = lerArquivo(bytes);

    for (const aba of ABAS) expect(conteudo[aba.nome]).toBeDefined();
    expect(conteudo.Propriedade?.[0]?.['Nome da propriedade']).toBe('Sítio Boa Esperança');
  });

  it('preserva estado, cidade, país e pasto no round-trip em um banco vazio', async () => {
    await salvarPropriedade({ estado: 'MG', cidade: 'Juiz de Fora', pais: 'Brasil', tipo_pasto: 'Braquiária e tifton' });
    const bytes = await exportarPlanilha();
    const { conteudo } = lerArquivo(bytes);
    expect(conteudo.Propriedade?.[0]).toMatchObject({
      'Estado (UF)': 'MG', Cidade: 'Juiz de Fora', País: 'Brasil', 'Tipo de pasto': 'Braquiária e tifton',
    });
    definirBackend(backendNode());
    const relatorio = await importarPlanilha(bytes);
    expect(relatorio.erros).toEqual([]);
    expect(await obterPropriedade()).toMatchObject({
      estado: 'MG', cidade: 'Juiz de Fora', pais: 'Brasil', tipo_pasto: 'Braquiária e tifton',
    });
  });

  it('preserva o estado de suspeita clínica na exportação e importação', async () => {
    await salvarAnimal({ brinco: '901', categoria: 'vaca_lactacao', sexo: 'F', status: 'suspeito' });
    const bytes = await exportarPlanilha();
    definirBackend(backendNode());
    const relatorio = await importarPlanilha(bytes);
    expect(relatorio.erros).toEqual([]);
    expect((await listarRebanho())[0]?.status).toBe('suspeito');
  });

  it('importa animais, lotes e produção referenciando por brinco e nome do lote', async () => {
    const arquivo = await arquivoCom({
      Lotes: [{ Lote: 'Vacas em lactação', Descrição: 'Alta produção' }],
      Animais: [
        {
          Brinco: '101',
          Nome: 'Mimosa',
          Categoria: 'vaca_lactacao',
          'Sexo (F/M)': 'F',
          Raça: 'Girolando',
          Nascimento: '15/03/2021',
          Lote: 'Vacas em lactação',
        },
      ],
      ControleLeiteiro: [{ Brinco: '101', Data: '2026-10-01', 'Litros da manhã': 9.5, 'Litros da tarde': 7 }],
    });

    const relatorio = await importarPlanilha(arquivo);

    expect(relatorio.erros).toEqual([]);
    expect(relatorio.gravadas.Animais).toBe(1);
    const [animal] = await listarRebanho();
    expect(animal?.nome).toBe('Mimosa');
    expect(animal?.data_nascimento).toBe('2021-03-15');
    expect(animal?.lote_nome).toBe('Vacas em lactação');
    expect(animal?.producao_media_dia).toBeCloseTo(16.5, 1);
  });

  it('relata a linha com problema e grava o resto', async () => {
    const arquivo = await arquivoCom({
      Animais: [
        { Brinco: '201', Categoria: 'vaca_lactacao', 'Sexo (F/M)': 'F' },
        { Brinco: '202', Categoria: 'categoria_que_nao_existe', 'Sexo (F/M)': 'F' },
        { Brinco: '', Categoria: 'novilha', 'Sexo (F/M)': 'F' },
      ],
      Tratamentos: [{ Brinco: '999', Início: '2026-10-01', 'Custo total (R$)': 40 }],
    });

    const relatorio = await importarPlanilha(arquivo);

    expect(relatorio.gravadas.Animais).toBe(1);
    expect(relatorio.erros).toHaveLength(3);
    expect(relatorio.erros.map((e) => e.motivo).join(' | ')).toMatch(/não aceito|obrigatório|não existe/);
    expect((await listarRebanho()).map((a) => a.brinco)).toEqual(['201']);
  });

  it('reimportar a mesma planilha atualiza, não duplica', async () => {
    const arquivo = await arquivoCom({
      Animais: [{ Brinco: '301', Nome: 'Luna', Categoria: 'novilha', 'Sexo (F/M)': 'F' }],
    });

    await importarPlanilha(arquivo);
    await importarPlanilha(arquivo);

    const rebanho = await listarRebanho();
    expect(rebanho).toHaveLength(1);
    expect(rebanho[0]?.nome).toBe('Luna');
  });

  it('exportar e reimportar preserva o rebanho', async () => {
    await salvarAnimal({ brinco: '401', nome: 'Estrela', categoria: 'vaca_seca', sexo: 'F', raca: 'Holandês' });
    await salvarAnimal({ brinco: '402', nome: 'Trovão', categoria: 'touro', sexo: 'M' });

    const bytes = await exportarPlanilha();
    const relatorio = await importarPlanilha(bytes);

    expect(relatorio.erros).toEqual([]);
    const rebanho = await listarRebanho();
    expect(rebanho.map((a) => a.brinco)).toEqual(['401', '402']);
    expect(rebanho.find((a) => a.brinco === '401')?.raca).toBe('Holandês');
    expect((await obterPropriedade())?.nome).toBe('Sítio Boa Esperança');
  });

  it('o modo substituir troca a base inteira', async () => {
    await salvarAnimal({ brinco: '501', categoria: 'novilha', sexo: 'F' });
    const arquivo = await arquivoCom({
      Animais: [{ Brinco: '601', Categoria: 'novilha', 'Sexo (F/M)': 'F' }],
    });

    const relatorio = await importarPlanilha(arquivo, { substituir: true });

    expect(relatorio.substituiu).toBe(true);
    expect((await listarRebanho()).map((a) => a.brinco)).toEqual(['601']);
  });
  it('preserva a base anterior quando a substituição falha na gravação', async () => {
    const id = await salvarAnimal({ brinco: 'original', categoria: 'novilha', sexo: 'F' });
    const arquivo = await arquivoCom({ Animais: [
      { Brinco: 'repetido', Categoria: 'novilha', 'Sexo (F/M)': 'F' },
      { Brinco: 'repetido', Categoria: 'novilha', 'Sexo (F/M)': 'F' },
    ] });
    await expect(importarPlanilha(arquivo, { substituir: true })).rejects.toThrow(/UNIQUE/);
    expect((await listarRebanho()).map((a) => a.id)).toEqual([id]);
    expect((await obterPropriedade())?.nome).toBe('Sítio Boa Esperança');
  });

  it('cancela a substituição inteira se houver erros de validação', async () => {
    await salvarAnimal({ brinco: 'original', categoria: 'novilha', sexo: 'F' });
    const arquivo = await arquivoCom({ Animais: [
      { Brinco: 'valido', Categoria: 'novilha', 'Sexo (F/M)': 'F' },
      { Brinco: 'invalido', Categoria: 'desconhecida', 'Sexo (F/M)': 'F' },
    ] });
    await expect(importarPlanilha(arquivo, { substituir: true })).rejects.toThrow(/substituição foi cancelada/);
    expect((await listarRebanho()).map((a) => a.brinco)).toEqual(['original']);
  });

  it('restaura idade estimada, referência, peso de entrada e origem transferência', async () => {
    await salvarAnimal({
      brinco: 'transferido', categoria: 'novilha', sexo: 'F', origem: 'transferencia',
      idade_estimada_meses: 18, idade_estimada_em: '2025-10-01', peso_entrada: 200,
    });
    const arquivo = await exportarPlanilha();
    const resultado = await importarPlanilha(arquivo, { substituir: true });
    expect(resultado.erros).toEqual([]);
    expect(await listarRebanho()).toEqual([expect.objectContaining({
      brinco: 'transferido', origem: 'transferencia', idade_estimada_meses: 18,
      idade_estimada_em: '2025-10-01', peso_entrada: 200,
    })]);
  });

});
