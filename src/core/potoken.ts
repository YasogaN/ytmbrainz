export interface PoTokenResult {
  /** A websafe-base64 Proof of Origin token. */
  token: string;
  /** Lifetime of the token in seconds. */
  ttlSecs: number;
}

export interface PoTokenMinter {
  /** Mints a fresh PO token bound to `binding` (e.g. a visitor data string). */
  mint(binding: string): Promise<PoTokenResult>;
}

export interface PoTokenGeneratorOptions {
  minter: PoTokenMinter;
  /**
   * Fraction of the TTL to keep in reserve before re-minting. With the default
   * `0.25` a token minted for 12 hours is re-minted after 9 hours.
   */
  refreshFraction?: number;
  /** Clock used for TTL bookkeeping; injectable for tests. */
  now?: () => number;
}

/**
 * Caches minted PO tokens and re-mints before they expire, so callers always
 * receive a currently-valid token without stampeding the minter. If a refresh
 * fails, the previous token is kept as a graceful fallback.
 */
export class PoTokenGenerator {
  private readonly minter: PoTokenMinter;
  private readonly refreshFraction: number;
  private readonly now: () => number;
  private token: string | null = null;
  private mintedAtMs = 0;
  private ttlMs = 0;
  private inFlight: Promise<string | null> | null = null;

  constructor(
    private readonly binding: string,
    options: PoTokenGeneratorOptions,
  ) {
    this.minter = options.minter;
    this.refreshFraction = options.refreshFraction ?? 0.25;
    this.now = options.now ?? Date.now;
  }

  private isFresh(now: number): boolean {
    return this.token !== null && now - this.mintedAtMs < this.ttlMs * (1 - this.refreshFraction);
  }

  private async mint(): Promise<string | null> {
    try {
      const result = await this.minter.mint(this.binding);
      this.token = result.token;
      this.ttlMs = result.ttlSecs * 1000;
      this.mintedAtMs = this.now();
    } catch {
      // Keep the previous token; it may still be accepted upstream.
    }
    return this.token;
  }

  /** Returns a valid token, minting a fresh one first if the cache is stale. */
  getToken(): Promise<string | null> {
    if (this.isFresh(this.now())) {
      return Promise.resolve(this.token);
    }
    if (this.inFlight === null) {
      this.inFlight = this.mint().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }
}
