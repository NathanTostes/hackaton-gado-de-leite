/**
 * Busca e filtros do rebanho contra um SQLite real.
 *
 * A busca é o que o produtor usa o dia inteiro: se "holandes" não achar
 * "Holandês", ou se dois termos virarem um OU, a tela mente para quem está no
 * curral. Por isso cada regra tem teste.
 */
import { DatabaseSync } from 'node:sqlite';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  definirBackend,
  listarLotes,
  listarRebanho,
  normalizarBusca,
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

function anosAtras(anos: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - anos);
  return d.toISOString().slice(0, 10);
}

describe('busca e filtros do rebanho', () => {
  beforeAll(async () => {
    definirBackend(backendNode());
    await salvarAnimal({
      brinco: '101',
      nome: 'Mimosa',
      categoria: 'vaca_lactacao',
      sexo: 'F',
      raca: 'Holandês',
      pelagem_sinal: 'Malhada',
      data_nascimento: anosAtras(5),
      procedencia: 'Fazenda São José',
    });
    await salvarAnimal({
      brinco: '102',
      nome: 'Estrela',
      categoria: 'vaca_seca',
      sexo: 'F',
      raca: 'Girolando',
      data_nascimento: anosAtras(4),
      observacoes: 'Comprada em leilão',
    });
    await salvarAnimal({
      brinco: '201',
      nome: 'Trovão',
      categoria: 'touro',
      sexo: 'M',
      raca: 'Holandês',
      data_nascimento: anosAtras(3),
    });
    await salvarAnimal({
      brinco: '301',
      nome: 'Luna',
      categoria: 'bezerra_1_2_anos',
      sexo: 'F',
      data_nascimento: anosAtras(1),
    });
  });

  it('ignora acento e caixa', async () => {
    const semAcento = await listarRebanho({ busca: 'holandes' });
    const comAcento = await listarRebanho({ busca: 'HOLANDÊS' });
    expect(semAcento.map((a) => a.brinco)).toEqual(['101', '201']);
    expect(comAcento.map((a) => a.brinco)).toEqual(['101', '201']);
  });

  it('exige que todas as palavras apareçam, não qualquer uma', async () => {
    const duasPalavras = await listarRebanho({ busca: 'holandes malhada' });
    expect(duasPalavras.map((a) => a.brinco)).toEqual(['101']);

    const semCasar = await listarRebanho({ busca: 'holandes girolando' });
    expect(semCasar).toHaveLength(0);
  });

  it('procura também nos campos de cadastro, não só no nome e no brinco', async () => {
    expect((await listarRebanho({ busca: 'sao jose' })).map((a) => a.brinco)).toEqual(['101']);
    expect((await listarRebanho({ busca: 'leilao' })).map((a) => a.brinco)).toEqual(['102']);
    expect((await listarRebanho({ busca: 'touro' })).map((a) => a.brinco)).toEqual(['201']);
  });

  it('filtra por sexo e por faixa de idade', async () => {
    expect((await listarRebanho({ sexo: 'M' })).map((a) => a.brinco)).toEqual(['201']);

    const jovens = await listarRebanho({ idadeMaxMeses: 24 });
    expect(jovens.map((a) => a.brinco)).toEqual(['301']);

    const maduras = await listarRebanho({ idadeMinMeses: 48 });
    expect(maduras.map((a) => a.brinco).sort()).toEqual(['101', '102']);
  });

  it('calcula a idade em meses a partir da data de nascimento', async () => {
    const [mimosa] = await listarRebanho({ busca: 'mimosa' });
    expect(mimosa?.idade_meses).toBeGreaterThanOrEqual(59);
    expect(mimosa?.idade_meses).toBeLessThanOrEqual(61);
  });

  it('ordena pelos campos novos, nos dois sentidos', async () => {
    const porNome = await listarRebanho({ ordenarPor: 'nome' });
    expect(porNome.map((a) => a.nome)).toEqual(['Estrela', 'Luna', 'Mimosa', 'Trovão']);

    const porIdadeDesc = await listarRebanho({ ordenarPor: 'idade', decrescente: true });
    expect(porIdadeDesc.map((a) => a.brinco)).toEqual(['101', '102', '201', '301']);
  });

  it('combina busca com filtro e devolve vazio quando nada atende a tudo', async () => {
    const nada = await listarRebanho({ busca: 'holandes', categorias: ['bezerra_1_2_anos'] });
    expect(nada).toHaveLength(0);

    const uma = await listarRebanho({ busca: 'holandes', sexo: 'F' });
    expect(uma.map((a) => a.brinco)).toEqual(['101']);
  });

  it('lista os lotes com a contagem de animais', async () => {
    expect(await listarLotes()).toEqual([]);
  });

  it('normaliza o termo digitado do mesmo jeito que o SQL', () => {
    expect(normalizarBusca('  Holandês ')).toBe('holandes');
    expect(normalizarBusca('AÇÃO')).toBe('acao');
  });
});
