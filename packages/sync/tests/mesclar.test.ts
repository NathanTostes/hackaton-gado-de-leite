/**
 * A sincronização só serve se for determinística: dois aparelhos que trocam
 * dados em ordens diferentes precisam terminar com a mesma base.
 */
import { describe, expect, it } from 'vitest';
import {
  contarLinhas,
  diferenca,
  instantaneoVazio,
  mesclar,
  normalizarEndereco,
  perdedoresDaChaveNatural,
  validarInstantaneo,
  type Instantaneo,
  type Linha,
} from '../src/index';

function instantaneo(dispositivo: string, tabelas: Record<string, Linha[]>, geradoEm = '2026-10-21T10:00:00.000Z'): Instantaneo {
  return { ...instantaneoVazio(dispositivo, geradoEm), tabelas: { ...instantaneoVazio(dispositivo).tabelas, ...tabelas } };
}

const vaca = (id: string, nome: string, updated: string): Linha => ({
  id,
  brinco: id,
  nome,
  categoria: 'vaca_lactacao',
  sexo: 'F',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: updated,
  deleted_at: null,
});

describe('mesclagem de instantâneos', () => {
  it('une registros que só existem em um dos aparelhos', () => {
    const a = instantaneo('servidor', { animal: [vaca('A1', 'Mimosa', '2026-10-01T00:00:00.000Z')] });
    const b = instantaneo('celular', { animal: [vaca('B1', 'Estrela', '2026-10-02T00:00:00.000Z')] });

    const r = mesclar(a, b);

    expect(r.tabelas.animal?.map((l) => l.id)).toEqual(['A1', 'B1']);
  });

  it('a escrita mais recente vence', () => {
    const antiga = instantaneo('servidor', { animal: [vaca('A1', 'Mimosa', '2026-10-01T00:00:00.000Z')] });
    const nova = instantaneo('celular', { animal: [vaca('A1', 'Mimosa II', '2026-10-05T00:00:00.000Z')] });

    expect(mesclar(antiga, nova).tabelas.animal?.[0]?.nome).toBe('Mimosa II');
    expect(mesclar(nova, antiga).tabelas.animal?.[0]?.nome).toBe('Mimosa II');
  });

  it('a exclusão lógica mais recente vence a edição antiga', () => {
    const excluida = { ...vaca('A1', 'Mimosa', '2026-10-09T00:00:00.000Z'), deleted_at: '2026-10-09T00:00:00.000Z' };
    const editada = vaca('A1', 'Mimosa editada', '2026-10-08T00:00:00.000Z');

    const r = mesclar(instantaneo('a', { animal: [editada] }), instantaneo('b', { animal: [excluida] }));

    expect(r.tabelas.animal?.[0]?.deleted_at).toBe('2026-10-09T00:00:00.000Z');
  });

  it('é comutativa: a ordem da troca não muda o resultado', () => {
    const a = instantaneo('a', {
      animal: [vaca('A1', 'Mimosa', '2026-10-03T00:00:00.000Z'), vaca('C1', 'Lua', '2026-10-01T00:00:00.000Z')],
    });
    const b = instantaneo('b', {
      animal: [vaca('A1', 'Mimosa II', '2026-10-04T00:00:00.000Z'), vaca('B1', 'Estrela', '2026-10-02T00:00:00.000Z')],
    });

    const ab = mesclar(a, b).tabelas.animal;
    const ba = mesclar(b, a).tabelas.animal;

    expect(ab).toEqual(ba);
  });

  it('empate em updated_at também converge nos dois sentidos', () => {
    const mesmoInstante = '2026-10-04T00:00:00.000Z';
    const a = instantaneo('a', { animal: [vaca('A1', 'Mimosa', mesmoInstante)] });
    const b = instantaneo('b', { animal: [vaca('A1', 'Estrela', mesmoInstante)] });

    expect(mesclar(a, b).tabelas.animal).toEqual(mesclar(b, a).tabelas.animal);
  });

  it('é idempotente: sincronizar duas vezes não muda nada', () => {
    const a = instantaneo('a', { animal: [vaca('A1', 'Mimosa', '2026-10-03T00:00:00.000Z')] });
    const b = instantaneo('b', { animal: [vaca('B1', 'Estrela', '2026-10-02T00:00:00.000Z')] });

    const uma = mesclar(a, b);
    const duas = mesclar(uma, b);

    expect(duas.tabelas).toEqual(uma.tabelas);
    expect(diferenca(uma, duas)).toEqual({});
  });

  it('registros imutáveis não são sobrescritos pelo outro aparelho', () => {
    const fato = (valor: string): Linha => ({ id: 'F1', atendimento_id: 'AT1', variavel: 'febre', valor, cf: 1, origem: 'usuario' });
    const r = mesclar(instantaneo('a', { fato_registrado: [fato('sim')] }), instantaneo('b', { fato_registrado: [fato('nao')] }));

    expect(r.tabelas.fato_registrado).toEqual([fato('sim')]);
  });

  it('a diferença traz só o que mudou', () => {
    const local = instantaneo('a', { animal: [vaca('A1', 'Mimosa', '2026-10-01T00:00:00.000Z')] });
    const remoto = instantaneo('b', {
      animal: [vaca('A1', 'Mimosa', '2026-10-01T00:00:00.000Z'), vaca('B1', 'Estrela', '2026-10-02T00:00:00.000Z')],
    });

    expect(diferenca(local, remoto)).toEqual({ animal: [vaca('B1', 'Estrela', '2026-10-02T00:00:00.000Z')] });
  });

  it('conta as linhas de todas as tabelas', () => {
    const i = instantaneo('a', {
      animal: [vaca('A1', 'Mimosa', '2026-10-01T00:00:00.000Z')],
      lote: [{ id: 'L1', nome: 'Lactação', created_at: 'x', updated_at: 'x' }],
    });
    expect(contarLinhas(i)).toBe(2);
  });
});

