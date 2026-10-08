import { afterEach, expect, it, vi } from 'vitest';
import {
  PROJECT_SESSION_KEY,
  SELECTED_LANGS_KEY,
  readProjectSession,
  readSelectedLangs,
  saveProjectSession,
  saveSelectedLangs,
} from '../src/project-session';

function stubStorages(session: Map<string, string>, local: Map<string, string>) {
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => session.set(key, value),
    removeItem: (key: string) => session.delete(key),
  });
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => local.set(key, value),
    removeItem: (key: string) => local.delete(key),
  });
}

afterEach(() => vi.unstubAllGlobals());
it('restores existing work and rewrites only supported fields', () => {
  const stored = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  });
  const entry = { id: 'saved-id', key: 'auto.test', values: { pt: 'Testando' } };
  stored.set(
    PROJECT_SESSION_KEY,
    JSON.stringify({
      version: 1,
      entries: [{ ...entry, obsoleteField: [] }],
      selected: ['pt', 'en', 'es'],
      obsoleteProjectField: '',
    }),
  );
  const project = readProjectSession();
  expect(project).toEqual({ entries: [entry], selected: ['pt', 'en', 'es'] });
  saveProjectSession(project);
  expect(JSON.parse(stored.get(PROJECT_SESSION_KEY)!)).toEqual({
    version: 1,
    entries: [entry],
    selected: ['pt', 'en', 'es'],
  });
});

it('persists selected languages in localStorage even without entries', () => {
  stubStorages(new Map(), new Map());
  expect(readSelectedLangs(['pt', 'en', 'es'])).toEqual(['pt', 'en', 'es']);
  saveSelectedLangs(['pt', 'ja', 'fr', 'ja', 'xx']);
  expect(readSelectedLangs(['pt'])).toEqual(['pt', 'ja', 'fr']);
  expect(JSON.parse(localStorage.getItem(SELECTED_LANGS_KEY)!)).toEqual(['pt', 'ja', 'fr']);
  localStorage.setItem(SELECTED_LANGS_KEY, JSON.stringify(['xx']));
  expect(readSelectedLangs(['pt', 'en'])).toEqual(['pt', 'en']);
});
