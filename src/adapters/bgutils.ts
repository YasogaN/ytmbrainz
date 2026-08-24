import { BotGuardClient, getChallenge } from 'bgutils-js/botguard';
import type { WebPoSignalOutput } from 'bgutils-js/shared-types';
import { buildURL, getHeaders, USER_AGENT } from 'bgutils-js/utils';
import { WebPoMinter } from 'bgutils-js/webpo';
import { JSDOM } from 'jsdom';
import { browserFetch } from '@/adapters/http';
import type { PoTokenMinter, PoTokenResult } from '@/core/potoken';

export const PO_REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';

export interface BgUtilsMinterOptions {
  requestKey?: string;
  fetchFunction?: typeof fetch;
  evalScript?: (script: string) => void;
}

/**
 * Mints PO tokens by running Google's BotGuard interpreter in a DOM shim,
 * fetching a Web Anti-Abuse challenge, and minting a WebPO proof bound to the
 * given visitor data. Every mint starts from a fresh challenge so the
 * integrity token never goes stale for long-running servers.
 */
export class BgUtilsTokenMinter implements PoTokenMinter {
  private readonly requestKey: string;
  private readonly fetchFunction: typeof fetch;
  private readonly evalScript: (script: string) => void;

  constructor(options: BgUtilsMinterOptions = {}) {
    this.requestKey = options.requestKey ?? PO_REQUEST_KEY;
    this.fetchFunction = options.fetchFunction ?? browserFetch();
    this.evalScript = options.evalScript ?? (script => new Function(script)());
  }

  private async setupMinter(): Promise<{ minter: WebPoMinter; ttlSecs: number }> {
    installDomShim();
    const challenge = await getChallenge({
      fetchFunction: this.fetchFunction,
      requestKey: this.requestKey,
    });
    const script = challenge.interpreterJavascript?.privateDoNotAccessOrElseSafeScriptWrappedValue;
    if (script === undefined) {
      throw new Error('BotGuard interpreter script not available');
    }
    this.evalScript(script);
    // BotGuardClient.create validates that program and globalName are present.
    const client = await BotGuardClient.create({
      program: challenge.program as string,
      globalName: challenge.globalName as string,
      globalObject: globalThis,
    });
    const webPoSignalOutput: WebPoSignalOutput = [];
    const botguardResponse = await client.snapshot({ webPoSignalOutput });
    const response = await this.fetchFunction(buildURL('GenerateIT', true), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify([this.requestKey, botguardResponse]),
    });
    if (!response.ok) {
      throw new Error(`Integrity token request failed: ${response.status}`);
    }
    const [integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken] =
      (await response.json()) as [string, number, number, string];
    const minter = await WebPoMinter.create(
      { integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken },
      webPoSignalOutput,
    );
    return { minter, ttlSecs: estimatedTtlSecs };
  }

  async mint(binding: string): Promise<PoTokenResult> {
    const { minter, ttlSecs } = await this.setupMinter();
    const token = await minter.mintAsWebsafeString(binding);
    return { token, ttlSecs };
  }
}

let domInstalled = false;

/**
 * The BotGuard interpreter expects browser globals (`window`, `document`,
 * `location`, `origin`, `navigator`) anchored to youtube.com. Bun provides
 * most of them natively; a jsdom window fills in the gaps.
 */
function installDomShim(): void {
  if (domInstalled) {
    return;
  }
  const dom = new JSDOM(
    '<!DOCTYPE html><html lang="en"><head><title></title></head><body></body></html>',
    {
      url: 'https://www.youtube.com/',
      referrer: 'https://www.youtube.com/',
      resources: { userAgent: USER_AGENT },
    },
  );
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    location: dom.window.location,
    origin: dom.window.origin,
  });
  Object.defineProperty(globalThis, 'navigator', {
    value: dom.window.navigator,
    configurable: true,
  });
  domInstalled = true;
}
