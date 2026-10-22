/**
 * Rebanho sintético de 100 prontuários — teste de caixa-preta do motor.
 *
 * Diferente de `casos.ts`, que nasceu junto das regras, este conjunto foi escrito
 * a partir da semiologia clínica (o que o produtor vê no curral), sem partir da
 * base: serve para medir a assertividade do motor contra quadros que ele não foi
 * desenhado para reconhecer caso a caso.
 *
 * Cada prontuário traz o animal (raça, sexo, idade, lactação) e os sinais
 * observados. Os fatos de contexto que o app carregaria do banco — sexo, idade em
 * dias, DEL, número da lactação, produção, CMT — são derivados aqui exatamente
 * como `@drmoo/db` faz em `fatosDoAnimal`, para que o teste reproduza a sessão real.
 */
import { Sessao, type BaseCompilada, type Fato, type Valor } from '@drmoo/engine';
import rebanhoJson from '../casos/rebanho-100.json';
import clinico50Json from '../casos/clinico-50.json';
import clinico100Json from '../casos/clinico-100.json';
import clinico300Json from '../casos/clinico-300.json';
import type { CasoDeTeste, ResultadoCaso } from './casos';

export interface AnimalSintetico {
  brinco: string;
  nome: string;
  raca: string;
  sexo: 'M' | 'F';
  /** Idade em meses cheios. Para neonatos, use também `idade_dias`. */
  idade_meses: number;
  /** Idade exata em dias — preenchida quando o mês não tem resolução suficiente. */
  idade_dias?: number;
  lactante: boolean;
  numero_lactacao?: number;
  del?: number;
  producao_media_dia?: number;
  cmt_pior_quarto?: string;
  cmt_positivo_meses?: number;
}

export interface Prontuario {
  id: string;
  animal: AnimalSintetico;
  queixa: string;
  fatos: Record<string, Valor>;
  esperado: CasoDeTeste['esperado'];
}

interface ArquivoRebanho {
  versao: string;
  descricao: string;
  prontuarios: Prontuario[];
}

const arquivo = rebanhoJson as unknown as ArquivoRebanho;

export const rebanhoSintetico: Prontuario[] = arquivo.prontuarios;
export const versaoRebanhoSintetico: string = arquivo.versao;

/**
 * Baterias de teste de caixa-preta, cada uma com um gabarito externo.
 *
 * São listas separadas porque cada bateria tem uma origem e um recorte
 * próprios — e porque o número de acertos de cada uma é o indicador que se
 * acompanha ao mexer na base.
 */
export interface Bateria {
  nome: string;
  descricao: string;
  prontuarios: Prontuario[];
}

export const baterias: Bateria[] = [
  { nome: 'rebanho-100', descricao: arquivo.descricao, prontuarios: arquivo.prontuarios },
  {
    nome: 'clinico-50',
    descricao: (clinico50Json as unknown as ArquivoRebanho).descricao,
    prontuarios: (clinico50Json as unknown as ArquivoRebanho).prontuarios,
  },
  {
    nome: 'clinico-100',
    descricao: (clinico100Json as unknown as ArquivoRebanho).descricao,
    prontuarios: (clinico100Json as unknown as ArquivoRebanho).prontuarios,
  },
  {
    nome: 'clinico-300',
    descricao: (clinico300Json as unknown as ArquivoRebanho).descricao,
    prontuarios: (clinico300Json as unknown as ArquivoRebanho).prontuarios,
  },
];

export const todosOsProntuarios: Prontuario[] = baterias.flatMap((b) => b.prontuarios);

const DIAS_POR_MES = 30.44;

/** Mesma heurística de `@drmoo/db` — duplicada de propósito: este pacote não depende do banco. */
function racaTaurinaEuropeia(raca: string): boolean {
  const texto = raca
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (/zebu|nelore|gir|guzera|indubrasil|girolando|x\s|cruza/.test(texto)) return false;
  return /holande|jersey|pardo su[ic]|suico|simental|normando|gado europ/.test(texto);
}

/** Fatos de contexto que o app já saberia pelo cadastro, sem perguntar nada. */
export function contextoDoAnimal(a: AnimalSintetico): Record<string, Valor> {
  const ctx: Record<string, Valor> = {
    sexo: a.sexo,
    raca_taurina_europeia: racaTaurinaEuropeia(a.raca),
    idade_dias: a.idade_dias ?? Math.round(a.idade_meses * DIAS_POR_MES),
  };
  if (a.lactante) {
    if (a.del !== undefined) ctx.del = a.del;
    if (a.numero_lactacao !== undefined) ctx.numero_lactacao = a.numero_lactacao;
    if (a.producao_media_dia !== undefined) ctx.producao_media_dia = a.producao_media_dia;
    if (a.cmt_pior_quarto !== undefined) ctx.cmt_pior_quarto = a.cmt_pior_quarto;
    if (a.cmt_positivo_meses !== undefined) ctx.cmt_positivo_meses = a.cmt_positivo_meses;
  }
  return ctx;
}

