export const languages = [
  { code: 'pt', name: 'Português', short: 'PT', flag: '🇧🇷' },
  { code: 'en', name: 'English', short: 'EN', flag: '🇺🇸' },
  { code: 'es', name: 'Español', short: 'ES', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', short: 'FR', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', short: 'DE', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', short: 'IT', flag: '🇮🇹' },
  { code: 'ja', name: '日本語', short: 'JA', flag: '🇯🇵' },
];
export type Entry = { id: string; key: string; values: Record<string, string> };
export const newEntry = (): Entry => ({ id: crypto.randomUUID(), key: '', values: {} });
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
export function validateKeys(entries: Entry[]): Map<string, string> {
  const errors = new Map<string, string>();
  const keyed = entries.filter(e => e.key.trim());
  const byKey = new Map<string, Entry[]>();
  for (const entry of keyed) byKey.set(entry.key, [...(byKey.get(entry.key) || []), entry]);
  for (const entry of entries) {
    if (!entry.key.trim() && Object.values(entry.values).some(Boolean)) errors.set(entry.id, 'empty');
  }
  for (const entry of keyed) {
    const parts = entry.key.split('.');
    if (parts.some(p => !p.trim() || p !== p.trim() || forbidden.has(p)) || entry.key.length > 300) errors.set(entry.id, 'invalid');
    if (byKey.get(entry.key)!.length > 1) errors.set(entry.id, 'conflict');
    for (let index = 1; index < parts.length; index++) {
      const ancestors = byKey.get(parts.slice(0, index).join('.'));
      if (ancestors) {
        errors.set(entry.id, 'conflict');
        for (const ancestor of ancestors) errors.set(ancestor.id, 'conflict');
      }
    }
  }
  return errors;
}
export function flattenJson(value: unknown): Record<string, string> {
  const output: Record<string, string> = Object.create(null);
  let count = 0;
  const visit = (obj: unknown, prefix: string, depth: number) => {
    if (depth > 20) throw new Error('depth');
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('shape');
    if (prefix && !Object.keys(obj).length) throw new Error('shape');
    for (const [key, child] of Object.entries(obj)) {
      if (!key.trim() || key !== key.trim() || key.includes('.') || forbidden.has(key)) throw new Error('invalid');
      const path = prefix ? `${prefix}.${key}` : key;
      if (path.length > 300) throw new Error('invalid');
      if (typeof child === 'string') { output[path] = child; count++; }
      else visit(child, path, depth + 1);
      if (count > 5000) throw new Error('limit');
    }
  };
  visit(value, '', 0);
  return output;
}
export function buildJson(entries: Entry[], lang: string) {
  if (validateKeys(entries).size) throw new Error('invalid');
  const result: Record<string, unknown> = Object.create(null);
  for (const entry of entries.filter(e => e.key.trim())) {
    const parts = entry.key.split('.');
    let cursor = result;
    for (const part of parts.slice(0, -1)) {
      cursor[part] ??= Object.create(null);
      cursor = cursor[part] as Record<string, unknown>;
    }
    cursor[parts.at(-1)!] = entry.values[lang] || '';
  }
  return JSON.stringify(result, null, 2);
}
export function protectedTokens(value: string): string[] {
  return (value.match(/\{\{[^{}]+\}\}|\{[^{}]+\}|<\/?[A-Za-z][^>]*>|%(?:\d+\$)?[sdif]|\$\{[^{}]+\}/g) || []).sort();
}
export function tokensMatch(source: string, translated: string) {
  return JSON.stringify(protectedTokens(source)) === JSON.stringify(protectedTokens(translated));
}
export function mergeJson(entries: Entry[], value: unknown, lang: string, overwrite: boolean): Entry[] {
  const flat = flattenJson(value);
  const merged = entries.filter(e => e.key || Object.values(e.values).some(Boolean)).map(e => ({ ...e, values: { ...e.values } }));
  for (const [key, text] of Object.entries(flat)) {
    const existing = merged.find(e => e.key === key);
    if (existing) {
      if (overwrite || existing.values[lang] === undefined) {
        existing.values[lang] = text;
      }
    } else merged.push({ ...newEntry(), key, values: { [lang]: text } });
  }
  if (merged.length > 5000) throw new Error('limit');
  if (validateKeys(merged).size) throw new Error('conflict');
  return merged;
}
export const providers = {
  gemini: { name: 'Google Gemini', model: 'gemini-3.5-flash-lite' },
  claude: { name: 'Anthropic Claude', model: 'claude-sonnet-4-6' },
  openai: { name: 'OpenAI', model: 'gpt-4.1-mini' },
  openrouter: { name: 'OpenRouter', model: 'openai/gpt-4.1-mini' },
};
export type Provider = keyof typeof providers;
