import { hoje, somarDias } from '@drmoo/domain';
import { agoraISO, consultar, consultarUm, emTransacao, executar, novoId } from './driver';

export type TipoSaida = 'falecimento' | 'venda';
export interface RegistroSaida {
  id: string;
  animal_id: string;
  brinco: string;
  nome: string | null;
  data: string | null;
  hora: string | null;
  causa: string | null;
  valor: number | null;
  destinatario: string | null;
}
export type DadosSaida =
  | { tipo: 'falecimento'; animalId: string; data: string; hora: string; causa: string }
  | { tipo: 'venda'; animalId: string; data: string; valor: number; destinatario: string };

/** Estado e histórico/receita são gravados juntos; uma falha desfaz tudo. */
export async function registrarSaida(dados: DadosSaida): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.data) || somarDias(dados.data, 0) !== dados.data || dados.data > hoje()) {
    throw new Error('Informe uma data válida, até hoje.');
  }
  if (dados.tipo === 'falecimento') {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(dados.hora)) throw new Error('Informe a hora no formato HH:mm.');
    const agora = new Date();
    const horaAtual = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    if (dados.data === hoje() && dados.hora > horaAtual) throw new Error('A hora do falecimento não pode estar no futuro.');
    if (!dados.causa.trim()) throw new Error('Informe a causa do falecimento.');
  } else if (!Number.isFinite(dados.valor) || dados.valor <= 0 || !dados.destinatario.trim()) {
    throw new Error('Informe um valor de venda maior que zero e o destinatário.');
  }
  await emTransacao(async () => {
    const animal = await consultarUm<{ status: string; categoria: string; brinco: string; data_nascimento: string | null; data_entrada: string | null }>(
      'SELECT status, categoria, brinco, data_nascimento, data_entrada FROM animal WHERE id=? AND deleted_at IS NULL', [dados.animalId],
    );
    if (!animal) throw new Error('Animal não encontrado.');
    if (['morto', 'vendido', 'descartado'].includes(animal.status)) throw new Error('Este animal já tem uma saída registrada.');
    if ((animal.data_nascimento && dados.data < animal.data_nascimento) || (animal.data_entrada && dados.data < animal.data_entrada)) {
      throw new Error('A saída não pode ser anterior ao nascimento ou à entrada do animal.');
    }
    const existente = await consultarUm<{ id: string }>(
      `SELECT id FROM morte WHERE animal_id=? UNION ALL
       SELECT id FROM receita WHERE animal_id=? AND categoria='venda_animais' LIMIT 1`, [dados.animalId, dados.animalId],
    );
    if (existente) throw new Error('Este animal já tem um falecimento ou venda registrado.');
    const agora = agoraISO();
    if (dados.tipo === 'falecimento') {
      await executar(`INSERT INTO morte (id, animal_id, data, hora, categoria_na_morte, causa, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?)`, [novoId('mor'), dados.animalId, dados.data, dados.hora, animal.categoria, dados.causa.trim(), agora, agora]);
    } else {
      await executar(`INSERT INTO receita (id, animal_id, data, categoria, descricao, valor, destinatario, created_at, updated_at)
        VALUES (?,?,?,'venda_animais',?,?,?,?,?)`,
      [novoId('rec'), dados.animalId, dados.data, `Venda do animal ${animal.brinco}`, dados.valor, dados.destinatario.trim(), agora, agora]);
    }
    await executar('UPDATE animal SET status=?, data_saida=?, motivo_saida=?, updated_at=? WHERE id=?',
      [dados.tipo === 'falecimento' ? 'morto' : 'vendido', dados.data, dados.tipo === 'falecimento' ? dados.causa.trim() : 'Venda', agora, dados.animalId]);
    await executar("UPDATE evento_calendario SET status='cancelado', updated_at=? WHERE animal_id=? AND status IN ('pendente','atrasado') AND data>=?",
      [agora, dados.animalId, dados.data]);
  });
}

/** LEFT JOIN conserva também os animais legados com data/hora não informadas. */
export async function historicoSaidas(tipo: TipoSaida): Promise<RegistroSaida[]> {
  if (tipo === 'falecimento') return consultar<RegistroSaida>(
    `SELECT COALESCE(m.id,a.id) AS id, a.id AS animal_id, a.brinco, a.nome,
      COALESCE(m.data,a.data_saida) AS data, m.hora, COALESCE(m.causa,a.motivo_saida) AS causa,
      NULL AS valor, NULL AS destinatario
     FROM animal a LEFT JOIN morte m ON m.animal_id=a.id
     WHERE a.deleted_at IS NULL AND (a.status='morto' OR m.id IS NOT NULL)
     ORDER BY data DESC, m.hora DESC, a.brinco`,
  );
  return consultar<RegistroSaida>(
    `SELECT COALESCE(r.id,a.id) AS id, a.id AS animal_id, a.brinco, a.nome,
      COALESCE(r.data,a.data_saida) AS data, NULL AS hora, NULL AS causa, r.valor, r.destinatario
     FROM animal a LEFT JOIN receita r ON r.animal_id=a.id AND r.categoria='venda_animais'
     WHERE a.deleted_at IS NULL AND (a.status='vendido' OR r.id IS NOT NULL)
     ORDER BY data DESC, a.brinco`,
  );
}
