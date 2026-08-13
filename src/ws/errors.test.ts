import { describe, expect, it } from 'bun:test';
import { badRequest, errorToResponse, notFound, serviceUnavailable, WsError } from '@/ws/errors';

describe('errorToResponse', () => {
  it('serializes a 400 as JSON', async () => {
    const response = errorToResponse(badRequest('Invalid mbid.'), 'json');

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      help: 'https://musicbrainz.org/development/mmd',
      error: 'Invalid mbid.',
    });
  });

  it('serializes a 400 as XML', async () => {
    const response = errorToResponse(badRequest('Invalid mbid.'), 'xml');

    expect(response.status).toBe(400);
    expect(await response.text()).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><error><text>Invalid mbid.</text>' +
        '<text>https://musicbrainz.org/development/mmd</text></error>',
    );
  });

  it('omits the help link when disabled', async () => {
    const response = errorToResponse(new WsError(503, 'Down.', false), 'json');
    expect(await response.json()).toEqual({ error: 'Down.' });
  });

  it('carries the status code through', () => {
    expect(errorToResponse(notFound('Missing.'), 'xml').status).toBe(404);
    expect(errorToResponse(serviceUnavailable(), 'xml').status).toBe(503);
  });

  it('escapes XML text', async () => {
    const response = errorToResponse(badRequest('bad <tag> & "quote"'), 'xml');
    const text = await response.text();

    expect(text).toContain('<text>bad &lt;tag&gt; &amp; &quot;quote&quot;</text>');
  });
});
