/**
 * Cliente HTTP da sincronização.
 *
 * Fala com o servidor da própria propriedade (`scripts/servidor-sync.ts`), pelo
 * IP da rede Wi-Fi local. Nenhuma requisição sai para a internet: o endereço é
 * digitado pelo usuário e é sempre um host da LAN.
 */
import type { DispositivoConhecido, Instantaneo } from './tipos';

export interface Saude {
  ok: true;
  servico: 'drmoo-sync';
  versao: number;
  propriedade: string;
  dispositivos: DispositivoConhecido[];
}

export interface RespostaSincronizacao {
  instantaneo: Instantaneo;
  dispositivos: DispositivoConhecido[];
}

export class ErroDeSincronizacao extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ErroDeSincronizacao';
  }
}

/** Normaliza o que o usuário digita: `192.168.0.10` vira `http://192.168.0.10:8787`. */
export function normalizarEndereco(entrada: string, portaPadrao = 8787): string {
  const texto = entrada.trim().replace(/\/+$/, '');
  if (!texto) throw new ErroDeSincronizacao('Informe o endereço do servidor da propriedade.');
  const comEsquema = /^https?:\/\//i.test(texto) ? texto : `http://${texto}`;
  const url = new URL(comEsquema);
  if (!url.port && !/^https:/i.test(comEsquema)) url.port = String(portaPadrao);
  return `${url.protocol}//${url.host}`;
}

const TEMPO_LIMITE_MS = 15000;

async function pedir<T>(url: string, init: RequestInit, tempoLimiteMs = TEMPO_LIMITE_MS): Promise<T> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), tempoLimiteMs);
  let resposta: Response;
  try {
    resposta = await fetch(url, { ...init, signal: controle.signal });
  } catch (e) {
    const motivo = controle.signal.aborted ? 'o servidor não respondeu a tempo' : 'não foi possível alcançar o servidor';
    throw new ErroDeSincronizacao(`${motivo} (${url}). Confira se os dois aparelhos estão na mesma rede Wi-Fi.`);
  } finally {
    clearTimeout(timer);
  }

  const corpo = await resposta.text();
  if (!resposta.ok) {
    let detalhe = corpo.slice(0, 200);
    try {
      detalhe = String((JSON.parse(corpo) as { erro?: string }).erro ?? detalhe);
    } catch {
      /* corpo não era JSON; usa o texto cru */
    }
    throw new ErroDeSincronizacao(detalhe || `servidor respondeu ${resposta.status}`, resposta.status);
  }
  return JSON.parse(corpo) as T;
}

export function consultarSaude(base: string): Promise<Saude> {
  return pedir<Saude>(`${base}/saude`, { method: 'GET' }, 6000);
}

export function enviarInstantaneo(
  base: string,
  codigo: string,
  instantaneo: Instantaneo,
): Promise<RespostaSincronizacao> {
  return pedir<RespostaSincronizacao>(`${base}/sincronizar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ codigo, instantaneo }),
  });
}
