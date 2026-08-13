import { describe, expect, it } from 'bun:test';
import { resolveFormat } from '@/ws/format';

describe('resolveFormat', () => {
  it('defaults to xml', () => {
    expect(resolveFormat(null, null)).toBe('xml');
  });

  it('honors fmt=json', () => {
    expect(resolveFormat('json', null)).toBe('json');
  });

  it('honors fmt=xml', () => {
    expect(resolveFormat('xml', 'application/json')).toBe('xml');
  });

  it('honors the Accept header', () => {
    expect(resolveFormat(null, 'application/json')).toBe('json');
    expect(resolveFormat(null, 'text/html, application/json;q=0.9')).toBe('json');
    expect(resolveFormat(null, 'application/xml')).toBe('xml');
  });
});
