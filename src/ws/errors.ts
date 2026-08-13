import type { ResponseFormat } from '@/ws/format';

const HELP_URL = 'https://musicbrainz.org/development/mmd';

export class WsError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly help = true,
  ) {
    super(message);
  }
}

export function badRequest(message: string): WsError {
  return new WsError(400, message);
}

export function notFound(message: string): WsError {
  return new WsError(404, message);
}

export function serviceUnavailable(message = 'Backend service unavailable.'): WsError {
  return new WsError(503, message);
}

export function notImplemented(): WsError {
  return new WsError(501, 'Not implemented.');
}

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function contentType(format: ResponseFormat): string {
  return format === 'json' ? 'application/json; charset=utf-8' : 'application/xml; charset=utf-8';
}

export function errorToResponse(error: WsError, format: ResponseFormat): Response {
  let body: string;
  if (format === 'json') {
    body = JSON.stringify(
      error.help ? { help: HELP_URL, error: error.message } : { error: error.message },
    );
  } else {
    const text = `<text>${esc(error.message)}</text>`;
    const help = error.help ? `<text>${esc(HELP_URL)}</text>` : '';
    body = `<?xml version="1.0" encoding="UTF-8"?><error>${text}${help}</error>`;
  }
  return new Response(body, {
    status: error.status,
    headers: { 'content-type': contentType(format) },
  });
}
