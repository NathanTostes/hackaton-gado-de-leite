/**
 * O que a tela de rebanho PEDE ao banco.
 *
 * Se um chip ligado não vira cláusula na consulta, a lista mente para quem está
 * no curral — e mentir aqui é pior do que não filtrar. Por isso a tradução
 * estado → filtro é função pura, e tem teste.
 */
import { describe, expect, it } from 'vitest';
import {
  DIAS_PARTO_PROXIMO,
  FILTROS_VAZIOS,
  alternarNaLista,
  contarAtivos,
  idadeLegivel,
  montarFiltros,
  paraNumero,
  resumirLista,
} from '../../../apps/mobile/src/telas/filtrosRebanho';

describe('tradução do estado da tela para o filtro da consulta', () => {
  it('sem nada ligado, a consulta não carrega cláusula nenhuma', () => {
    const filtros = montarFiltros(FILTROS_VAZIOS, '', 'brinco', false);

    expect(filtros.categorias).toBeUndefined();
    expect(filtros.status).toBeUndefined();
    expect(filtros.sexo).toBeUndefined();
    expect(filtros.emCarencia).toBeUndefined();
    expect(filtros.cmtMinimo).toBeUndefined();
    expect(filtros.delMin).toBeUndefined();
    expect(filtros.partoEmDias).toBeUndefined();
    expect(filtros.ordenarPor).toBe('brinco');
    expect(filtros.decrescente).toBe(false);
  });

  it('lista vazia vira undefined, e não uma lista que não filtra nada', () => {
    const filtros = montarFiltros({ ...FILTROS_VAZIOS, categorias: [], status: [] }, '', 'brinco', false);
    expect('categorias' in filtros).toBe(true);
    expect(filtros.categorias).toBeUndefined();
  });

  it('leva adiante o que o usuário ligou', () => {
    const filtros = montarFiltros(
      {
        ...FILTROS_VAZIOS,
        categorias: ['vaca_lactacao'],
        status: ['em_tratamento', 'quarentena'],
        sexo: 'F',
        loteId: 'lot_1',
        cmtMinimo: '2',
        peitoPerdido: true,
        emCarencia: true,
        prenhe: true,
        partoEm60: true,
      },
      'mimosa',
      'producao',
      true,
    );

    expect(filtros).toMatchObject({
      busca: 'mimosa',
      categorias: ['vaca_lactacao'],
      status: ['em_tratamento', 'quarentena'],
      sexo: 'F',
      loteId: 'lot_1',
      cmtMinimo: '2',
      peitoPerdido: true,
      emCarencia: true,
      prenhe: true,
      partoEmDias: DIAS_PARTO_PROXIMO,
      ordenarPor: 'producao',
      decrescente: true,
    });
  });

  it('as faixas aceitam vírgula e ignoram campo em branco', () => {
    const filtros = montarFiltros(
      { ...FILTROS_VAZIOS, delMin: '30', delMax: '', producaoMin: '12,5', idadeMax: '24' },
      '',
      'brinco',
      false,
    );

    expect(filtros.delMin).toBe(30);
    expect(filtros.delMax).toBeUndefined();
    expect(filtros.producaoMin).toBeCloseTo(12.5);
    expect(filtros.idadeMaxMeses).toBe(24);
    expect(filtros.idadeMinMeses).toBeUndefined();
  });

  it('texto que não é número não vira filtro', () => {
    expect(paraNumero('abc')).toBeUndefined();
    expect(paraNumero('   ')).toBeUndefined();
    expect(paraNumero('0')).toBe(0);
  });

  it('"sem lote" e "lote escolhido" são filtros diferentes', () => {
    expect(montarFiltros({ ...FILTROS_VAZIOS, semLote: true }, '', 'brinco', false).semLote).toBe(true);
    expect(montarFiltros({ ...FILTROS_VAZIOS, loteId: 'lot_1' }, '', 'brinco', false).semLote).toBeUndefined();
  });
});

describe('contador de filtros ativos', () => {
  it('começa em zero', () => {
    expect(contarAtivos(FILTROS_VAZIOS)).toBe(0);
  });

  it('soma cada item selecionado, cada campo preenchido e cada chave ligada', () => {
    expect(
      contarAtivos({
        ...FILTROS_VAZIOS,
        categorias: ['vaca_lactacao', 'novilha'], // 2
        status: ['em_carencia'], // 1
        sexo: 'F', // 1
        delMin: '30', // 1
        producaoMax: '20', // 1
        cmtMinimo: '3', // 1
        emCarencia: true, // 1
        prenhe: true, // 1
      }),
    ).toBe(9);
  });

  it('campo só com espaço não conta como filtro', () => {
    expect(contarAtivos({ ...FILTROS_VAZIOS, delMin: '   ' })).toBe(0);
  });
});

describe('seleção múltipla', () => {
  it('liga e desliga o mesmo item', () => {
    const uma = alternarNaLista<string>([], 'vaca_lactacao');
    expect(uma).toEqual(['vaca_lactacao']);
    expect(alternarNaLista(uma, 'vaca_lactacao')).toEqual([]);
  });

  it('acrescenta sem perder os anteriores', () => {
    expect(alternarNaLista(['a'], 'b')).toEqual(['a', 'b']);
  });
});

describe('idade escrita como o produtor fala', () => {
  it('meses até dois anos, anos depois disso', () => {
    expect(idadeLegivel(8)).toBe('8 m');
    expect(idadeLegivel(23)).toBe('23 m');
    expect(idadeLegivel(24)).toBe('2 a');
    expect(idadeLegivel(62)).toBe('5 a 2 m');
  });

  it('sem data de nascimento não inventa idade', () => {
    expect(idadeLegivel(null)).toBeNull();
    expect(idadeLegivel(-3)).toBeNull();
  });
});

describe('resumo da lista', () => {
  it('soma os litros e conta quem tem alerta', () => {
    const resumo = resumirLista([
      { producao_media_dia: 16.4, status: 'saudavel' },
      { producao_media_dia: 12.1, status: 'em_carencia' },
      { producao_media_dia: null, status: 'em_tratamento' },
    ]);

    expect(resumo?.litros).toBeCloseTo(28.5);
    expect(resumo?.comAlerta).toBe(2);
  });

  it('lista vazia não tem resumo', () => {
    expect(resumirLista([])).toBeNull();
  });
});
