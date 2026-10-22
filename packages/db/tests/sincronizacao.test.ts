/**
 * Dois aparelhos, um servidor, SQLite de verdade nos dois lados.
 *
 * O "servidor" aqui é a mesma função de mesclagem que `scripts/servidor-sync.ts`
 * executa — o que o teste cobre é o ciclo inteiro: gerar instantâneo, mesclar,
 * aplicar no banco do outro aparelho e convergir.
 */
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { diferenca, instantaneoVazio, mesclar, type Instantaneo } from '@drmoo/sync';
import {
  aplicarLinhas,
  consultar,
  definirBackend,
  instantaneoLocal,
  listarRebanho,
  obterAnimal,
  salvarAnimal,
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

/** Troca o aparelho ativo: cada um tem o seu próprio banco. */
let aparelhoA: BackendSQLite;
let aparelhoB: BackendSQLite;
let servidor: Instantaneo;

function usar(aparelho: BackendSQLite): void {
  definirBackend(aparelho);
}

/** Uma sincronização completa do aparelho ativo contra o servidor. */
async function sincronizarAparelho(nome: string) {
  const local = await instantaneoLocal(nome);
  servidor = mesclar(servidor, local);
  return aplicarLinhas(diferenca(local, servidor));
}

describe('sincronização entre dois aparelhos da mesma rede', () => {
  beforeEach(() => {
    aparelhoA = backendNode();
    aparelhoB = backendNode();
    servidor = instantaneoVazio('servidor');
  });

  it('leva o animal cadastrado num aparelho para o outro', async () => {
    usar(aparelhoA);
    await salvarAnimal({ brinco: '001', nome: 'Mimosa', categoria: 'vaca_lactacao', sexo: 'F' });
    await sincronizarAparelho('celular do Sr. João');

    usar(aparelhoB);
    const resultado = await sincronizarAparelho('celular do retireiro');

    expect(resultado.conflitos).toEqual([]);
    expect(resultado.aplicadas.animal).toBe(1);
    const rebanho = await listarRebanho();
    expect(rebanho.map((a) => a.brinco)).toEqual(['001']);
  });

  it('a edição mais recente prevalece nos dois aparelhos', async () => {
    usar(aparelhoA);
    const id = await salvarAnimal({ brinco: '002', nome: 'Estrela', categoria: 'novilha', sexo: 'F' });
    await sincronizarAparelho('A');

    usar(aparelhoB);
    await sincronizarAparelho('B');
    // Edição feita no aparelho B, depois do que A conhecia.
    await salvarAnimal({ id, brinco: '002', nome: 'Estrela da Serra', categoria: 'novilha', sexo: 'F' });
    await sincronizarAparelho('B');

    usar(aparelhoA);
    await sincronizarAparelho('A');

    expect((await obterAnimal(id))?.nome).toBe('Estrela da Serra');
  });

  it('sincronizar de novo sem mudanças não grava nada', async () => {
    usar(aparelhoA);
    await salvarAnimal({ brinco: '003', categoria: 'vaca_seca', sexo: 'F' });
    await sincronizarAparelho('A');

    const segunda = await sincronizarAparelho('A');

    expect(segunda.aplicadas).toEqual({});
    expect(segunda.conflitos).toEqual([]);
  });

  it('brinco repetido criado nos dois aparelhos vira conflito, sem derrubar o resto', async () => {
    usar(aparelhoA);
    await salvarAnimal({ brinco: '010', nome: 'Lua', categoria: 'vaca_lactacao', sexo: 'F' });
    await sincronizarAparelho('A');

    usar(aparelhoB);
    // O mesmo brinco cadastrado à parte, antes de qualquer sincronização: ids diferentes.
    await salvarAnimal({ brinco: '010', nome: 'Luna', categoria: 'vaca_lactacao', sexo: 'F' });
    await salvarAnimal({ brinco: '011', nome: 'Aurora', categoria: 'novilha', sexo: 'F' });
    const resultado = await sincronizarAparelho('B');

    expect(resultado.conflitos).toHaveLength(1);
    expect(resultado.conflitos[0]?.tabela).toBe('animal');
    expect(resultado.conflitos[0]?.motivo).toMatch(/brinco/i);
    // O animal sem conflito entrou mesmo assim.
    expect((await listarRebanho()).map((a) => a.brinco).sort()).toEqual(['010', '011']);
  });
  it('recebe filiação em ordem inversa na mesma sincronização', async () => {
    usar(aparelhoA);
    const filha = await salvarAnimal({ brinco: 'filha', categoria: 'novilha', sexo: 'F' });
    const mae = await salvarAnimal({ brinco: 'mae', categoria: 'vaca_seca', sexo: 'F' });
    const avo = await salvarAnimal({ brinco: 'avo', categoria: 'vaca_seca', sexo: 'F' });
    await salvarAnimal({ id: filha, brinco: 'filha', mae_id: mae });
    await salvarAnimal({ id: mae, brinco: 'mae', mae_id: avo });
    const foto = await instantaneoLocal();
    const linhas = [filha, mae, avo].map((id) => foto.tabelas.animal!.find((a) => a.id === id)!);
    usar(aparelhoB);
    const resultado = await aplicarLinhas({ animal: linhas });
    expect(resultado).toEqual({ aplicadas: { animal: 3 }, removidas: {}, conflitos: [] });
    expect((await obterAnimal(filha))?.mae_id).toBe(mae);
    expect((await obterAnimal(mae))?.mae_id).toBe(avo);
    expect(await consultar('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('relata filiação inexistente sem gravar órfãos ou impedir animais válidos', async () => {
    usar(aparelhoA);
    await salvarAnimal({ brinco: 'filha', categoria: 'novilha', sexo: 'F' });
    await salvarAnimal({ brinco: 'valido', categoria: 'novilha', sexo: 'F' });
    const foto = await instantaneoLocal();
    foto.tabelas.animal!.find((a) => a.brinco === 'filha')!.mae_id = 'ausente';
    usar(aparelhoB);
    const resultado = await aplicarLinhas(foto.tabelas);
    expect(resultado.aplicadas.animal).toBe(1);
    expect(resultado.conflitos).toHaveLength(1);
    expect(resultado.conflitos[0]?.motivo).toMatch(/FOREIGN KEY/);
    expect((await listarRebanho()).map((a) => a.brinco)).toEqual(['valido']);
    expect(await consultar('PRAGMA foreign_key_check')).toEqual([]);
  });

});
