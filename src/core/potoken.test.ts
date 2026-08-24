import { describe, expect, it } from 'bun:test';
import { PoTokenGenerator, type PoTokenMinter, type PoTokenResult } from '@/core/potoken';

const BINDING = 'Cgt2aXNpdG9y';

const deferred = () => {
  let resolve!: (value: PoTokenResult) => void;
  const promise = new Promise<PoTokenResult>(res => {
    resolve = res;
  });
  return { promise, resolve };
};

const countingMinter = () => {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    mint: async (): Promise<PoTokenResult> => {
      calls += 1;
      return { token: `token-${calls}`, ttlSecs: 100 };
    },
  };
};

const fakeClock = (initial: number) => {
  let time = initial;
  return { now: () => time, advance: (ms: number) => (time += ms) };
};

describe('PoTokenGenerator', () => {
  it('mints on first use then serves the cached token', async () => {
    const clock = fakeClock(1_000_000);
    const minter = countingMinter();
    const generator = new PoTokenGenerator(BINDING, { minter, now: clock.now });

    expect(await generator.getToken()).toBe('token-1');
    expect(await generator.getToken()).toBe('token-1');
    expect(minter.calls).toBe(1);
  });

  it('re-mints once the refresh window has passed', async () => {
    const clock = fakeClock(1_000_000);
    const minter = countingMinter();
    const generator = new PoTokenGenerator(BINDING, {
      minter,
      refreshFraction: 0.25,
      now: clock.now,
    });

    expect(await generator.getToken()).toBe('token-1');

    clock.advance(75_000); // 75% of the 100s TTL elapsed
    expect(await generator.getToken()).toBe('token-2');
    expect(minter.calls).toBe(2);
  });

  it('shares an in-flight mint between concurrent callers', async () => {
    const gate = deferred();
    const minter: PoTokenMinter = { mint: () => gate.promise };
    const generator = new PoTokenGenerator(BINDING, { minter });

    const first = generator.getToken();
    const second = generator.getToken();
    gate.resolve({ token: 'shared', ttlSecs: 100 });

    expect(await first).toBe('shared');
    expect(await second).toBe('shared');
  });

  it('keeps the previous token when a refresh fails', async () => {
    const clock = fakeClock(1_000_000);
    let calls = 0;
    const minter: PoTokenMinter = {
      mint: async () => {
        calls += 1;
        if (calls === 2) {
          throw new Error('mint failed');
        }
        return { token: `token-${calls}`, ttlSecs: 100 };
      },
    };
    const generator = new PoTokenGenerator(BINDING, { minter, now: clock.now });

    expect(await generator.getToken()).toBe('token-1');

    clock.advance(75_000);
    expect(await generator.getToken()).toBe('token-1');
    expect(calls).toBe(2);
  });

  it('returns null when the very first mint fails', async () => {
    const minter: PoTokenMinter = {
      mint: async () => {
        throw new Error('mint failed');
      },
    };
    const generator = new PoTokenGenerator(BINDING, { minter });

    expect(await generator.getToken()).toBeNull();
  });

  it('uses the default refresh fraction', async () => {
    const clock = fakeClock(1_000_000);
    const minter = countingMinter();
    const generator = new PoTokenGenerator(BINDING, { minter, now: clock.now });

    expect(await generator.getToken()).toBe('token-1');

    clock.advance(74_999); // 74.999% elapsed: still fresh
    expect(await generator.getToken()).toBe('token-1');

    clock.advance(1); // 75% elapsed: refresh
    expect(await generator.getToken()).toBe('token-2');
    expect(minter.calls).toBe(2);
  });
});
