import { BgUtilsTokenMinter } from '@/adapters/bgutils';
import { PoTokenGenerator } from '@/core/potoken';

/**
 * One-shot PO token generator. Mints a Proof of Origin token bound to a
 * visitor data string and prints it, so you can populate YTMB_PO_TOKEN (or
 * YTMB_VISITOR_DATA + YTMB_PO_TOKEN on the live-test runner).
 *
 * Usage:
 *   YTMB_VISITOR_DATA=... bun run gen:potoken
 *   bun run gen:potoken -- --visitor-data=...
 */
function readVisitorData(): string | null {
  const flag = process.argv.find(arg => arg.startsWith('--visitor-data='));
  const fromFlag = flag?.slice('--visitor-data='.length);
  return fromFlag !== undefined && fromFlag !== ''
    ? fromFlag
    : (process.env.YTMB_VISITOR_DATA ?? null);
}

async function main(): Promise<void> {
  const visitorData = readVisitorData();
  if (visitorData === null) {
    console.error('No visitor data. Pass --visitor-data=<value> or set YTMB_VISITOR_DATA.');
    process.exit(1);
  }
  const generator = new PoTokenGenerator(visitorData, {
    minter: new BgUtilsTokenMinter(),
  });
  const token = await generator.getToken();
  if (token === null) {
    console.error('Failed to mint a PO token.');
    process.exit(1);
  }
  console.log(token);
}

await main();
