/**
 * Conversão planilha ↔ banco.
 *
 * É aqui que a planilha preenchida à mão encontra o esquema. Quem digita
 * escreve "15/03/2026", "1.234,56" e "Sim"; o banco quer ISO, ponto decimal e
 * 0/1. Cada regra de tradução tem teste, porque errar em silêncio aqui
 * significa gravar dado errado na véspera da apresentação.
 */
import { describe, expect, it } from 'vitest';
import {
  ABAS,
  ABA_POR_NOME,
  abaParaBanco,
  bancoParaAba,
  normalizarBooleano,
  normalizarData,
  normalizarNumero,
  type AbaPlanilha,
  type ContextoConversao,
} from '../src/index';

function contexto(parcial: Partial<ContextoConversao> = {}): ContextoConversao {
  let contador = 0;
  return {
    animais: new Map([['101', 'ani_1']]),
    lotes: new Map([['Vacas em lactação', 'lot_1']]),
    medicamentos: new Map([['Mastifin', 'med_1']]),
    vacinas: new Map([['Aftosa', 'vac_1']]),
    novoId: (prefixo) => `${prefixo}_${++contador}`,
    agora: () => '2026-10-22T09:00:00.000Z',
    ...parcial,
  };
}

const ANIMAIS = ABA_POR_NOME.get('Animais') as AbaPlanilha;
const CONTROLE = ABA_POR_NOME.get('ControleLeiteiro') as AbaPlanilha;
const TRATAMENTOS = ABA_POR_NOME.get('Tratamentos') as AbaPlanilha;

describe('normalização de valores', () => {
  it('entende as três formas de data que aparecem numa planilha', () => {
    expect(normalizarData('2026-03-15')).toBe('2026-03-15');
    expect(normalizarData('15/03/2026')).toBe('2026-03-15');
    expect(normalizarData('5/3/26')).toBe('2026-03-05');
    expect(normalizarData(new Date('2026-03-15T00:00:00Z'))).toBe('2026-03-15');
    // Serial do Excel: 15/03/2026.
    expect(normalizarData(46096)).toBe('2026-03-15');
  });

  it('devolve nulo para data vazia ou sem sentido', () => {
    expect(normalizarData('')).toBeNull();
    expect(normalizarData(null)).toBeNull();
    expect(normalizarData('quinta-feira')).toBeNull();
  });

  it('entende número em português e em inglês', () => {
    expect(normalizarNumero('1.234,56')).toBeCloseTo(1234.56);
    expect(normalizarNumero('1234.56')).toBeCloseTo(1234.56);
    expect(normalizarNumero('R$ 40,00')).toBeCloseTo(40);
    expect(normalizarNumero(9.5)).toBe(9.5);
    expect(normalizarNumero('')).toBeNull();
    expect(normalizarNumero('muito')).toBeNull();
  });

  it('aceita as grafias de sim e não que as pessoas usam', () => {
    for (const sim of ['sim', 'SIM', 's', 'x', 'true', '1', true, 1]) {
      expect(normalizarBooleano(sim)).toBe(1);
    }
    for (const nao of ['não', 'nao', 'n', 'false', '0', false, 0]) {
      expect(normalizarBooleano(nao)).toBe(0);
    }
    expect(normalizarBooleano('talvez')).toBeNull();
  });
});

