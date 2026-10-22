/**
 * Diagnóstico do REBANHO, não do animal.
 *
 * A base de conhecimento já tem um grupo de regras só para isto — "rebanho"
 * (mastite clínica/subclínica acima da meta, CMT do rebanho atrasado,
 * percentual de vacas em lactação abaixo do ideal), citando a Embrapa,
 * status "validada" — e os indicadores que essas regras pedem
 * (`perc_mastite_clinica_mes`, `perc_mastite_subclinica`,
 * `dias_desde_ultimo_cmt`, `perc_vacas_lactacao`) já são calculados em outro
 * lugar, para alimentar o painel de estatísticas. Só faltava ligar as duas
 * pontas: nenhum caminho do app rodava essas quatro regras.
 *
 * Esta função fecha o ciclo: lê os indicadores do mês, roda-os pela mesma
 * base de conhecimento usada na anamnese individual e, para cada hipótese de
 * rebanho confirmada, grava uma medida de rebanho no calendário (sem
 * animal_id — é da propriedade inteira) com a conduta da própria regra.
 */
import { inferir, type Fato, type Hipotese } from '@drmoo/engine';
import { baseCompilada } from '@drmoo/knowledge';
import { hoje } from '@drmoo/domain';
import { agoraISO, consultarUm, executar } from './driver';
import { composicaoRebanho, criarEvento, painelMastite } from './repositorios';

/** Dias antes de repetir a mesma medida de rebanho, se ela continuar valendo. */
const INTERVALO_REPETICAO_DIAS = 30;

export async function diagnosticarRebanho(referencia: string = hoje()): Promise<Hipotese[]> {
  const [ano, mes] = referencia.slice(0, 7).split('-').map(Number) as [number, number];
  const [painel, composicao] = await Promise.all([painelMastite(ano, mes), composicaoRebanho()]);

  const lactacao = composicao.vaca_lactacao ?? 0;
  const seca = composicao.vaca_seca ?? 0;
  const femeasAdultas = lactacao + seca;

  const agora = agoraISO();
  const fatos: Fato[] = [
    { variavel: 'perc_mastite_clinica_mes', valor: painel.percentualClinica, cf: 1, origem: 'banco', timestamp: agora },
    { variavel: 'perc_mastite_subclinica', valor: painel.percentualSubclinica, cf: 1, origem: 'banco', timestamp: agora },
  ];
  if (painel.diasDesdeUltimoCMT !== null) {
    fatos.push({ variavel: 'dias_desde_ultimo_cmt', valor: painel.diasDesdeUltimoCMT, cf: 1, origem: 'banco', timestamp: agora });
  }
  if (femeasAdultas > 0) {
    fatos.push({
      variavel: 'perc_vacas_lactacao',
      valor: (lactacao / femeasAdultas) * 100,
      cf: 1,
      origem: 'banco',
      timestamp: agora,
    });
  }

  const parecer = inferir(baseCompilada, fatos);
  const hipotesesDeRebanho = parecer.hipoteses.filter((h) => h.grupo === 'rebanho');

  for (const h of hipotesesDeRebanho) {
    await registrarMedidaDeRebanho(h, referencia);
  }

  return hipotesesDeRebanho;
}

/**
 * Grava a medida de rebanho como evento "pendente" de uma vez por indicador
 * fora da meta — repetir o mesmo evento a cada anamnese, enquanto o problema
 * persistir, só poluiria o calendário sem ajudar o produtor.
 */
async function registrarMedidaDeRebanho(hipotese: Hipotese, referencia: string): Promise<void> {
  const existente = await consultarUm<{ id: string; data: string }>(
    `SELECT id, data FROM evento_calendario
     WHERE tipo='manejo' AND origem='automatico' AND referencia_id=? AND status='pendente'
     ORDER BY data DESC LIMIT 1`,
    [hipotese.id],
  );

  if (existente) {
    const dias = Math.round(
      (new Date(referencia).getTime() - new Date(existente.data).getTime()) / 86_400_000,
    );
    if (dias < INTERVALO_REPETICAO_DIAS) return;
    // Indicador continua fora da meta depois do intervalo: empurra a data em
    // vez de acumular um evento novo por mês.
    await executar('UPDATE evento_calendario SET data=?, updated_at=? WHERE id=?', [
      referencia,
      agoraISO(),
      existente.id,
    ]);
    return;
  }

  await criarEvento({
    tipo: 'manejo',
    titulo: hipotese.rotulo,
    descricao: hipotese.conduta.join(' '),
    data: referencia,
    origem: 'automatico',
    referenciaId: hipotese.id,
  });
}
