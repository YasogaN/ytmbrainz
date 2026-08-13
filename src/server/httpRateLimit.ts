interface Window {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window per-key rate limiter. A window length of zero or a max request
 * count of zero disables limiting entirely.
 */
export class HttpRateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs = 1000,
  ) {}

  allow(key: string): boolean {
    if (this.maxRequests <= 0) {
      return true;
    }
    const now = Date.now();
    const entry = this.windows.get(key);
    if (entry === undefined || entry.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (entry.count >= this.maxRequests) {
      return false;
    }
    entry.count += 1;
    return true;
  }

  reset(): void {
    this.windows.clear();
  }
}
