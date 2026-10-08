import { describe, expect, it } from 'vitest';
import {
  buildJson,
  flattenJson,
  mergeJson,
  newEntry,
  parseJsonInput,
  tokensMatch,
  validateKeys,
} from '../src/core';

it('preserves punctuation inside strings when removing trailing commas', () => {
  const values = { hello: 'Hello,}', array: 'Text,]', quote: 'A "quote,}" and a backslash \\' };
  expect(parseJsonInput(JSON.stringify(values).replace(/}$/, ',}'))).toEqual(values);
  expect(parseJsonInput('"hello":"Hello,}"')).toEqual({ hello: 'Hello,}' });
});

describe('JSON editing and merging', () => {
  it('round trips nested text, unicode, empty values and placeholders', () => {
    const source = { automation: { example: 'Olá, {{name}}!', empty: '' }, title: 'Admissão' };
    const entries = mergeJson([], source, 'pt', false);
    expect(JSON.parse(buildJson(entries, 'pt'))).toEqual(source);
    expect(JSON.parse(buildJson(entries, 'en'))).toEqual({
      automation: { example: '', empty: '' },
      title: '',
    });
  });
  it('merges languages without losing existing translations', () => {
    const original = [{ ...newEntry(), key: 'title', values: { pt: 'Título', en: 'Title' } }];
    const kept = mergeJson(
      original,
      { title: 'Replacement', description: 'Description' },
      'en',
      false,
    );
    expect(kept[0]).toEqual(original[0]);
    const replaced = mergeJson(original, { title: 'Replacement' }, 'en', true);
    expect(replaced[0].values).toEqual({ pt: 'Título', en: 'Replacement' });
    expect(original[0].values.en).toBe('Title');
  });
  it('rejects conflicting paths atomically', () => {
    const entries = mergeJson([], { automation: 'Label' }, 'pt', false);
    expect(() => mergeJson(entries, { automation: { title: 'Title' } }, 'en', false)).toThrow(
      'conflict',
    );
    expect(JSON.parse(buildJson(entries, 'pt'))).toEqual({ automation: 'Label' });
    expect(
      validateKeys([
        { ...newEntry(), key: 'a' },
        { ...newEntry(), key: 'a' },
      ]).size,
    ).toBe(2);
  });
  it('accepts dotted keys as literal entry keys', () => {
    expect(flattenJson({ 'a.b': 'text' })).toEqual({ 'a.b': 'text' });
  });
  it.each([
    [],
    { n: 1 },
    { a: {} },
    { ' a': 'text' },
    JSON.parse('{"__proto__":{"polluted":"yes"}}'),
  ])('rejects unsupported or unsafe input %j', (input) => {
    expect(() => flattenJson(input)).toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('does not silently drop values entered without a key', () => {
    expect(() => buildJson([{ ...newEntry(), values: { pt: 'text' } }], 'pt')).toThrow();
  });
});

describe('protected translation tokens', () => {
  it('allows text changes while preserving variables, repeated tokens and markup', () => {
    expect(
      tokensMatch(
        '<b>Hello {{name}}</b>, {count} %s ${total}',
        '<b>Olá {{name}}</b>, {count} %s ${total}',
      ),
    ).toBe(true);
    expect(tokensMatch('{{name}} {{name}}', '{{name}}')).toBe(false);
    expect(tokensMatch('<b>{name}</b>', '<i>{name}</i>')).toBe(false);
    expect(tokensMatch('${name}', '{name}')).toBe(false);
  });
});
