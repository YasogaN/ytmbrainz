import { Impit } from 'impit';

let cached: typeof fetch | null = null;

export interface BrowserFetchDeps {
  /** Overridable for tests. */
  createImpit?: (options: { browser: 'chrome' }) => { fetch: typeof fetch };
}

/**
 * Creates a fetch-compatible client that impersonates a real Chrome browser
 * at the TLS fingerprint and HTTP header level, so outbound requests to
 * YouTube and Google look like genuine browser traffic instead of an HTTP
 * client. Falls back to the native fetch when the impit native binding is
 * unavailable.
 */
export function createBrowserFetch(deps: BrowserFetchDeps = {}): typeof fetch {
  const createImpit =
    deps.createImpit ??
    ((options: { browser: 'chrome' }) =>
      // impit.fetch is fetch-compatible but returns ImpitResponse (a
      // structural Response), so the static type needs a cast.
      new Impit(options) as unknown as { fetch: typeof fetch });
  try {
    const impit = createImpit({ browser: 'chrome' });
    return impit.fetch.bind(impit);
  } catch {
    return fetch;
  }
}

/** A lazily-created, process-wide browser-impersonating fetch. */
export function browserFetch(): typeof fetch {
  if (cached === null) {
    cached = createBrowserFetch();
  }
  return cached;
}
