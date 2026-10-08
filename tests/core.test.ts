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
    expect(flattenJson({ 'a.b': 'text' })).toEqual({ '["a.b"]': 'text' });
  });
  it.each([null, true, 12, 'text', { value: Infinity }])(
    'rejects unsupported input %j',
    (input) => {
      expect(() => flattenJson(input)).toThrow();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    },
  );
  it('preserves literal paths, whitespace, arrays, empty containers and scalar types', () => {
    const source = {
      'a.b': 'literal',
      a: { b: 'nested' },
      ' selected': 'Selected',
      'from ': 'From',
      '': 'empty key',
      'text...': 'Dots',
      '[0]': 'Literal brackets',
      primeng: { firstDayOfWeek: 0, dayNames: ['Sunday', 'Monday'] },
      mixed: [true, null, 2.5, { 'a.b': 'value' }, [], {}],
      empty: {},
      list: [],
      enabled: false,
    };
    const entries = mergeJson([], source, 'pt', false);
    expect(validateKeys(entries).size).toBe(0);
    expect(JSON.parse(buildJson(entries, 'pt'))).toEqual(source);
    entries.find((entry) => entry.key === 'primeng.dayNames[1]')!.values.pt = 'Changed';
    expect(JSON.parse(buildJson(entries, 'pt')).primeng.dayNames).toEqual(['Sunday', 'Changed']);
  });
  it('preserves prototype-like keys as data without polluting objects', () => {
    const source = JSON.parse(
      '{"__proto__":{"polluted":"yes"},"constructor":{"prototype":"text"}}',
    );
    expect(JSON.parse(buildJson(mergeJson([], source, 'pt', false), 'pt'))).toEqual(source);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('merges types per language and validates edited non-text values', () => {
    const original = mergeJson([], { count: 0 }, 'pt', false);
    const merged = mergeJson(original, { count: 'zero' }, 'en', false);
    expect(JSON.parse(buildJson(merged, 'pt'))).toEqual({ count: 0 });
    expect(JSON.parse(buildJson(merged, 'en'))).toEqual({ count: 'zero' });
    expect(JSON.parse(buildJson(mergeJson(merged, { count: 'text' }, 'pt', true), 'pt'))).toEqual({
      count: 'text',
    });
    merged[0].values.pt = 'not a number';
    expect(validateKeys(merged).get(merged[0].id)).toBe('invalidValue');
    expect(() => buildJson(merged, 'pt')).toThrow();
    expect(original[0].values.pt).toBe('0');
  });
  it('rejects array/object conflicts and supports nonempty root arrays', () => {
    const source = ['one', { nested: 'two' }, false];
    expect(JSON.parse(buildJson(mergeJson([], source, 'pt', false), 'pt'))).toEqual(source);
    const entries = mergeJson([], { items: ['one'] }, 'pt', false);
    expect(() => mergeJson(entries, { items: { '0': 'two' } }, 'en', false)).toThrow('conflict');
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
