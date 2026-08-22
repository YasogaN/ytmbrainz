import { describe, expect, it } from 'bun:test';
import { BgUtilsTokenMinter } from '@/adapters/bgutils';

/**
 * A minimal stand-in for the BotGuard interpreter. It registers the expected
 * global, wires a fake asyncSnapshotFunction that pushes a fake WebPO minter
 * into the signal output array, and resolves the snapshot with a fake
 * BotGuard response.
 */
const FAKE_VM_SCRIPT = `
  globalThis.trayride = {
    a: async (program, setupCallback) => {
      setupCallback(
        (callback, args) => {
          args[2].push(async () => async () => new Uint8Array([1, 2, 3]));
          callback('fake-botguard-response');
        },
        () => {},
        () => {},
        () => {},
      );
      return [async () => {}];
    },
  };
`;

const challengeJson = (script: string) =>
  JSON.stringify([[null, [script], [null], null, 'program-abc', 'trayride']]);

const integrityJson = JSON.stringify(['aW50ZWdyaXR5LXRva2Vu', 43200, 100, 'fallback']);

const fakeFetch = (
  bodies: Record<string, string> = {
    Create: challengeJson(FAKE_VM_SCRIPT),
    GenerateIT: integrityJson,
  },
): typeof fetch =>
  (async (url, _init) => {
    const urlString = String(url);
    if (urlString.endsWith('/Create')) {
      return new Response(bodies.Create);
    }
    if (urlString.endsWith('/GenerateIT')) {
      return new Response(bodies.GenerateIT);
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;

describe('BgUtilsTokenMinter', () => {
  it('mints a websafe token bound to the visitor data', async () => {
    const minter = new BgUtilsTokenMinter({ fetchFunction: fakeFetch() });

    const result = await minter.mint('Cgt2aXNpdG9y');

    expect(result).toEqual({ token: 'AQID', ttlSecs: 43200 });
    expect(globalThis.window).toBeDefined();
    expect(globalThis.document).toBeDefined();
    expect(globalThis.location).toBeDefined();
    expect(globalThis.origin).toBe('https://www.youtube.com');
  });

  it('reuses the installed DOM shim on later mints', async () => {
    const first = new BgUtilsTokenMinter({ fetchFunction: fakeFetch() });
    await first.mint('binding-1');

    const second = new BgUtilsTokenMinter({ fetchFunction: fakeFetch() });
    const result = await second.mint('binding-2');

    expect(result.token).toBe('AQID');
  });

  it('sends the configured request key to both WAA endpoints', async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fetchFunction = (async (url, init) => {
      calls.push({ url: String(url), body: String(init?.body) });
      if (String(url).endsWith('/Create')) {
        return new Response(challengeJson(FAKE_VM_SCRIPT));
      }
      return new Response(integrityJson);
    }) as typeof fetch;
    const minter = new BgUtilsTokenMinter({ fetchFunction, requestKey: 'my-request-key' });

    await minter.mint('binding');

    expect(calls).toHaveLength(2);
    expect(calls[0]?.body).toContain('my-request-key');
    expect(calls[1]?.body).toContain('my-request-key');
  });

  it('uses the evalScript hook to run the interpreter', async () => {
    const evaluated: string[] = [];
    const minter = new BgUtilsTokenMinter({
      fetchFunction: fakeFetch(),
      evalScript: script => {
        evaluated.push(script);
        new Function(script)();
      },
    });

    await minter.mint('binding');

    expect(evaluated).toEqual([FAKE_VM_SCRIPT]);
  });

  it('throws when the challenge has no interpreter script', async () => {
    const minter = new BgUtilsTokenMinter({
      fetchFunction: fakeFetch({ Create: JSON.stringify([[null, [], [null], null, 'p', 'g']]) }),
    });

    await expect(minter.mint('binding')).rejects.toThrow('interpreter script');
  });

  it('throws when the integrity token request fails', async () => {
    const fetchFunction = (async url => {
      if (String(url).endsWith('/Create')) {
        return new Response(challengeJson(FAKE_VM_SCRIPT));
      }
      return new Response('boom', { status: 500 });
    }) as typeof fetch;
    const minter = new BgUtilsTokenMinter({ fetchFunction });

    await expect(minter.mint('binding')).rejects.toThrow('500');
  });
});
