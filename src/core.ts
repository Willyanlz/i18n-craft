export const languages = [
  { code: 'pt', name: 'Português', short: 'PT' },
  { code: 'en', name: 'English', short: 'EN' },
  { code: 'es', name: 'Español', short: 'ES' },
  { code: 'fr', name: 'Français', short: 'FR' },
  { code: 'de', name: 'Deutsch', short: 'DE' },
  { code: 'it', name: 'Italiano', short: 'IT' },
  { code: 'ja', name: '日本語', short: 'JA' },
  { code: 'nl', name: 'Nederlands', short: 'NL' },
  { code: 'pl', name: 'Polski', short: 'PL' },
  { code: 'ru', name: 'Русский', short: 'RU' },
  { code: 'zh', name: '中文', short: 'ZH' },
  { code: 'ko', name: '한국어', short: 'KO' },
  { code: 'ar', name: 'العربية', short: 'AR' },
  { code: 'hi', name: 'हिन्दी', short: 'HI' },
  { code: 'sv', name: 'Svenska', short: 'SV' },
];
import type { ValueType } from './json-format';
export {
  MAX_FIELDS,
  buildJson,
  flattenJson,
  mergeJson,
  validateKeys,
  valueType,
} from './json-format';
export type Entry = {
  id: string;
  key: string;
  values: Record<string, string>;
  types?: Record<string, ValueType>;
  nested?: boolean;
};
export const newEntry = (): Entry => ({ id: crypto.randomUUID(), key: '', values: {} });
export function parseJsonInput(raw: string): unknown {
  const text = raw.replace(/^\uFEFF/, '').trim();
  if (!text) throw new Error('invalid');
  try {
    return JSON.parse(text);
  } catch {
    /* try tolerant variants below */
  }
  const removeTrailingCommas = (input: string) => {
    let result = '',
      inString = false,
      escaped = false;
    for (let index = 0; index < input.length; index++) {
      const char = input[index];
      if (inString) {
        result += char;
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      if (char === ',') {
        let next = index + 1;
        while (/\s/.test(input[next] || '') && next < input.length) next++;
        if (input[next] === '}' || input[next] === ']') continue;
      }
      result += char;
    }
    return result;
  };
  const noTrailingCommas = removeTrailingCommas(text);
  if (noTrailingCommas !== text) {
    try {
      return JSON.parse(noTrailingCommas);
    } catch {
      /* continue */
    }
  }
  if (!text.startsWith('{') || !text.endsWith('}')) {
    try {
      return JSON.parse(`{${text}}`);
    } catch {
      /* continue */
    }
    if (noTrailingCommas !== text) {
      try {
        return JSON.parse(removeTrailingCommas(`{${text}}`));
      } catch {
        /* continue */
      }
    }
  }
  throw new Error('invalid');
}
export function protectedTokens(value: string): string[] {
  return (
    value.match(/\{\{[^{}]+\}\}|\{[^{}]+\}|<\/?[A-Za-z][^>]*>|%(?:\d+\$)?[sdif]|\$\{[^{}]+\}/g) ||
    []
  ).sort();
}
export function tokensMatch(source: string, translated: string) {
  return JSON.stringify(protectedTokens(source)) === JSON.stringify(protectedTokens(translated));
}
export const providers = {
  gemini: { name: 'Google Gemini', model: 'gemini-3.5-flash-lite' },
  claude: { name: 'Anthropic Claude', model: 'claude-sonnet-4-6' },
  openai: { name: 'OpenAI', model: 'gpt-4.1-mini' },
  openrouter: { name: 'OpenRouter', model: 'openai/gpt-4.1-mini' },
};
export type Provider = keyof typeof providers;

export const langName = (code: string) =>
  languages.find((lang) => lang.code === code)?.name || code;
