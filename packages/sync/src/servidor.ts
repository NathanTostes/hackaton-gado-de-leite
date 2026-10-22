/**
 * Servidor de sincronização da propriedade.
 *
 * Sobe com `npm run sync` (veja `scripts/servidor-sync.ts`).
 *
 * Um processo Node, sem dependência nenhuma, que escuta na rede Wi-Fi local e
 * guarda a base mesclada num arquivo JSON (`.drmoo-sync/estado.json`). Cada
 * aparelho envia o seu instantâneo e recebe de volta o resultado da mesclagem.
 *
 * Continua tudo offline: o servidor só escuta em IPs privados da LAN, não abre
 * conexão de saída e não fala com serviço nenhum. É o mesmo papel do "celular
 * que faz de servidor" descrito na tela Rede local — aqui no computador porque
 * é ele que já serve o app aos aparelhos (Metro, porta 8081).
 *
 * Pareamento: um código de 6 dígitos impresso no terminal, exigido em toda
 * sincronização. Sem conta, sem cadastro, sem nuvem.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contarLinhas,
  instantaneoVazio,
  mesclar,
  validarInstantaneo,
  type DispositivoConhecido,
  type Instantaneo,
} from './index';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ARQUIVO_ESTADO = resolve(RAIZ, '.drmoo-sync/estado.json');
const PORTA = Number(process.env.PORTA_SYNC ?? 8787);
const PROPRIEDADE = process.env.NOME_PROPRIEDADE ?? 'Propriedade Dr. Moo';
const CODIGO = (process.env.CODIGO_SYNC ?? String(Math.floor(100000 + Math.random() * 900000))).trim();
const LIMITE_CORPO = 64 * 1024 * 1024;

export interface OpcoesServidor {
  codigo?: string;
  propriedade?: string;
  /** Arquivo de estado. `null` mantém a base só em memória (usado nos testes). */
  arquivoEstado?: string | null;
}

interface Estado {
  instantaneo: Instantaneo;
  dispositivos: DispositivoConhecido[];
}

function carregarEstado(arquivo: string | null): Estado {
  if (!arquivo) return { instantaneo: instantaneoVazio('servidor'), dispositivos: [] };
  try {
    const bruto = JSON.parse(readFileSync(arquivo, 'utf8')) as Partial<Estado>;
    return {
      instantaneo: validarInstantaneo(bruto.instantaneo),
      dispositivos: Array.isArray(bruto.dispositivos) ? bruto.dispositivos : [],
    };
  } catch {
    // Primeira execução (ou arquivo de uma versão anterior do protocolo).
    return { instantaneo: instantaneoVazio('servidor'), dispositivos: [] };
  }
}

function salvarEstado(estado: Estado, arquivo: string | null): void {
  if (!arquivo) return;
  mkdirSync(dirname(arquivo), { recursive: true });
  writeFileSync(arquivo, JSON.stringify(estado), 'utf8');
}

function responder(res: ServerResponse, status: number, corpo: unknown): void {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(texto),
    // O app é servido pelo Metro (porta 8081) e o servidor escuta na 8787:
    // origens diferentes, dentro da mesma máquina da mesma LAN.
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'cache-control': 'no-store',
  });
  res.end(texto);
}

function lerCorpo(req: IncomingMessage): Promise<string> {
  return new Promise((aceitar, rejeitar) => {
    const partes: Buffer[] = [];
    let total = 0;
    req.on('data', (parte: Buffer) => {
      total += parte.length;
      if (total > LIMITE_CORPO) {
        rejeitar(new Error('corpo da requisição grande demais'));
        req.destroy();
        return;
      }
      partes.push(parte);
    });
    req.on('end', () => aceitar(Buffer.concat(partes).toString('utf8')));
    req.on('error', rejeitar);
  });
}

/**
 * Monta o servidor sem subir: assim a suíte consegue exercitar as rotas de
 * verdade numa porta efêmera, sem processo separado e sem tocar em disco.
 */
export function criarServidor(opcoes: OpcoesServidor = {}) {
  const codigo = (opcoes.codigo ?? CODIGO).trim();
  const propriedade = opcoes.propriedade ?? PROPRIEDADE;
  const arquivo = opcoes.arquivoEstado === undefined ? ARQUIVO_ESTADO : opcoes.arquivoEstado;
  const estado = carregarEstado(arquivo);

  function registrarDispositivo(nome: string, linhas: number): void {
    const visto = new Date().toISOString();
    const existente = estado.dispositivos.find((d) => d.nome === nome);
    if (existente) Object.assign(existente, { visto, linhas });
    else estado.dispositivos.push({ nome, visto, linhas });
  }

  const servidor = createServer((req, res) => {
    const caminho = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`).pathname;

    if (req.method === 'OPTIONS') {
      responder(res, 204, {});
      return;
    }

    if (req.method === 'GET' && (caminho === '/saude' || caminho === '/')) {
      responder(res, 200, {
        ok: true,
        servico: 'drmoo-sync',
        versao: estado.instantaneo.versao,
        propriedade,
        dispositivos: estado.dispositivos,
      });
      return;
    }

    if (req.method === 'POST' && caminho === '/sincronizar') {
      void (async () => {
        try {
          const corpo = JSON.parse(await lerCorpo(req)) as { codigo?: string; instantaneo?: unknown };
          if (String(corpo.codigo ?? '').trim() !== codigo) {
            responder(res, 401, { erro: 'Código de pareamento incorreto. Confira o código no servidor.' });
            return;
          }
          const recebido = validarInstantaneo(corpo.instantaneo);
          estado.instantaneo = mesclar(estado.instantaneo, recebido);
          registrarDispositivo(recebido.dispositivo, contarLinhas(recebido));
          salvarEstado(estado, arquivo);
          if (arquivo) {
            console.log(
              `[sync] ${recebido.dispositivo}: ${contarLinhas(recebido)} linhas recebidas, ` +
                `${contarLinhas(estado.instantaneo)} na base mesclada`,
            );
          }
          responder(res, 200, { instantaneo: estado.instantaneo, dispositivos: estado.dispositivos });
        } catch (e) {
          responder(res, 400, { erro: e instanceof Error ? e.message : String(e) });
        }
      })();
      return;
    }

    responder(res, 404, { erro: 'rota desconhecida' });
  });

  return { servidor, estado, codigo };
}

function enderecosLocais(porta: number): string[] {
  return Object.values(networkInterfaces())
    .flatMap((lista) => lista ?? [])
    .filter((i) => i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i.address}:${porta}`);
}

/** Sobe o servidor e imprime o endereço e o código para os aparelhos. */
export function iniciar(porta = PORTA): void {
  const { servidor, estado, codigo } = criarServidor();
  servidor.listen(porta, () => {
    const enderecos = enderecosLocais(porta);
    console.log(`\n  Dr. Moo — servidor de sincronização da propriedade`);
    console.log(`  Código de pareamento: ${codigo}\n`);
    console.log(`  Endereço para os aparelhos (mesma rede Wi-Fi):`);
    for (const e of enderecos.length ? enderecos : [`http://localhost:${porta}`]) console.log(`    ${e}`);
    console.log(`\n  Base guardada em ${ARQUIVO_ESTADO}`);
    console.log(
      `  ${contarLinhas(estado.instantaneo)} linhas, ${estado.dispositivos.length} aparelho(s) conhecido(s)\n`,
    );
  });
}
