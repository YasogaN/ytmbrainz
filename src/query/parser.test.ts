import { describe, expect, it } from 'bun:test';
import { parseQuery } from '@/query/parser';

describe('parseQuery', () => {
  it('parses a bare term into the default field', () => {
    expect(parseQuery('roygbiv')).toEqual([
      { field: null, value: 'roygbiv', negated: false, operator: 'and' },
    ]);
  });

  it('parses a fielded word', () => {
    expect(parseQuery('artist:fred')).toEqual([
      { field: 'artist', value: 'fred', negated: false, operator: 'and' },
    ]);
  });

  it('parses a fielded phrase', () => {
    expect(parseQuery('recording:"Roygbiv"')).toEqual([
      { field: 'recording', value: 'Roygbiv', negated: false, operator: 'and' },
    ]);
  });

  it('parses fielded phrases combined with AND', () => {
    expect(parseQuery('recording:"we will rock you" AND artist:"Queen"')).toEqual([
      { field: 'recording', value: 'we will rock you', negated: false, operator: 'and' },
      { field: 'artist', value: 'Queen', negated: false, operator: 'and' },
    ]);
  });

  it('parses OR clauses', () => {
    expect(parseQuery('artist:fred OR artist:bob')).toEqual([
      { field: 'artist', value: 'fred', negated: false, operator: 'and' },
      { field: 'artist', value: 'bob', negated: false, operator: 'or' },
    ]);
  });

  it('parses negated fielded terms', () => {
    expect(parseQuery('-arid:123')).toEqual([
      { field: 'arid', value: '123', negated: true, operator: 'and' },
    ]);
  });

  it('parses NOT keyword before a fielded phrase', () => {
    expect(parseQuery('recording:"x" NOT artist:"y"')).toEqual([
      { field: 'recording', value: 'x', negated: false, operator: 'and' },
      { field: 'artist', value: 'y', negated: true, operator: 'and' },
    ]);
  });

  it('parses a range term', () => {
    expect(parseQuery('dur:[120000 TO 180000]')).toEqual([
      { field: 'dur', value: '120000 TO 180000', negated: false, operator: 'and' },
    ]);
  });

  it('parses an open-ended range', () => {
    expect(parseQuery('dur:[* TO 180000]')).toEqual([
      { field: 'dur', value: '* TO 180000', negated: false, operator: 'and' },
    ]);
  });

  it('ignores parentheses', () => {
    expect(parseQuery('(recording:"a" OR recording:"b")')).toEqual([
      { field: 'recording', value: 'a', negated: false, operator: 'and' },
      { field: 'recording', value: 'b', negated: false, operator: 'or' },
    ]);
  });

  it('parses a bare phrase into the default field', () => {
    expect(parseQuery('"we will rock you"')).toEqual([
      { field: null, value: 'we will rock you', negated: false, operator: 'and' },
    ]);
  });

  it('parses an exact range value', () => {
    expect(parseQuery('dur:180000')).toEqual([
      { field: 'dur', value: '180000', negated: false, operator: 'and' },
    ]);
  });

  it('handles an empty query', () => {
    expect(parseQuery('')).toEqual([]);
  });

  it('skips a dangling dash', () => {
    expect(parseQuery('-')).toEqual([]);
    expect(parseQuery('artist:"x" - ')).toEqual([
      { field: 'artist', value: 'x', negated: false, operator: 'and' },
    ]);
  });
});
