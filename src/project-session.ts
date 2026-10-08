import { languages, type Entry } from './core';

export const PROJECT_SESSION_KEY = 'i18ncraft.project';
export const SELECTED_LANGS_KEY = 'i18ncraft.selected';
type ProjectSession = { entries: Entry[]; selected: string[] };
const isValidCode = (code: unknown): code is string =>
  typeof code === 'string' && languages.some((lang) => lang.code === code);
export function readSelectedLangs(fallback: string[] = ['pt', 'en', 'es']): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(SELECTED_LANGS_KEY) || 'null');
    if (!Array.isArray(saved) || !saved.length) return fallback;
    const cleaned = [...new Set(saved.filter(isValidCode))];
    return cleaned.length ? cleaned : fallback;
  } catch {
    return fallback;
  }
}
export function saveSelectedLangs(selected: string[]) {
  try {
    localStorage.setItem(
      SELECTED_LANGS_KEY,
      JSON.stringify([...new Set(selected.filter(isValidCode))]),
    );
  } catch {
    /* Selection still applies without storage. */
  }
}
export function readProjectSession(): ProjectSession {
  const empty: ProjectSession = { entries: [], selected: ['pt', 'en', 'es'] };
  try {
    const saved = JSON.parse(sessionStorage.getItem(PROJECT_SESSION_KEY) || 'null');
    if (
      !saved ||
      saved.version !== 1 ||
      !Array.isArray(saved.entries) ||
      !Array.isArray(saved.selected) ||
      !saved.selected.length
    )
      return empty;
    if (saved.selected.some((code: unknown) => !languages.some((lang) => lang.code === code)))
      return empty;
    if (
      saved.entries.some(
        (entry: Entry) =>
          !entry ||
          typeof entry.id !== 'string' ||
          typeof entry.key !== 'string' ||
          (entry.nested !== undefined && typeof entry.nested !== 'boolean') ||
          !entry.values ||
          typeof entry.values !== 'object' ||
          Array.isArray(entry.values) ||
          Object.values(entry.values).some((value) => typeof value !== 'string') ||
          (entry.types !== undefined &&
            (!entry.types ||
              typeof entry.types !== 'object' ||
              Array.isArray(entry.types) ||
              Object.values(entry.types).some(
                (type) => !['string', 'number', 'boolean', 'null', 'json'].includes(type),
              ))),
      )
    )
      return empty;
    if (new Set(saved.entries.map((entry: Entry) => entry.id)).size !== saved.entries.length)
      return empty;
    return {
      entries: saved.entries.map(({ id, key, values, types, nested }: Entry) => ({
        id,
        key,
        values,
        ...(types ? { types } : {}),
        ...(nested !== undefined ? { nested } : {}),
      })),
      selected: [...new Set<string>(saved.selected)],
    };
  } catch {
    return empty;
  }
}

export function saveProjectSession(project: ProjectSession) {
  if (!project.entries.length) sessionStorage.removeItem(PROJECT_SESSION_KEY);
  else
    sessionStorage.setItem(
      PROJECT_SESSION_KEY,
      JSON.stringify({
        version: 1,
        entries: project.entries.map(({ id, key, values, types, nested }) => ({
          id,
          key,
          values,
          ...(types ? { types } : {}),
          ...(nested !== undefined ? { nested } : {}),
        })),
        selected: project.selected,
      }),
    );
}
