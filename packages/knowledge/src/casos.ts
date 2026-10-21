/**
 * Casos de teste da base de conhecimento (specsDrMoo.md §9).
 *
 * "Defina casos de teste com resultado esperado junto com o conhecimento do
 * domínio e valide cada versão da base" — diretriz explícita do regulamento.
 *
 * Este módulo é usado tanto pela suíte automatizada (`npm test`) quanto pela tela
 * "Base de Conhecimento" do app, que roda os casos ao vivo diante do usuário.
 */
import { Sessao, type BaseCompilada, type Fato, type Valor } from '@drmoo/engine';
import casosJson from '../casos/casos.json';

export interface CasoDeTeste {
  id: string;
  descricao: string;
  fatos: Record<string, Valor>;
  esperado: {
    /** Hipótese que deve liderar o ranking. `null` = nenhuma conclusão relevante. */
    diagnosticoPrincipal: string | null;
    cfMinimo?: number;
    cfMaximo?: number;
    deveConcluir?: string[];
    naoDeveConcluir?: string[];
    regrasDisparadas?: string[];
    bandeiraVermelha?: boolean;
  };
}

export interface ResultadoCaso {
  caso: CasoDeTeste;
  passou: boolean;
  falhas: string[];
  obtido: {
    diagnosticoPrincipal: string | null;
    cf: number | null;
    hipoteses: { id: string; cf: number }[];
    regrasDisparadas: string[];
    bandeiraVermelha: boolean;
  };
}

export const casos: CasoDeTeste[] = casosJson as unknown as CasoDeTeste[];

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

export function executarCaso(kb: BaseCompilada, caso: CasoDeTeste): ResultadoCaso {
  const sessao = new Sessao(kb, paraFatos(caso.fatos), { agora: RELOGIO_FIXO });
  const passo = sessao.proximo();
  const parecer = passo.parecer ?? sessao.encerrar();

  const hipoteses = parecer.hipoteses.map((h) => ({ id: h.id, cf: h.cf }));
  const principal = hipoteses[0] ?? null;
  const regrasDisparadas = parecer.traco.map((p) => p.regraId);
  const bandeira = parecer.bandeiraVermelha !== null;

  const falhas: string[] = [];
  const esp = caso.esperado;

  if (esp.diagnosticoPrincipal === null) {
    if (principal) {
      falhas.push(
        `esperava nenhuma conclusão relevante, obteve "${principal.id}" (CF ${principal.cf.toFixed(2)})`,
      );
    }
  } else if (!principal) {
    falhas.push(`esperava "${esp.diagnosticoPrincipal}", não houve conclusão`);
  } else if (principal.id !== esp.diagnosticoPrincipal) {
    falhas.push(`esperava "${esp.diagnosticoPrincipal}" como principal, obteve "${principal.id}"`);
  } else {
    if (esp.cfMinimo !== undefined && principal.cf < esp.cfMinimo) {
      falhas.push(`CF ${principal.cf.toFixed(3)} abaixo do mínimo ${esp.cfMinimo}`);
    }
    if (esp.cfMaximo !== undefined && principal.cf > esp.cfMaximo) {
      falhas.push(`CF ${principal.cf.toFixed(3)} acima do máximo ${esp.cfMaximo}`);
    }
  }

  for (const id of esp.deveConcluir ?? []) {
    if (!hipoteses.some((h) => h.id === id)) falhas.push(`deveria concluir também "${id}"`);
  }
  for (const id of esp.naoDeveConcluir ?? []) {
    const achada = hipoteses.find((h) => h.id === id);
    if (achada) falhas.push(`não deveria concluir "${id}" (CF ${achada.cf.toFixed(2)})`);
  }
  for (const id of esp.regrasDisparadas ?? []) {
    if (!regrasDisparadas.includes(id)) falhas.push(`regra "${id}" não disparou`);
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

export function executarCasos(kb: BaseCompilada): ResultadoCaso[] {
  return casos.map((c) => executarCaso(kb, c));
}
