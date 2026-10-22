/**
 * O servidor da propriedade, exercitado de verdade: sobe numa porta efêmera,
 * responde HTTP e mescla instantâneos. Sem tocar em disco (`arquivoEstado:
 * null`), para o teste não deixar rastro na máquina de ninguém.
 */
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { instantaneoVazio, type Instantaneo, type Linha } from '../src/index';
import { criarServidor } from '../src/servidor';

const CODIGO = '424242';

let base = '';
let fechar: () => Promise<void>;

function instantaneoCom(dispositivo: string, animais: Linha[]): Instantaneo {
  const i = instantaneoVazio(dispositivo, '2026-10-21T12:00:00.000Z');
  i.tabelas.animal = animais;
  return i;
}

const vaca = (id: string, nome: string, updated = '2026-10-20T10:00:00.000Z'): Linha => ({
  id,
  brinco: id,
  nome,
  updated_at: updated,
});

async function sincronizar(corpo: unknown) {
  const resposta = await fetch(`${base}/sincronizar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  return { status: resposta.status, json: (await resposta.json()) as Record<string, unknown> };
}

beforeEach(async () => {
  const { servidor } = criarServidor({ codigo: CODIGO, propriedade: 'Sítio de Teste', arquivoEstado: null });
  await new Promise<void>((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  const { port } = servidor.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
  fechar = () => new Promise<void>((ok) => servidor.close(() => ok()));
});

afterEach(async () => {
  await fechar();
});

describe('servidor de sincronização', () => {
  it('responde a /saude com o nome da propriedade e nenhum aparelho no começo', async () => {
    const resposta = await fetch(`${base}/saude`);
    const saude = (await resposta.json()) as { servico: string; propriedade: string; dispositivos: unknown[] };

    expect(resposta.status).toBe(200);
    expect(saude.servico).toBe('drmoo-sync');
    expect(saude.propriedade).toBe('Sítio de Teste');
    expect(saude.dispositivos).toEqual([]);
  });

  it('libera o navegador a chamar de outra origem (CORS)', async () => {
    const resposta = await fetch(`${base}/saude`);
    expect(resposta.headers.get('access-control-allow-origin')).toBe('*');

    const preflight = await fetch(`${base}/sincronizar`, { method: 'OPTIONS' });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('recusa código de pareamento errado', async () => {
    const { status, json } = await sincronizar({
      codigo: '000000',
      instantaneo: instantaneoCom('intruso', [vaca('A1', 'Mimosa')]),
    });

    expect(status).toBe(401);
    expect(String(json.erro)).toMatch(/código/i);
  });

  it('mescla os aparelhos e devolve a base combinada', async () => {
    await sincronizar({ codigo: CODIGO, instantaneo: instantaneoCom('celular', [vaca('A1', 'Mimosa')]) });
    const { status, json } = await sincronizar({
      codigo: CODIGO,
      instantaneo: instantaneoCom('tablet', [vaca('B1', 'Estrela')]),
    });

    expect(status).toBe(200);
    const instantaneo = json.instantaneo as Instantaneo;
    expect(instantaneo.tabelas.animal?.map((l) => l.id)).toEqual(['A1', 'B1']);
    expect((json.dispositivos as { nome: string }[]).map((d) => d.nome)).toEqual(['celular', 'tablet']);
  });

  it('a escrita mais recente vence no servidor', async () => {
    await sincronizar({
      codigo: CODIGO,
      instantaneo: instantaneoCom('celular', [vaca('A1', 'Mimosa', '2026-10-20T10:00:00.000Z')]),
    });
    const { json } = await sincronizar({
      codigo: CODIGO,
      instantaneo: instantaneoCom('tablet', [vaca('A1', 'Mimosa II', '2026-10-21T10:00:00.000Z')]),
    });

    const instantaneo = json.instantaneo as Instantaneo;
    expect(instantaneo.tabelas.animal?.[0]?.nome).toBe('Mimosa II');
  });

  it('o mesmo aparelho não entra duas vezes na lista', async () => {
    await sincronizar({ codigo: CODIGO, instantaneo: instantaneoCom('celular', [vaca('A1', 'Mimosa')]) });
    const { json } = await sincronizar({
      codigo: CODIGO,
      instantaneo: instantaneoCom('celular', [vaca('A1', 'Mimosa'), vaca('A2', 'Lua')]),
    });

    const dispositivos = json.dispositivos as { nome: string; linhas: number }[];
    expect(dispositivos).toHaveLength(1);
    expect(dispositivos[0]?.linhas).toBe(2);
  });

  it('recusa instantâneo de outra versão de protocolo', async () => {
    const { status, json } = await sincronizar({ codigo: CODIGO, instantaneo: { versao: 99, tabelas: {} } });

    expect(status).toBe(400);
    expect(String(json.erro)).toMatch(/protocolo/);
  });

  it('recusa corpo que não é JSON', async () => {
    const resposta = await fetch(`${base}/sincronizar`, { method: 'POST', body: 'nem json nem nada' });
    expect(resposta.status).toBe(400);
  });

  it('responde 404 em rota desconhecida', async () => {
    const resposta = await fetch(`${base}/qualquer-coisa`);
    expect(resposta.status).toBe(404);
  });
});
