import type { MessageKey } from './i18n';
export type Translate = (key: MessageKey) => string;
export type Suggestion = { text: string; source: string; key: string; base: string };
export type Suggestions = Record<string, Record<string, Suggestion>>;
export type ModalName = 'import' | 'export' | 'clear' | null;
