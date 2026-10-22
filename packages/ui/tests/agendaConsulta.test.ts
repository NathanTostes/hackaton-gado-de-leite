import { describe, expect, it } from 'vitest';
import { Sessao } from '@drmoo/engine';
import { baseCompilada } from '@drmoo/knowledge';
import { compromissosDaAgenda, tipoDaAcao } from '../../../apps/mobile/src/agendaConsulta';

describe('agenda da consulta', () => {
  it('deduplica condutas e preserva data e tipo escolhidos', () => {
    const parecer = new Sessao(baseCompilada).encerrar();
    const hipotese = { conduta: ['Repetir CMT', 'Repetir CMT', 'Orientação concluída'] } as typeof parecer.hipoteses[number];
    parecer.hipoteses = [hipotese];
    expect(compromissosDaAgenda(parecer, ['Orientação concluída'], {
      'Repetir CMT': { data: '2026-12-01', tipo: 'exame_cmt' },
      'Vacina indicada': { extra: true, tipo: 'vacinacao', data: '2027-01-20' },
      'Ação de hipótese removida': { data: '2026-12-05' },
    })).toEqual([
      { titulo: 'Repetir CMT', data: '2026-12-01', tipo: 'exame_cmt' },
      { titulo: 'Vacina indicada', data: '2027-01-20', tipo: 'vacinacao' },
    ]);
  });
  it('respeita ações desmarcadas', () => {
    const parecer = new Sessao(baseCompilada).encerrar();
    expect(compromissosDaAgenda(parecer, [], { 'Remédio informado': { extra: true, agendar: false } })).toEqual([]);
  });
  it('classifica lembretes sem gerar medicamentos, doses ou intervalos', () => {
    expect(tipoDaAcao('Vacina informada')).toBe('vacinacao');
    expect(tipoDaAcao('Medicamento informado')).toBe('medicacao');
    expect(tipoDaAcao('Coletar CCS')).toBe('exame_ccs');
    expect(tipoDaAcao('Limpar instalações')).toBe('manejo');
  });
});