/** Converte o prontuário no mesmo formato dos casos de teste da base. */
export function prontuarioComoCaso(p: Prontuario): CasoDeTeste {
  return {
    id: p.id,
    descricao: `${p.animal.brinco} ${p.animal.nome} (${p.animal.raca}, ${p.animal.sexo}, ${p.animal.idade_meses} m, ${p.animal.lactante ? 'lactante' : 'não lactante'}) — ${p.queixa}`,
    fatos: { ...contextoDoAnimal(p.animal), ...p.fatos },
    esperado: p.esperado,
  };
}

export const casosRebanhoSintetico: CasoDeTeste[] = rebanhoSintetico.map(prontuarioComoCaso);

const RELOGIO_FIXO = () => '2026-10-21T12:00:00.000Z';

function paraFatos(registro: Record<string, Valor>): Fato[] {
  return Object.entries(registro).map(([variavel, valor]) => ({
    variavel,
    valor,
    cf: 1,
    origem: 'banco' as const,
    timestamp: RELOGIO_FIXO(),
  }));
}

/**
 * Executa um prontuário como atendimento completo.
 *
 * O produtor relata o que viu e não há ninguém para responder o resto: o que não
 * está no prontuário fica desconhecido e a sessão é encerrada com o que se sabe.
 */
export function executarProntuario(kb: BaseCompilada, p: Prontuario): ResultadoCaso {
  const caso = prontuarioComoCaso(p);
  const sessao = new Sessao(kb, paraFatos(caso.fatos), { agora: RELOGIO_FIXO });
  const passo = sessao.proximo();
  const parecer = passo.parecer ?? sessao.encerrar();

  const hipoteses = parecer.hipoteses.map((h) => ({ id: h.id, cf: h.cf }));
  const principal = hipoteses[0] ?? null;
  const regrasDisparadas = parecer.traco.map((x) => x.regraId);
  const bandeira = parecer.bandeiraVermelha !== null;

  const falhas: string[] = [];
  const esp = caso.esperado;

  if (esp.diagnosticoPrincipal === null) {
    if (principal) falhas.push(`esperava nenhuma conclusão, obteve "${principal.id}"`);
  } else if (!principal) {
    falhas.push(`esperava "${esp.diagnosticoPrincipal}", não houve conclusão`);
  } else if (principal.id !== esp.diagnosticoPrincipal) {
    falhas.push(`esperava "${esp.diagnosticoPrincipal}", obteve "${principal.id}"`);
  }

  if (esp.cfMinimo !== undefined && principal && principal.cf < esp.cfMinimo) {
    falhas.push(`CF ${principal.cf.toFixed(3)} abaixo do mínimo ${esp.cfMinimo}`);
  }
  for (const id of esp.deveConcluir ?? []) {
    if (!hipoteses.some((h) => h.id === id)) falhas.push(`deveria concluir também "${id}"`);
  }
  for (const id of esp.naoDeveConcluir ?? []) {
    const achada = hipoteses.find((h) => h.id === id);
    if (achada) falhas.push(`não deveria concluir "${id}" (CF ${achada.cf.toFixed(2)})`);
  }
  if (esp.bandeiraVermelha !== undefined && esp.bandeiraVermelha !== bandeira) {
    falhas.push(`bandeira vermelha: esperava ${esp.bandeiraVermelha}, obteve ${bandeira}`);
  }

  return {
    caso,
    passou: falhas.length === 0,
    falhas,
    obtido: {
      diagnosticoPrincipal: principal?.id ?? null,
      cf: principal?.cf ?? null,
      hipoteses,
      regrasDisparadas,
      bandeiraVermelha: bandeira,
    },
  };
}

export function executarRebanhoSintetico(kb: BaseCompilada): ResultadoCaso[] {
  return rebanhoSintetico.map((p) => executarProntuario(kb, p));
}

export function executarBateria(kb: BaseCompilada, b: Bateria): ResultadoCaso[] {
  return b.prontuarios.map((p) => executarProntuario(kb, p));
}

/** Assertividade do motor sobre o rebanho sintético, em porcentagem. */
export function assertividade(resultados: ResultadoCaso[]): number {
  if (resultados.length === 0) return 0;
  return (resultados.filter((r) => r.passou).length / resultados.length) * 100;
}
