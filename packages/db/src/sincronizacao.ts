/**
 * Sincronização do banco local com outro aparelho da mesma rede.
 *
 * Fluxo de uma sincronização (uma única ida e volta):
 *
 *   1. o aparelho gera o instantâneo do seu banco;
 *   2. envia ao servidor da propriedade, que mescla com o que já tinha;
 *   3. recebe de volta o resultado mesclado e grava só o que mudou.
 *
 * A mesclagem é a mesma função nos dois lados (`@drmoo/sync`), então os dois
 * aparelhos convergem para a mesma base. Tudo acontece dentro da rede Wi-Fi da
 * propriedade — não há nuvem, conta de usuário nem acesso à internet.
 */
import {
  TABELAS_SINCRONIZADAS,
  VERSAO_PROTOCOLO,
  consultarSaude,
  contarLinhas,
  diferenca,
  enviarInstantaneo,
  normalizarEndereco,
  type DispositivoConhecido,
  type Instantaneo,
  type Linha,
  type ResultadoSincronizacao,
  type Saude,
} from '@drmoo/sync';
import { abrirBanco, agoraISO, consultar, executar, gravarMeta, lerMeta, novoId, type Parametro } from './driver';

const CHAVE_ENDERECO = 'sync_endereco';
const CHAVE_CODIGO = 'sync_codigo';
const CHAVE_DISPOSITIVO = 'sync_dispositivo';
const CHAVE_ULTIMA = 'sync_ultima';

export interface ConfiguracaoSync {
  endereco: string;
  codigo: string;
  dispositivo: string;
  ultimaSincronizacao: string | null;
}

/** Nome padrão do aparelho: identifica a linha na lista do servidor. */
function nomePadrao(): string {
  return `aparelho-${novoId('').split('_')[1] ?? Date.now().toString(36)}`;
}

export async function configuracaoSync(): Promise<ConfiguracaoSync> {
  await abrirBanco();
  let dispositivo = await lerMeta(CHAVE_DISPOSITIVO);
  if (!dispositivo) {
    dispositivo = nomePadrao();
    await gravarMeta(CHAVE_DISPOSITIVO, dispositivo);
  }
  return {
    endereco: (await lerMeta(CHAVE_ENDERECO)) ?? '',
    codigo: (await lerMeta(CHAVE_CODIGO)) ?? '',
    dispositivo,
    ultimaSincronizacao: await lerMeta(CHAVE_ULTIMA),
  };
}

export async function salvarConfiguracaoSync(c: Partial<ConfiguracaoSync>): Promise<void> {
  await abrirBanco();
  if (c.endereco !== undefined) await gravarMeta(CHAVE_ENDERECO, c.endereco);
  if (c.codigo !== undefined) await gravarMeta(CHAVE_CODIGO, c.codigo);
  if (c.dispositivo) await gravarMeta(CHAVE_DISPOSITIVO, c.dispositivo);
}

/** Colunas reais da tabela neste aparelho — o esquema pode estar numa versão diferente. */
async function colunasDe(tabela: string): Promise<string[]> {
  const linhas = await consultar<{ name: string }>(`PRAGMA table_info(${tabela})`, []);
  return linhas.map((l) => l.name);
}

export async function instantaneoLocal(dispositivo?: string): Promise<Instantaneo> {
  const config = await configuracaoSync();
  const tabelas: Record<string, Linha[]> = {};
  for (const t of TABELAS_SINCRONIZADAS) {
    tabelas[t] = await consultar<Linha>(`SELECT * FROM ${t} ORDER BY id`, []);
  }
  return {
    versao: VERSAO_PROTOCOLO,
    dispositivo: dispositivo ?? config.dispositivo,
    geradoEm: agoraISO(),
    tabelas,
  };
}

/**
 * Grava as linhas vindas do outro aparelho.
 *
 * Linha a linha, e não em bloco: uma única linha recusada (brinco repetido
 * criado nos dois aparelhos, por exemplo) não pode derrubar a sincronização
 * inteira — ela vira um conflito relatado ao usuário, e o resto entra.
 */
export async function aplicarLinhas(
  porTabela: Record<string, Linha[]>,
): Promise<Pick<ResultadoSincronizacao, 'aplicadas' | 'conflitos'>> {
  const aplicadas: Record<string, number> = {};
  const conflitos: ResultadoSincronizacao['conflitos'] = [];

  const operacoes: { tabela: string; id: string; sql: string; params: Parametro[] }[] = [];
  for (const tabela of TABELAS_SINCRONIZADAS) {
    const linhas = porTabela[tabela];
    if (!linhas?.length) continue;
    const colunas = new Set(await colunasDe(tabela));

    for (const linha of linhas) {
      const nomes = Object.keys(linha).filter((c) => colunas.has(c));
      if (!nomes.includes('id')) continue;
      const atribuicoes = nomes.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`);
      const sql =
        `INSERT INTO ${tabela} (${nomes.join(', ')}) VALUES (${nomes.map(() => '?').join(', ')}) ` +
        (atribuicoes.length ? `ON CONFLICT(id) DO UPDATE SET ${atribuicoes.join(', ')}` : 'ON CONFLICT(id) DO NOTHING');
      operacoes.push({ tabela, id: String(linha.id), sql, params: nomes.map((c) => linha[c] as Parametro) });
    }
  }

  await emTransacao(async () => {
    // Mantém as constraints ativas e tenta novamente quem dependia de uma linha
    // ainda não gravada (por exemplo, filha cadastrada antes da mãe).
    // Ao parar de avançar, os conflitos reais são relatados sem desfazer os válidos.
    let pendentes = operacoes;
    while (pendentes.length) {
      const recusadas: typeof operacoes = [];
      const erros: typeof conflitos = [];
      for (const op of pendentes) {
        try {
          await executar(op.sql, op.params);
          aplicadas[op.tabela] = (aplicadas[op.tabela] ?? 0) + 1;
        } catch (e) {
          recusadas.push(op);
          erros.push({ tabela: op.tabela, id: op.id, motivo: e instanceof Error ? e.message : String(e) });
        }
      }
      if (recusadas.length === pendentes.length) {
        conflitos.push(...erros);
        break;
      }
      pendentes = recusadas;
    }
  });

  return { aplicadas, conflitos };
}

export async function verificarServidor(endereco: string): Promise<Saude> {
  return consultarSaude(normalizarEndereco(endereco));
}

export interface OpcoesSincronizacao {
  endereco: string;
  codigo: string;
  dispositivo?: string;
  /** Guarda endereço e código para a próxima vez (padrão: sim). */
  lembrar?: boolean;
}

export async function sincronizar(opcoes: OpcoesSincronizacao): Promise<ResultadoSincronizacao> {
  const base = normalizarEndereco(opcoes.endereco);
  const config = await configuracaoSync();
  const dispositivo = opcoes.dispositivo?.trim() || config.dispositivo;

  const local = await instantaneoLocal(dispositivo);
  const resposta = await enviarInstantaneo(base, opcoes.codigo.trim(), local);

  const novidades = diferenca(local, resposta.instantaneo);
  const { aplicadas, conflitos } = await aplicarLinhas(novidades);

  const em = agoraISO();
  if (opcoes.lembrar !== false) {
    await salvarConfiguracaoSync({ endereco: base, codigo: opcoes.codigo.trim(), dispositivo });
  }
  await gravarMeta(CHAVE_ULTIMA, em);

  return {
    aplicadas,
    conflitos,
    enviadas: contarLinhas(local),
    dispositivos: resposta.dispositivos as DispositivoConhecido[],
    servidor: base,
    em,
  };
}
