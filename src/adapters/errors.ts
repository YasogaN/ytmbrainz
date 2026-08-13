export class UpstreamError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean, options?: ErrorOptions) {
    super(message, options);
    this.retryable = retryable;
  }
}

export type UpstreamErrorKind = 'not-found' | 'blocked' | 'upstream';

const STATUS_PATTERN = /status code (\d{3})/;

const NOT_FOUND_PATTERNS = [
  'video unavailable',
  'not available',
  'not found',
  "couldn't find",
  'could not find',
  'unable to find',
  'unable to load',
  'does not exist',
  "doesn't exist",
  'is private',
  'private video',
];

const BLOCKED_PATTERNS = [
  'sign in to confirm',
  'not a bot',
  'captcha',
  'bot detection',
  'bot verification',
];

export function classifyUpstreamError(error: unknown): UpstreamErrorKind {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  const status = STATUS_PATTERN.exec(message)?.[1];
  if (status === '403' || BLOCKED_PATTERNS.some(pattern => lower.includes(pattern))) {
    return 'blocked';
  }
  if (status === '404' || NOT_FOUND_PATTERNS.some(pattern => lower.includes(pattern))) {
    return 'not-found';
  }
  if (status !== undefined && status !== '429') {
    return 'blocked';
  }
  return 'upstream';
}

/**
 * Maps an upstream failure to a lookup result: not-found becomes `null` (404),
 * anything else becomes an UpstreamError (503). Used inside `catch` blocks so
 * transient YouTube failures are never reported as a missing entity.
 */
export function toNotFoundOrThrow(error: unknown): null {
  const kind = classifyUpstreamError(error);
  if (kind === 'not-found') {
    return null;
  }
  const message = error instanceof Error ? error.message : String(error);
  throw new UpstreamError(message, kind === 'upstream', { cause: error });
}
