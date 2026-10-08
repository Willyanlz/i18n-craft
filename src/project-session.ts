import { languages, type Entry } from './core';

export const PROJECT_SESSION_KEY = 'i18ncraft.project';
type ProjectSession = { entries: Entry[]; selected: string[] };
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
          !entry.values ||
          typeof entry.values !== 'object' ||
          Array.isArray(entry.values) ||
          Object.values(entry.values).some((value) => typeof value !== 'string'),
      )
    )
      return empty;
    if (new Set(saved.entries.map((entry: Entry) => entry.id)).size !== saved.entries.length)
      return empty;
    return {
      entries: saved.entries.map(({ id, key, values }: Entry) => ({ id, key, values })),
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
        entries: project.entries.map(({ id, key, values }) => ({ id, key, values })),
        selected: project.selected,
      }),
    );
}
