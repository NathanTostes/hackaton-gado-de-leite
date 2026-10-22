/**
 * Panorama de diagnósticos: o rebanho adoece de mais coisas do que mastite, e
 * a tela de saúde precisa enxergar todas elas.
 */
import { DatabaseSync } from 'node:sqlite';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  definirBackend,
  panoramaDiagnosticos,
  salvarAnimal,
  salvarAtendimento,
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

function conclusao(id: string, rotulo: string, grupo: string, cf: number, bandeiraVermelha = false) {
  return { id, rotulo, grupo, cf, confianca: 'Provável', bandeiraVermelha };
}

async function atendimento(animalId: string, dataHora: string, conclusoes: unknown[]) {
  await salvarAtendimento({
    animal_id: animalId,
    data_hora: dataHora,
    queixa_principal: null,
    kb_versao: '1.0.0',
    engine_versao: '1.0.0',
    fatos_iniciais: '[]',
    respostas: '[]',
    conclusoes: JSON.stringify(conclusoes),
    traco: '[]',
    conduta_check: null,
    motivo_parada: 'conclusao',
    status: 'concluido',
    observacoes: null,
  });
}

function diasAtras(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString();
}

describe('panorama de diagnósticos', () => {
  let vaca = '';
  let bezerra = '';

  beforeAll(async () => {
    definirBackend(backendNode());
    vaca = await salvarAnimal({ brinco: '401', nome: 'Mimosa', categoria: 'vaca_lactacao', sexo: 'F' });
    bezerra = await salvarAnimal({ brinco: '402', nome: 'Luna', categoria: 'bezerra_1_2_anos', sexo: 'F' });

    await atendimento(vaca, diasAtras(10), [conclusao('cetose', 'Cetose', 'metabolicas', 0.82)]);
    await atendimento(vaca, diasAtras(20), [conclusao('laminite', 'Laminite', 'locomotor', 0.71)]);
    await atendimento(bezerra, diasAtras(5), [
      conclusao('diarreia_neonatal', 'Diarreia neonatal', 'bezerras', 0.9),
    ]);
    await atendimento(bezerra, diasAtras(3), [
      conclusao('suspeita_raiva', 'Suspeita de raiva', 'notificacao_obrigatoria', 0.65, true),
    ]);
    // Hipótese fraca e "sem alteração" não são diagnóstico.
    await atendimento(vaca, diasAtras(2), [
      conclusao('timpanismo', 'Timpanismo', 'digestivas', 0.2),
      conclusao('sem_alteracao', 'Sem alteração detectada', 'triagem', 0.9),
    ]);
    // Fora da janela consultada.
    await atendimento(vaca, diasAtras(300), [conclusao('verminose', 'Verminose', 'parasitarias', 0.8)]);
  });

  it('agrupa os diagnósticos por grupo de doença, não só mastite', async () => {
    const p = await panoramaDiagnosticos(180);
    expect(p.porGrupo.map((g) => g.grupo).sort()).toEqual([
      'bezerras',
      'locomotor',
      'metabolicas',
      'notificacao_obrigatoria',
    ]);
    expect(p.diagnosticos.map((d) => d.id).sort()).toEqual([
      'cetose',
      'diarreia_neonatal',
      'laminite',
      'suspeita_raiva',
    ]);
  });

  it('ignora hipótese fraca e "sem alteração", contando o atendimento como sem conclusão', async () => {
    const p = await panoramaDiagnosticos(180);
    expect(p.diagnosticos.some((d) => d.id === 'timpanismo')).toBe(false);
    expect(p.semConclusao).toBe(1);
  });

  it('respeita a janela de dias', async () => {
    const p = await panoramaDiagnosticos(180);
    expect(p.diagnosticos.some((d) => d.id === 'verminose')).toBe(false);

    const ano = await panoramaDiagnosticos(365);
    expect(ano.diagnosticos.some((d) => d.id === 'verminose')).toBe(true);
  });

  it('separa as bandeiras vermelhas e guarda o animal de cada ocorrência', async () => {
    const p = await panoramaDiagnosticos(180);
    expect(p.bandeirasVermelhas.map((d) => d.id)).toEqual(['suspeita_raiva']);
    const raiva = p.diagnosticos.find((d) => d.id === 'suspeita_raiva');
    expect(raiva?.ocorrencias[0]?.brinco).toBe('402');
  });

  it('não quebra com conclusões gravadas em formato inválido', async () => {
    await salvarAtendimento({
      animal_id: vaca,
      data_hora: diasAtras(1),
      queixa_principal: null,
      kb_versao: '0.9.0',
      engine_versao: '0.9.0',
      fatos_iniciais: '[]',
      respostas: '[]',
      conclusoes: 'isto não é json',
      traco: '[]',
      conduta_check: null,
      motivo_parada: 'conclusao',
      status: 'concluido',
      observacoes: null,
    });

    const p = await panoramaDiagnosticos(180);
    expect(p.semConclusao).toBe(2);
    expect(p.diagnosticos.length).toBe(4);
  });
});
