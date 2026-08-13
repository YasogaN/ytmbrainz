import { describe, expect, it } from 'bun:test';
import { HttpRateLimiter } from '@/server/httpRateLimit';

describe('HttpRateLimiter', () => {
  it('allows requests within the limit', () => {
    const limiter = new HttpRateLimiter(2);

    expect(limiter.allow('ip-1')).toBe(true);
    expect(limiter.allow('ip-1')).toBe(true);
    expect(limiter.allow('ip-1')).toBe(false);
  });

  it('limits per key independently', () => {
    const limiter = new HttpRateLimiter(1);

    expect(limiter.allow('ip-1')).toBe(true);
    expect(limiter.allow('ip-1')).toBe(false);
    expect(limiter.allow('ip-2')).toBe(true);
  });

  it('resets the window after the interval', async () => {
    const limiter = new HttpRateLimiter(1, 20);

    expect(limiter.allow('ip-1')).toBe(true);
    expect(limiter.allow('ip-1')).toBe(false);

    await new Promise(resolve => setTimeout(resolve, 25));
    expect(limiter.allow('ip-1')).toBe(true);
  });

  it('is disabled with a zero limit', () => {
    const limiter = new HttpRateLimiter(0);

    expect(limiter.allow('ip-1')).toBe(true);
    expect(limiter.allow('ip-1')).toBe(true);
  });

  it('clears all windows on reset', () => {
    const limiter = new HttpRateLimiter(1);

    limiter.allow('ip-1');
    expect(limiter.allow('ip-1')).toBe(false);
    limiter.reset();
    expect(limiter.allow('ip-1')).toBe(true);
  });
});
