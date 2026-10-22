/**
 * Pré-carga de fatos do banco para a sessão de anamnese (specsDrMoo.md §4.4 passo 1).
 *
 * "NUNCA perguntar o que o banco já sabe." Esta é a ponte entre as Fontes de
 * Dados Externas e a Memória de Trabalho do modelo conceitual: o motor começa a
 * sessão já sabendo a idade, os dias em lactação, o histórico de CMT e a produção
 * média — e por isso gasta as perguntas do produtor com o que realmente interessa.
 */
import type { Fato } from '@drmoo/engine';
import { del as calcularDel, diferencaEmDias, hoje } from '@drmoo/domain';
import { consultarUm } from './driver';
import { obterAnimal, ultimaCCS } from './repositorios';

/** Exames mais antigos que isto não entram como fato: pede-se um novo. */
const VALIDADE_CMT_DIAS = 30;
const VALIDADE_CCS_DIAS = 45;

export interface FatoPreCarregado extends Fato {
  /** Texto para o painel "O que eu já sei". */
  descricao: string;
}

/**
 * Raça de origem europeia (Bos taurus), sem indício de cruzamento zebuíno no
 * texto informado.
 *
 * Fato zootécnico bem estabelecido: taurinos puros são mais suscetíveis a
 * carrapato e a estresse térmico em pasto tropical do que zebuínos e seus
 * cruzamentos (que têm pele mais pigmentada e maior resistência ao
 * ectoparasita) — por isso entra como reforço de uma hipótese já levantada
 * por sinais clínicos, nunca como diagnóstico isolado. Como o cadastro guarda
 * raça em texto livre, a detecção é por palavra-chave: na dúvida (cruzamento
 * citado, ou raça não reconhecida), o fato não é adicionado.
 */
function racaTaurinaEuropeia(raca: string): boolean {
  const texto = raca.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const indicaCruzamentoZebuino = /zebu|nelore|gir|guzera|indubrasil|girolando|x\s|cruza/.test(texto);
  if (indicaCruzamentoZebuino) return false;
  return /holande|jersey|pardo su[ic]|suico|simental|normando|gado europ/.test(texto);
}

export async function fatosDoAnimal(
  animalId: string,
  referencia: string = hoje(),
): Promise<FatoPreCarregado[]> {
  const animal = await obterAnimal(animalId);
  if (!animal) return [];

  const agora = new Date().toISOString();
  const fatos: FatoPreCarregado[] = [];

  const add = (variavel: string, valor: Fato['valor'], descricao: string) => {
    fatos.push({ variavel, valor, cf: 1, origem: 'banco', timestamp: agora, descricao });
  };

  // Sexo decide, de cara, se vale a pena perguntar sobre úbere e reprodução —
  // só a fêmea lactante tem mama em produção e ciclo reprodutivo a investigar.
  add('sexo', animal.sexo, animal.sexo === 'F' ? 'fêmea' : 'macho');

  if (animal.raca) {
    add(
      'raca_taurina_europeia',
      racaTaurinaEuropeia(animal.raca),
      `raça/cruzamento informado: ${animal.raca}`,
    );
  }

  if (animal.data_nascimento) {
    const idade = diferencaEmDias(animal.data_nascimento, referencia);
    add('idade_dias', idade, `${idade} dias de idade`);
  }

  if (animal.data_parto) {
    const d = calcularDel(animal.data_parto, referencia);
    add('del', d, `${d} dias em lactação (pariu em ${animal.data_parto})`);
  }

  if (animal.numero_lactacao !== null) {
    add('numero_lactacao', animal.numero_lactacao, `${animal.numero_lactacao}ª lactação`);
  }

  if (animal.producao_media_dia !== null && animal.producao_media_dia > 0) {
    add(
      'producao_media_dia',
      animal.producao_media_dia,
      `produz em média ${animal.producao_media_dia} L por dia`,
    );
  }

  // CMT só vale como fato se for recente — senão, o motor manda refazer o teste.
  if (animal.ultimo_cmt && animal.data_ultimo_cmt) {
    const idadeExame = diferencaEmDias(animal.data_ultimo_cmt, referencia);
    if (idadeExame <= VALIDADE_CMT_DIAS) {
      add(
        'cmt_pior_quarto',
        animal.ultimo_cmt,
        `CMT de ${animal.data_ultimo_cmt}: pior quarto ${animal.ultimo_cmt}`,
      );
    }
  }

  if (animal.cmt_positivo_meses > 0) {
    add(
      'cmt_positivo_meses',
      animal.cmt_positivo_meses,
      `${animal.cmt_positivo_meses} mês(es) seguidos com CMT positivo nesta lactação`,
    );
  }

  if (animal.tem_peito_perdido) {
    add('quarto_sem_leite', true, 'já tem quarto registrado como peito perdido (PP)');
  }

  const ccs = await consultarUm<{ celulas_ml: number; data: string }>(
    'SELECT celulas_ml, data FROM exame_ccs WHERE animal_id=? ORDER BY data DESC LIMIT 1',
    [animalId],
  );
  if (ccs && diferencaEmDias(ccs.data, referencia) <= VALIDADE_CCS_DIAS) {
    add(
      'ccs_individual',
      ccs.celulas_ml,
      `CCS de ${ccs.data}: ${ccs.celulas_ml.toLocaleString('pt-BR')} células/mL`,
    );
  }

  return fatos;
}

export { ultimaCCS };
