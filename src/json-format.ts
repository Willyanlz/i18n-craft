import type { Entry } from './core';

export type ValueType = 'string' | 'number' | 'boolean' | 'null' | 'json';
type Path = (string | number)[];

// Bracket notation distinguishes literal dots from nested paths and array indexes.
function formatPath(path: Path): string {
  return path
    .map((part, index) =>
      typeof part === 'number'
        ? `[${part}]`
        : part && part === part.trim() && !/[.\[\]"\\]/.test(part)
          ? `${index ? '.' : ''}${part}`
          : `[${JSON.stringify(part)}]`,
    )
    .join('');
}

export function parsePath(key: string): Path {
  const path: Path = [];
  let position = 0;
  while (position < key.length) {
    if (key[position] === '[') {
      const match = /^(?:\[("(?:[^"\\]|\\.)*")\]|\[(0|[1-9]\d*)\])/.exec(key.slice(position));
      if (!match) throw new Error('invalid');
      const part = match[1] !== undefined ? JSON.parse(match[1]) : Number(match[2]);
      if (typeof part === 'number' && part > 4999) throw new Error('limit');
      path.push(part);
      position += match[0].length;
    } else {
      const match = /^[^.\[\]]+/.exec(key.slice(position));
      if (!match || match[0] !== match[0].trim()) throw new Error('invalid');
      path.push(match[0]);
      position += match[0].length;
    }
    if (position === key.length) break;
    if (key[position] === '.') {
      position++;
      if (position === key.length || key[position] === '[') throw new Error('invalid');
    } else if (key[position] !== '[') throw new Error('invalid');
  }
  if (!path.length) throw new Error('invalid');
  return path;
}

export function valueType(entry: Entry, lang: string): ValueType {
  return entry.types?.[lang] ?? 'string';
}

export function isNestedKey(entry: Entry): boolean {
  if (entry.nested !== undefined) return entry.nested;
  try {
    const path = parsePath(entry.key);
    return path.length > 1 || typeof path[0] === 'number';
  } catch {
    return !!entry.key;
  }
}

export function keyLabel(entry: Entry): string {
  if (isNestedKey(entry)) return entry.key;
  try {
    return String(parsePath(entry.key)[0]);
  } catch {
    return entry.key;
  }
}

export function editKey(text: string, nested: boolean): Pick<Entry, 'key' | 'nested'> {
  return { key: nested || !text ? text : formatPath([text]), nested };
}

function readValue(entry: Entry, lang: string): unknown {
  const text = entry.values[lang] ?? '';
  const type = valueType(entry, lang);
  if (type === 'string') return text;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('invalidValue');
  }
  if (
    type === 'null'
      ? value !== null
      : type === 'json'
        ? value === null || typeof value !== 'object'
        : typeof value !== type || (type === 'number' && !Number.isFinite(value))
  ) {
    throw new Error('invalidValue');
  }
  return value;
}

export function validateKeys(entries: Entry[]): Map<string, string> {
  const errors = new Map<string, string>();
  type Node = { children: Map<string | number, Node>; entry?: Entry; kind?: string; owner?: Entry };
  const root: Node = { children: new Map() };
  const conflict = (a: Entry, b: Entry) => {
    errors.set(a.id, 'conflict');
    errors.set(b.id, 'conflict');
  };
  for (const entry of entries) {
    if (!entry.key.trim()) {
      if (Object.values(entry.values).some(Boolean)) errors.set(entry.id, 'empty');
      continue;
    }
    try {
      const path = parsePath(entry.key);
      let node = root;
      for (const part of path) {
        if (node.entry) conflict(entry, node.entry);
        const kind = typeof part;
        if (node.kind && node.kind !== kind) conflict(entry, node.owner!);
        node.kind = kind;
        node.owner ??= entry;
        if (!node.children.has(part)) node.children.set(part, { children: new Map() });
        node = node.children.get(part)!;
      }
      if (node.entry) conflict(entry, node.entry);
      if (node.owner) conflict(entry, node.owner);
      node.entry = entry;
      for (const lang of Object.keys(entry.values)) readValue(entry, lang);
    } catch (error) {
      errors.set(
        entry.id,
        error instanceof Error && error.message === 'invalidValue' ? 'invalidValue' : 'invalid',
      );
    }
  }
  return errors;
}

function flatten(value: unknown): { key: string; text: string; type: ValueType }[] {
  if (!value || typeof value !== 'object') throw new Error('shape');
  const output: { key: string; text: string; type: ValueType }[] = [];
  function visit(child: unknown, path: Path) {
    if (path.length > 50) throw new Error('depth');
    if (child !== null && typeof child === 'object' && Object.keys(child).length) {
      for (const [key, item] of Object.entries(child)) {
        visit(item, [...path, Array.isArray(child) ? Number(key) : key]);
      }
      return;
    }
    if (!path.length) return;
    const type: ValueType =
      child === null ? 'null' : typeof child === 'object' ? 'json' : (typeof child as ValueType);
    if (!['string', 'number', 'boolean', 'null', 'json'].includes(type)) throw new Error('shape');
    if (type === 'number' && !Number.isFinite(child)) throw new Error('shape');
    output.push({
      key: formatPath(path),
      text: type === 'string' ? (child as string) : JSON.stringify(child),
      type,
    });
    if (output.length > 5000) throw new Error('limit');
  }
  visit(value, []);
  if (!output.length && Array.isArray(value)) throw new Error('shape');
  return output;
}

export function flattenJson(value: unknown): Record<string, string> {
  return Object.fromEntries(flatten(value).map(({ key, text }) => [key, text]));
}

export function mergeJson(
  entries: Entry[],
  value: unknown,
  lang: string,
  overwrite: boolean,
): Entry[] {
  const merged = entries
    .filter((e) => e.key || Object.values(e.values).some(Boolean))
    .map((e) => ({ ...e, values: { ...e.values }, ...(e.types ? { types: { ...e.types } } : {}) }));
  const byPath = new Map(merged.map((e) => [JSON.stringify(parsePath(e.key)), e]));
  for (const { key, text, type } of flatten(value)) {
    const identity = JSON.stringify(parsePath(key));
    let entry = byPath.get(identity);
    if (!entry) {
      entry = { id: crypto.randomUUID(), key, values: {} };
      merged.push(entry);
      byPath.set(identity, entry);
    }
    if (overwrite || entry.values[lang] === undefined) {
      entry.values[lang] = text;
      if (type !== 'string' || entry.types) entry.types = { ...entry.types, [lang]: type };
    }
  }
  if (merged.length > 5000) throw new Error('limit');
  if (validateKeys(merged).size) throw new Error('conflict');
  return merged;
}

export function buildJson(entries: Entry[], lang: string): string {
  if (validateKeys(entries).size) throw new Error('invalid');
  const keyed = entries.filter((e) => e.key.trim());
  const root =
    keyed.length && typeof parsePath(keyed[0].key)[0] === 'number' ? [] : Object.create(null);
  for (const entry of keyed) {
    const path = parsePath(entry.key);
    let cursor = root;
    path.forEach((part, index) => {
      if (index === path.length - 1) {
        Object.defineProperty(cursor, part, {
          value: readValue(entry, lang),
          enumerable: true,
          configurable: true,
          writable: true,
        });
      } else {
        if (!Object.hasOwn(cursor, part))
          Object.defineProperty(cursor, part, {
            value: typeof path[index + 1] === 'number' ? [] : Object.create(null),
            enumerable: true,
            configurable: true,
            writable: true,
          });
        cursor = cursor[part];
      }
    });
  }
  return JSON.stringify(root, null, 2);
}