describe('planilha → banco', () => {
  it('traduz cabeçalhos, resolve lote pelo nome e carimba id e datas', () => {
    const { linhas, erros } = abaParaBanco(
      ANIMAIS,
      [
        {
          Brinco: '202',
          Nome: 'Estrela',
          Categoria: 'vaca_lactacao',
          'Sexo (F/M)': 'F',
          Nascimento: '15/03/2021',
          Lote: 'Vacas em lactação',
        },
      ],
      contexto(),
    );

    expect(erros).toEqual([]);
    expect(linhas[0]).toMatchObject({
      brinco: '202',
      nome: 'Estrela',
      categoria: 'vaca_lactacao',
      sexo: 'F',
      data_nascimento: '2021-03-15',
      lote_id: 'lot_1',
      created_at: '2026-10-22T09:00:00.000Z',
      updated_at: '2026-10-22T09:00:00.000Z',
    });
    expect(String(linhas[0]?.id)).toMatch(/^anim_\d+$/);
  });

  it('reaproveita o id de quem já existe, em vez de duplicar', () => {
    const { linhas } = abaParaBanco(
      ANIMAIS,
      [{ Brinco: '101', Categoria: 'novilha', 'Sexo (F/M)': 'F' }],
      contexto({ idExistente: (tabela, linha) => (tabela === 'animal' && linha.brinco === '101' ? 'ani_1' : undefined) }),
    );

    expect(linhas[0]?.id).toBe('ani_1');
  });

  it('ignora linha em branco e não a transforma em registro fantasma', () => {
    const { linhas, erros } = abaParaBanco(
      ANIMAIS,
      [{ Brinco: '', Nome: '', Categoria: '', 'Sexo (F/M)': '' }, { Brinco: '  ' }],
      contexto(),
    );

    expect(linhas).toEqual([]);
    expect(erros).toEqual([]);
  });

  it('aponta campo obrigatório vazio com a linha do Excel', () => {
    const { erros } = abaParaBanco(
      ANIMAIS,
      [{ Brinco: '301', Categoria: 'novilha', 'Sexo (F/M)': 'F' }, { Brinco: '', Categoria: 'novilha', 'Sexo (F/M)': 'F', Nome: 'Sem brinco' }],
      contexto(),
    );

    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatchObject({ aba: 'Animais', linha: 3, coluna: 'Brinco' });
    expect(erros[0]?.motivo).toMatch(/obrigatório/);
  });

  it('recusa valor fora do domínio e diz quais valem', () => {
    const { erros } = abaParaBanco(
      ANIMAIS,
      [{ Brinco: '401', Categoria: 'vaca_voadora', 'Sexo (F/M)': 'F' }],
      contexto(),
    );

    expect(erros[0]?.motivo).toMatch(/não aceito/);
    expect(erros[0]?.motivo).toMatch(/vaca_lactacao/);
  });

  it('recusa referência que não existe, dizendo onde cadastrar', () => {
    const { linhas, erros } = abaParaBanco(
      TRATAMENTOS,
      [{ Brinco: '999', Início: '2026-10-01' }],
      contexto(),
    );

    expect(linhas).toEqual([]);
    expect(erros[0]?.motivo).toMatch(/não existe \(animal\)/);
  });

  it('calcula as colunas derivadas (o total de litros do dia)', () => {
    const { linhas } = abaParaBanco(
      CONTROLE,
      [{ Brinco: '101', Data: '2026-10-01', 'Litros da manhã': '9,5', 'Litros da tarde': 7 }],
      contexto(),
    );

    expect(linhas[0]?.litros_total).toBeCloseTo(16.5);
  });

  it('célula vazia não vira NULL: a coluna fica de fora e o padrão do banco vale', () => {
    const { linhas } = abaParaBanco(
      ANIMAIS,
      [{ Brinco: '501', Categoria: 'novilha', 'Sexo (F/M)': 'F' }],
      contexto(),
    );

    expect(linhas[0]).not.toHaveProperty('status');
    expect(linhas[0]).not.toHaveProperty('observacoes');
  });

  it('erro numa linha não derruba as outras', () => {
    const { linhas, erros } = abaParaBanco(
      ANIMAIS,
      [
        { Brinco: '601', Categoria: 'novilha', 'Sexo (F/M)': 'F' },
        { Brinco: '602', Categoria: 'novilha', 'Sexo (F/M)': 'F', Nascimento: 'ontem' },
        { Brinco: '603', Categoria: 'novilha', 'Sexo (F/M)': 'F' },
      ],
      contexto(),
    );

    expect(linhas.map((l) => l.brinco)).toEqual(['601', '603']);
    expect(erros).toHaveLength(1);
    expect(erros[0]?.motivo).toMatch(/data inválida/);
  });
});

describe('banco → planilha', () => {
  it('devolve o brinco e o nome do lote, nunca o id interno', () => {
    const linhas = bancoParaAba(
      ANIMAIS,
      [{ id: 'ani_1', brinco: '101', nome: 'Mimosa', categoria: 'vaca_lactacao', sexo: 'F', lote_id: 'lot_1' }],
      {
        animais: new Map([['ani_1', '101']]),
        lotes: new Map([['lot_1', 'Vacas em lactação']]),
        medicamentos: new Map(),
        vacinas: new Map(),
      },
    );

    expect(linhas[0]?.Lote).toBe('Vacas em lactação');
    expect(linhas[0]?.Brinco).toBe('101');
    expect(Object.values(linhas[0] ?? {})).not.toContain('lot_1');
  });

  it('escreve sim/não e data curta, e deixa vazio o que é nulo', () => {
    const coberturas = ABA_POR_NOME.get('Coberturas') as AbaPlanilha;
    const linhas = bancoParaAba(
      coberturas,
      [
        {
          id: 'cob_1',
          animal_id: 'ani_1',
          data: '2026-10-01T00:00:00.000Z',
          confirmada_prenhe: 1,
          touro_nome: null,
        },
      ],
      { animais: new Map([['ani_1', '101']]), lotes: new Map(), medicamentos: new Map(), vacinas: new Map() },
    );

    expect(linhas[0]?.['Prenhez confirmada (sim/não)']).toBe('sim');
    expect(linhas[0]?.Data).toBe('2026-10-01');
    expect(linhas[0]?.['Touro / sêmen']).toBe('');
  });
});

describe('mapa das abas', () => {
  it('toda aba tem nome curto o bastante para o Excel e colunas sem título repetido', () => {
    for (const aba of ABAS) {
      expect(aba.nome.length).toBeLessThanOrEqual(31);
      const titulos = aba.colunas.map((c) => c.titulo);
      expect(new Set(titulos).size).toBe(titulos.length);
      const colunas = aba.colunas.map((c) => c.coluna);
      expect(new Set(colunas).size).toBe(colunas.length);
    }
  });

  it('nenhuma aba expõe id, created_at ou updated_at para quem preenche', () => {
    for (const aba of ABAS) {
      for (const coluna of aba.colunas) {
        expect(['id', 'created_at', 'updated_at', 'deleted_at']).not.toContain(coluna.coluna);
      }
    }
  });
});