describe('colapso por chave natural', () => {
  const ordenha = (id: string, data: string, manha: number, updated: string): Linha => ({
    id,
    animal_id: 'A1',
    data,
    litros_manha: manha,
    litros_tarde: 0,
    litros_total: manha,
    observacoes: null,
    created_at: updated,
    updated_at: updated,
  });

  it('o mesmo dia lançado nos dois aparelhos vira uma linha só', () => {
    const a = instantaneo('A', { controle_leiteiro: [ordenha('c1', '2026-10-20', 11, '2026-10-20T07:00:00.000Z')] });
    const b = instantaneo('B', { controle_leiteiro: [ordenha('c2', '2026-10-20', 9, '2026-10-20T18:00:00.000Z')] });

    const r = mesclar(a, b);

    expect(r.tabelas.controle_leiteiro?.map((l) => l.id)).toEqual(['c2']);
  });

  it('dias diferentes do mesmo animal continuam lado a lado', () => {
    const a = instantaneo('A', {
      controle_leiteiro: [
        ordenha('c1', '2026-10-20', 11, '2026-10-20T07:00:00.000Z'),
        ordenha('c2', '2026-10-21', 10, '2026-10-21T07:00:00.000Z'),
      ],
    });

    const r = mesclar(a, instantaneoVazio('B'));

    expect(r.tabelas.controle_leiteiro?.map((l) => l.id)).toEqual(['c1', 'c2']);
  });

  it('vale também para a produção da propriedade, que tem UNIQUE na data', () => {
    const linha = (id: string, updated: string): Linha => ({
      id,
      data: '2026-10-20',
      litros_total: 100,
      created_at: updated,
      updated_at: updated,
    });
    const a = instantaneo('A', { producao_propriedade: [linha('p1', '2026-10-20T10:00:00.000Z')] });
    const b = instantaneo('B', { producao_propriedade: [linha('p2', '2026-10-20T11:00:00.000Z')] });

    expect(mesclar(a, b).tabelas.producao_propriedade?.map((l) => l.id)).toEqual(['p2']);
  });

  it('o vencedor não depende da ordem em que os aparelhos sincronizam', () => {
    const a = instantaneo('A', { controle_leiteiro: [ordenha('c1', '2026-10-20', 11, '2026-10-20T07:00:00.000Z')] });
    const b = instantaneo('B', { controle_leiteiro: [ordenha('c2', '2026-10-20', 9, '2026-10-20T07:00:00.000Z')] });

    expect(mesclar(a, b).tabelas.controle_leiteiro).toEqual(mesclar(b, a).tabelas.controle_leiteiro);
  });

  it('brinco repetido não é colapsado: animal tem histórico e filiação', () => {
    const a = instantaneo('A', { animal: [vaca('A1', 'Mimosa', '2026-10-01T00:00:00.000Z')] });
    const b = instantaneo('B', { animal: [{ ...vaca('B1', 'Mimosa', '2026-10-02T00:00:00.000Z'), brinco: 'A1' }] });

    expect(mesclar(a, b).tabelas.animal).toHaveLength(2);
  });

  it('aponta a linha que o aparelho precisa apagar', () => {
    const local = instantaneo('A', { controle_leiteiro: [ordenha('c1', '2026-10-20', 11, '2026-10-20T07:00:00.000Z')] });
    const mesclado = instantaneo('B', { controle_leiteiro: [ordenha('c2', '2026-10-20', 9, '2026-10-20T18:00:00.000Z')] });

    expect(perdedoresDaChaveNatural(local, mesclado)).toEqual({ controle_leiteiro: ['c1'] });
  });

  it('não manda apagar nada quando a linha local sobreviveu', () => {
    const local = instantaneo('A', { controle_leiteiro: [ordenha('c1', '2026-10-20', 11, '2026-10-20T07:00:00.000Z')] });

    expect(perdedoresDaChaveNatural(local, mesclar(local, instantaneoVazio('B')))).toEqual({});
  });
});

describe('validação do que chega pela rede', () => {
  it('recusa protocolo de outra versão', () => {
    expect(() => validarInstantaneo({ versao: 99, tabelas: {} })).toThrow(/protocolo/);
  });

  it('recusa linha sem id', () => {
    expect(() => validarInstantaneo({ versao: 1, tabelas: { animal: [{ nome: 'sem id' }] } })).toThrow(/sem id/);
  });

  it('completa as tabelas ausentes', () => {
    const i = validarInstantaneo({ versao: 1, dispositivo: 'celular', tabelas: {} });
    expect(i.tabelas.animal).toEqual([]);
    expect(i.dispositivo).toBe('celular');
  });
});

describe('endereço do servidor', () => {
  it('completa esquema e porta', () => {
    expect(normalizarEndereco('192.168.0.10')).toBe('http://192.168.0.10:8787');
    expect(normalizarEndereco(' http://192.168.0.10:9000/ ')).toBe('http://192.168.0.10:9000');
  });

  it('exige um endereço', () => {
    expect(() => normalizarEndereco('   ')).toThrow(/endereço/i);
  });
});
