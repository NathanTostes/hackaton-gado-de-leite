/**
 * O cliente fala com um servidor na rede da propriedade — rede que cai, que
 * demora e que às vezes responde outra coisa. O que o usuário vê nesses casos
 * é mensagem, não exceção crua: é isso que estes testes travam.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ErroDeSincronizacao,
  consultarSaude,
  enviarInstantaneo,
  instantaneoVazio,
  normalizarEndereco,
} from '../src/index';

function responderCom(corpo: unknown, status = 200): typeof fetch {
  return vi.fn(async () =>
    new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('endereço do servidor', () => {
  it('aceita IP puro, com porta, com esquema e com barra no fim', () => {
    expect(normalizarEndereco('192.168.0.10')).toBe('http://192.168.0.10:8787');
    expect(normalizarEndereco('192.168.0.10:9000')).toBe('http://192.168.0.10:9000');
    expect(normalizarEndereco('http://servidor.local/')).toBe('http://servidor.local:8787');
    expect(normalizarEndereco('  https://propriedade.exemplo  ')).toBe('https://propriedade.exemplo');
  });

  it('cobra um endereço quando o campo está vazio', () => {
    expect(() => normalizarEndereco('')).toThrow(ErroDeSincronizacao);
    expect(() => normalizarEndereco('   ')).toThrow(/endereço/i);
  });
});

describe('cliente de sincronização', () => {
  it('lê a saúde do servidor', async () => {
    vi.stubGlobal('fetch', responderCom({ ok: true, servico: 'drmoo-sync', propriedade: 'Sítio', dispositivos: [] }));

    const saude = await consultarSaude('http://192.168.0.10:8787');

    expect(saude.propriedade).toBe('Sítio');
  });

  it('envia o instantâneo e devolve o mesclado', async () => {
    const espiao = responderCom({ instantaneo: instantaneoVazio('servidor'), dispositivos: [] });
    vi.stubGlobal('fetch', espiao);

    const resposta = await enviarInstantaneo('http://192.168.0.10:8787', '123456', instantaneoVazio('celular'));

    expect(resposta.instantaneo.versao).toBe(1);
    const [url, init] = (espiao as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(url).toBe('http://192.168.0.10:8787/sincronizar');
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain('"codigo":"123456"');
  });

  it('explica a falha de rede em vez de vazar o erro do fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    await expect(consultarSaude('http://192.168.0.10:8787')).rejects.toThrow(/mesma rede Wi-Fi/);
  });

  it('usa a mensagem de erro que o servidor mandou', async () => {
    vi.stubGlobal('fetch', responderCom({ erro: 'Código de pareamento incorreto.' }, 401));

    await expect(
      enviarInstantaneo('http://192.168.0.10:8787', '000000', instantaneoVazio('celular')),
    ).rejects.toThrow(/Código de pareamento incorreto/);
  });

  it('não quebra quando o erro do servidor não é JSON', async () => {
    vi.stubGlobal('fetch', responderCom('502 Bad Gateway', 502));

    const erro = await enviarInstantaneo('http://x:8787', '1', instantaneoVazio('a')).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroDeSincronizacao);
    expect((erro as ErroDeSincronizacao).status).toBe(502);
  });

  it('desiste quando o servidor não responde a tempo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolver, rejeitar) => {
            init.signal?.addEventListener('abort', () => rejeitar(new Error('aborted')));
          }),
      ),
    );
    // Relógio falso: o teste não pode gastar os segundos reais do tempo limite.
    vi.useFakeTimers();

    const promessa = consultarSaude('http://192.168.0.10:8787');
    const esperado = expect(promessa).rejects.toThrow(/não respondeu a tempo/);
    await vi.advanceTimersByTimeAsync(6_000);
    await esperado;

    vi.useRealTimers();
  });
});
