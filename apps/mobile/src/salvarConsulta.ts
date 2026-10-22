import { compromissosDaAgenda, type CompromissoConsulta } from './agendaConsulta';
import type { Parecer, Sessao } from '@drmoo/engine';
import { atualizarStatusAposTriagem, emTransacao, lancarCMT, registrarCasoMastite, salvarAtendimento, criarEvento, ROTULO_EVENTO } from '@drmoo/db';
import { hoje, somarDias, type ResultadoCMT } from '@drmoo/domain';

/** Prontuário, caso sanitário e exame só ficam salvos se a consulta inteira gravar. */
export async function salvarConsulta(
  animalId: string,
  sessao: Sessao,
  parecer: Parecer,
  condutas: string[],
  opcoes: { dataAtendimento?: string; compromissos?: CompromissoConsulta[] } = {},
): Promise<string> {
  const serializado = sessao.serializar();
  const data = opcoes.dataAtendimento ?? hoje();
  const dataValida = (valor: string) => /^\d{4}-\d{2}-\d{2}$/.test(valor) && somarDias(valor, 0) === valor;
  if (!dataValida(data) || data > hoje()) throw new Error('Escolha uma data válida para o atendimento, até hoje.');
  const compromissos = opcoes.compromissos ?? compromissosDaAgenda(parecer, condutas, {});
  for (const compromisso of compromissos) {
    if (!compromisso.titulo.trim() || !dataValida(compromisso.data) || !(compromisso.tipo in ROTULO_EVENTO)) {
      throw new Error('Confira o título, o tipo e a data de cada compromisso antes de salvar.');
    }
    if (compromisso.data < data) throw new Error('A data do compromisso não pode ser anterior ao atendimento.');
  }
  let id = '';
  await emTransacao(async () => {
    id = await salvarAtendimento({
      animal_id: animalId,
      // Mantém a data de calendário escolhida, sem deslocá-la pela conversão para UTC.
      data_hora: `${data}T${new Date().toTimeString().slice(0, 8)}`,
      queixa_principal: null,
      kb_versao: parecer.kbVersao,
      engine_versao: parecer.engineVersao,
      fatos_iniciais: JSON.stringify(serializado.fatosIniciais),
      respostas: JSON.stringify(serializado.respostas),
      conclusoes: JSON.stringify(parecer.hipoteses),
      traco: JSON.stringify(parecer.traco),
      conduta_check: JSON.stringify(condutas),
      motivo_parada: parecer.motivoParada,
      status: 'concluido',
      observacoes: null,
    });

    await atualizarStatusAposTriagem(animalId, parecer.hipoteses, parecer.bandeiraVermelha !== null);

    // O ranking é por confiança. A clínica pode coexistir com outra hipótese
    // mais acima; registra um único caso, com o maior grau clínico identificado.
    const graus = parecer.hipoteses
      .map((h) => /^mastite_clinica_g([123])$/.exec(h.id))
      .filter((m) => m !== null)
      .map((m) => Number(m[1]));
    if (graus.length) {
      await registrarCasoMastite({
        animalId, quartos: 1, tipo: 'clinica', grau: Math.max(...graus),
        dataInicio: data, atendimentoId: id,
      });
    }

    // Uma mesma ação pode aparecer em mais de uma hipótese; agenda uma única vez.
    const unicos = new Map(compromissos.map((item) => [`${item.tipo}|${item.data}|${item.titulo.trim()}`, item]));
    for (const compromisso of unicos.values()) {
      await criarEvento({ ...compromisso, animalId, titulo: compromisso.titulo.trim(), origem: 'manual', referenciaId: id });
    }

    const cmt = sessao.memoria.get('cmt_pior_quarto');
    if (cmt && typeof cmt.valor === 'string' && cmt.origem === 'pergunta') {
      await lancarCMT(animalId, data, { ad: cmt.valor as ResultadoCMT, ae: null, pd: null, pe: null });
    }
  });
  return id;
}
