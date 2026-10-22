import type { Parecer, Sessao } from '@drmoo/engine';
import { atualizarStatusAposTriagem, emTransacao, lancarCMT, registrarCasoMastite, salvarAtendimento } from '@drmoo/db';
import { hoje, type ResultadoCMT } from '@drmoo/domain';

/** Prontuário, caso sanitário e exame só ficam salvos se a consulta inteira gravar. */
export async function salvarConsulta(
  animalId: string,
  sessao: Sessao,
  parecer: Parecer,
  condutas: string[],
): Promise<string> {
  const serializado = sessao.serializar();
  const data = hoje();
  let id = '';
  await emTransacao(async () => {
    id = await salvarAtendimento({
      animal_id: animalId,
      data_hora: new Date().toISOString(),
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

    const cmt = sessao.memoria.get('cmt_pior_quarto');
    if (cmt && typeof cmt.valor === 'string' && cmt.origem === 'pergunta') {
      await lancarCMT(animalId, data, { ad: cmt.valor as ResultadoCMT, ae: null, pd: null, pe: null });
    }
  });
  return id;
}
