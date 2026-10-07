import { afterEach, expect, it, vi } from 'vitest';
import { PROJECT_SESSION_KEY, readProjectSession, saveProjectSession } from '../src/project-session';

afterEach(() => vi.unstubAllGlobals());
it('restores existing work and rewrites only supported fields', () => {
  const stored = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  });
  const entry = { id: 'saved-id', key: 'auto.test', values: { pt: 'Testando' } };
  stored.set(PROJECT_SESSION_KEY, JSON.stringify({ version: 1, entries: [{ ...entry, obsoleteField: [] }], selected: ['pt', 'en', 'es'], obsoleteProjectField: '' }));
  const project = readProjectSession();
  expect(project).toEqual({ entries: [entry], selected: ['pt', 'en', 'es'] });
  saveProjectSession(project);
  expect(JSON.parse(stored.get(PROJECT_SESSION_KEY)!)).toEqual({ version: 1, entries: [entry], selected: ['pt', 'en', 'es'] });
});
