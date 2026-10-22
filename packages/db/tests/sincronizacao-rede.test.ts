/**
 * Dois aparelhos conversando pela rede de verdade.
 *
 * Aqui não há atalho: o banco é SQLite real, o servidor é o mesmo
 * `criarServidor()` que `npm run sync` sobe, e a conversa passa por HTTP numa
 * porta efêmera. É o teste mais próximo do que acontece na propriedade — e o
 * que pega erro de endereço, de código e de gravação que o teste de unidade
 * não vê.
 */
import { DatabaseSync } from 'node:sqlite';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { criarServidor } from '../../sync/src/servidor';
import {
  configuracaoSync,
  consultar,
  definirBackend,
  executar,
  listarRebanho,
  registrarControleLeiteiro,
  salvarAnimal,
  salvarConfiguracaoSync,
  sincronizar,
  verificarServidor,
  type BackendSQLite,
} from '@drmoo/db';

const CODIGO = '135790';

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

let endereco = '';
let fechar: () => Promise<void>;
let aparelhoA: BackendSQLite;
let aparelhoB: BackendSQLite;

beforeEach(async () => {
  const { servidor } = criarServidor({ codigo: CODIGO, propriedade: 'Sítio Boa Esperança', arquivoEstado: null });
  await new Promise<void>((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  endereco = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  fechar = () => new Promise<void>((ok) => servidor.close(() => ok()));

  aparelhoA = backendNode();
  aparelhoB = backendNode();
});

afterEach(async () => {
  await fechar();
});

describe('sincronização pela rede, ponta a ponta', () => {
  it('encontra o servidor pelo endereço digitado', async () => {
    definirBackend(aparelhoA);

    const saude = await verificarServidor(endereco);

    expect(saude.servico).toBe('drmoo-sync');
    expect(saude.propriedade).toBe('Sítio Boa Esperança');
  });

  it('o animal cadastrado num aparelho chega ao outro', async () => {
    definirBackend(aparelhoA);
    await salvarAnimal({ brinco: '101', nome: 'Mimosa', categoria: 'vaca_lactacao', sexo: 'F' });
    const ida = await sincronizar({ endereco, codigo: CODIGO, dispositivo: 'celular do Sr. João' });

    definirBackend(aparelhoB);
    const volta = await sincronizar({ endereco, codigo: CODIGO, dispositivo: 'celular do retireiro' });

    expect(ida.conflitos).toEqual([]);
    expect(volta.aplicadas.animal).toBe(1);
    expect((await listarRebanho()).map((a) => a.nome)).toEqual(['Mimosa']);
    expect(volta.dispositivos.map((d) => d.nome)).toEqual(['celular do Sr. João', 'celular do retireiro']);
  });

  it('guarda endereço, código e nome do aparelho para a próxima vez', async () => {
    definirBackend(aparelhoA);
    await sincronizar({ endereco, codigo: CODIGO, dispositivo: 'tablet do veterinário' });

    const config = await configuracaoSync();

    expect(config.endereco).toBe(endereco);
    expect(config.codigo).toBe(CODIGO);
    expect(config.dispositivo).toBe('tablet do veterinário');
    expect(config.ultimaSincronizacao).not.toBeNull();
  });

  it('não guarda nada quando se pede para não lembrar', async () => {
    definirBackend(aparelhoA);
    await sincronizar({ endereco, codigo: CODIGO, dispositivo: 'emprestado', lembrar: false });

    expect((await configuracaoSync()).endereco).toBe('');
  });

  it('código errado falha com mensagem, e nada é gravado', async () => {
    definirBackend(aparelhoA);
    await salvarAnimal({ brinco: '201', categoria: 'novilha', sexo: 'F' });

    await expect(sincronizar({ endereco, codigo: '999999' })).rejects.toThrow(/código/i);
    expect((await configuracaoSync()).ultimaSincronizacao).toBeNull();
  });

  it('endereço inalcançável vira recado sobre a rede Wi-Fi', async () => {
    definirBackend(aparelhoA);

    await expect(sincronizar({ endereco: 'http://127.0.0.1:1', codigo: CODIGO })).rejects.toThrow(
      /mesma rede Wi-Fi/,
    );
  });

  it('sincronizar duas vezes seguidas não regrava nada', async () => {
    definirBackend(aparelhoA);
    await salvarAnimal({ brinco: '301', categoria: 'vaca_seca', sexo: 'F' });
    await sincronizar({ endereco, codigo: CODIGO, dispositivo: 'A' });

    const segunda = await sincronizar({ endereco, codigo: CODIGO, dispositivo: 'A' });

    expect(segunda.aplicadas).toEqual({});
    expect(segunda.conflitos).toEqual([]);
  });

  it('a edição feita no segundo aparelho volta para o primeiro', async () => {
    definirBackend(aparelhoA);
    const id = await salvarAnimal({ brinco: '401', nome: 'Estrela', categoria: 'novilha', sexo: 'F' });
    await sincronizar({ endereco, codigo: CODIGO, dispositivo: 'A' });

    definirBackend(aparelhoB);
    await sincronizar({ endereco, codigo: CODIGO, dispositivo: 'B' });
    await salvarAnimal({ id, brinco: '401', nome: 'Estrela da Serra', categoria: 'novilha', sexo: 'F' });
    await sincronizar({ endereco, codigo: CODIGO, dispositivo: 'B' });

    definirBackend(aparelhoA);
    await sincronizar({ endereco, codigo: CODIGO, dispositivo: 'A' });

    expect((await listarRebanho())[0]?.nome).toBe('Estrela da Serra');
  });

  it('a ordenha do mesmo dia lançada nos dois aparelhos não duplica a produção', async () => {
    definirBackend(aparelhoA);
    const id = await salvarAnimal({ brinco: '501', categoria: 'vaca_lactacao', sexo: 'F' });
    await sincronizar({ endereco, codigo: CODIGO, dispositivo: 'A' });
    definirBackend(aparelhoB);
    await sincronizar({ endereco, codigo: CODIGO, dispositivo: 'B' });

    // O retireiro lança a tarde no celular dele; o dono lança a manhã no dele,
    // offline. São dois ids diferentes para a mesma ordenha do dia 20.
    await registrarControleLeiteiro(id, '2026-10-20', 0, 9);
    await sincronizar({ endereco, codigo: CODIGO, dispositivo: 'B' });
    definirBackend(aparelhoA);
    await registrarControleLeiteiro(id, '2026-10-20', 11, 0);
    const resultado = await sincronizar({ endereco, codigo: CODIGO, dispositivo: 'A' });

    const emA = await consultar<{ litros_total: number }>('SELECT litros_total FROM controle_leiteiro', []);
    expect(emA).toEqual([{ litros_total: 11 }]);
    expect(resultado.conflitos).toEqual([]);

    // E o outro aparelho chega à mesma linha na sincronização seguinte.
    definirBackend(aparelhoB);
    const volta = await sincronizar({ endereco, codigo: CODIGO, dispositivo: 'B' });
    expect(volta.removidas).toEqual({ controle_leiteiro: 1 });
    expect(await consultar('SELECT litros_total FROM controle_leiteiro', [])).toEqual([{ litros_total: 11 }]);
  });

  it('produção da propriedade na mesma data converge em vez de conflitar para sempre', async () => {
    const lancar = (id: string, litros: number, quando: string) =>
      executar(
        `INSERT INTO producao_propriedade (id, data, litros_vendidos, litros_total, created_at, updated_at)
         VALUES (?, '2026-10-20', ?, ?, ?, ?)`,
        [id, litros, litros, quando, quando],
      );

    definirBackend(aparelhoA);
    await lancar('pa', 100, '2026-10-20T10:00:00.000Z');
    await sincronizar({ endereco, codigo: CODIGO, dispositivo: 'A' });

    definirBackend(aparelhoB);
    await lancar('pb', 120, '2026-10-20T11:00:00.000Z');
    const emB = await sincronizar({ endereco, codigo: CODIGO, dispositivo: 'B' });
    definirBackend(aparelhoA);
    const emA = await sincronizar({ endereco, codigo: CODIGO, dispositivo: 'A' });

    expect(emB.conflitos).toEqual([]);
    expect(emA.conflitos).toEqual([]);
    expect(await consultar('SELECT id, litros_total FROM producao_propriedade', [])).toEqual([
      { id: 'pb', litros_total: 120 },
    ]);
    definirBackend(aparelhoB);
    expect(await consultar('SELECT id FROM producao_propriedade', [])).toEqual([{ id: 'pb' }]);
  });

  it('o nome do aparelho sobrevive a uma troca de endereço', async () => {
    definirBackend(aparelhoA);
    await salvarConfiguracaoSync({ dispositivo: 'Celular da ordenha' });

    await sincronizar({ endereco, codigo: CODIGO });

    expect((await configuracaoSync()).dispositivo).toBe('Celular da ordenha');
  });
});
