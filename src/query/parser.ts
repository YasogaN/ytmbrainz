export interface QueryClause {
  field: string | null;
  value: string;
  negated: boolean;
  operator: 'and' | 'or';
}

type Token =
  | { kind: 'word'; value: string; negated: boolean }
  | { kind: 'phrase'; value: string; negated: boolean }
  | { kind: 'range'; value: string; negated: boolean }
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'and' }
  | { kind: 'or' }
  | { kind: 'not' };

const FIELD_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*:(.*)$/;

function makeWordToken(word: string, negated: boolean): Token {
  if (/^AND$/.test(word)) {
    return { kind: 'and' };
  }
  if (/^OR$/.test(word)) {
    return { kind: 'or' };
  }
  if (/^NOT$/.test(word)) {
    return { kind: 'not' };
  }
  return { kind: 'word', value: word, negated };
}

function scanTerm(
  query: string,
  i: number,
  negated: boolean,
): { token: Token; next: number } | null {
  if (i >= query.length) {
    return null;
  }
  const ch = query[i] as string;
  if (ch === '"') {
    const end = query.indexOf('"', i + 1);
    const value = end === -1 ? query.slice(i + 1) : query.slice(i + 1, end);
    return { token: { kind: 'phrase', value, negated }, next: end === -1 ? query.length : end + 1 };
  }
  if (ch === '[') {
    const end = query.indexOf(']', i + 1);
    const value = end === -1 ? query.slice(i + 1) : query.slice(i + 1, end);
    return { token: { kind: 'range', value, negated }, next: end === -1 ? query.length : end + 1 };
  }
  let j = i;
  while (j < query.length && !/[\s\t\n()"[\]]/.test(query[j] as string)) {
    j += 1;
  }
  const word = query.slice(i, j);
  if (word === '') {
    return null;
  }
  return { token: makeWordToken(word, negated), next: j };
}

function tokenize(query: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < query.length) {
    const ch = query[i] as string;
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      i += 1;
      continue;
    }
    if (ch === '(') {
      tokens.push({ kind: 'lparen' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'rparen' });
      i += 1;
      continue;
    }
    const negated = ch === '-';
    const start = negated ? i + 1 : i;
    const scanned = scanTerm(query, start, negated);
    if (scanned === null) {
      i += 1;
      continue;
    }
    tokens.push(scanned.token);
    i = scanned.next;
  }
  return tokens;
}

interface ParsedValue {
  field: string | null;
  value: string;
  consumed: number;
}

type ValueToken =
  | { kind: 'phrase'; value: string; negated: boolean }
  | { kind: 'range'; value: string; negated: boolean }
  | { kind: 'word'; value: string; negated: boolean };

function valueFromToken(token: ValueToken, next: Token | undefined): ParsedValue {
  if (token.kind !== 'word') {
    return { field: null, value: token.value, consumed: 1 };
  }
  const fieldMatch = FIELD_PATTERN.exec(token.value);
  if (fieldMatch === null) {
    return { field: null, value: token.value, consumed: 1 };
  }
  const field = token.value.slice(0, token.value.indexOf(':'));
  let value = fieldMatch[1] ?? '';
  let consumed = 1;
  if (
    value === '' &&
    next !== undefined &&
    (next.kind === 'phrase' || next.kind === 'range' || next.kind === 'word')
  ) {
    value = next.value;
    consumed = 2;
  }
  return { field, value, consumed };
}

export function parseQuery(query: string): QueryClause[] {
  const clauses: QueryClause[] = [];
  let operator: 'and' | 'or' = 'and';
  let pendingNegation = false;
  const tokens = tokenize(query);
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i] as Token;
    if (token.kind === 'and') {
      operator = 'and';
      continue;
    }
    if (token.kind === 'or') {
      operator = 'or';
      continue;
    }
    if (token.kind === 'not') {
      pendingNegation = true;
      continue;
    }
    if (token.kind === 'lparen' || token.kind === 'rparen') {
      continue;
    }
    const parsed = valueFromToken(token, tokens[i + 1]);
    clauses.push({
      field: parsed.field,
      value: parsed.value,
      negated: pendingNegation || token.negated,
      operator,
    });
    pendingNegation = false;
    operator = 'and';
    i += parsed.consumed - 1;
  }
  return clauses;
}
