import { describe, expect, it } from 'bun:test';
import { classifyUpstreamError, toNotFoundOrThrow, UpstreamError } from '@/adapters/errors';

describe('classifyUpstreamError', () => {
  it('classifies missing entities as not-found', () => {
    expect(classifyUpstreamError(new Error('Video unavailable'))).toBe('not-found');
    expect(classifyUpstreamError(new Error('Request ... failed with status code 404'))).toBe(
      'not-found',
    );
    expect(classifyUpstreamError(new Error('the recording does not exist'))).toBe('not-found');
  });

  it('classifies bot walls and client errors as blocked', () => {
    expect(classifyUpstreamError(new Error('Sign in to confirm you are not a bot'))).toBe(
      'blocked',
    );
    expect(classifyUpstreamError(new Error('Request ... failed with status code 403'))).toBe(
      'blocked',
    );
    expect(classifyUpstreamError(new Error('Request ... failed with status code 400'))).toBe(
      'blocked',
    );
  });

  it('classifies network and transient failures as retryable upstream', () => {
    expect(classifyUpstreamError(new TypeError('fetch failed'))).toBe('upstream');
    expect(classifyUpstreamError(new Error('Request ... failed with status code 429'))).toBe(
      'upstream',
    );
    expect(classifyUpstreamError('not an error object')).toBe('upstream');
  });
});

describe('toNotFoundOrThrow', () => {
  it('returns null for not-found failures', () => {
    expect(toNotFoundOrThrow(new Error('Video unavailable'))).toBeNull();
  });

  it('throws an UpstreamError for other failures', () => {
    expect(() => toNotFoundOrThrow(new Error('fetch failed'))).toThrow(UpstreamError);
    expect(() => toNotFoundOrThrow(new Error('not a bot'))).toThrow(UpstreamError);
  });

  it('marks blocked failures as non-retryable', () => {
    try {
      toNotFoundOrThrow(new Error('Sign in to confirm you are not a bot'));
    } catch (error) {
      expect(error).toBeInstanceOf(UpstreamError);
      expect((error as UpstreamError).retryable).toBe(false);
    }
  });

  it('marks transient failures as retryable', () => {
    try {
      toNotFoundOrThrow(new Error('fetch failed'));
    } catch (error) {
      expect(error).toBeInstanceOf(UpstreamError);
      expect((error as UpstreamError).retryable).toBe(true);
    }
  });
});
