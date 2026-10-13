import { buildJson, mergeJson, parseJsonInput, type Entry } from './core';
import { strToU8, zipSync } from 'fflate';

export type Work =
  | { kind: 'import'; entries: Entry[]; text: string; lang: string; overwrite: boolean }
  | { kind: 'zip'; entries: Entry[]; selected: string[] }
  | { kind: 'serialize'; project: unknown };

self.onmessage = (event: MessageEvent<Work>) => {
  try {
    const task = event.data;
    const result =
      task.kind === 'import'
        ? mergeJson(task.entries, parseJsonInput(task.text), task.lang, task.overwrite)
        : task.kind === 'zip'
          ? zipSync(
              Object.fromEntries(
                task.selected.map((lang) => [
                  `${lang}.json`,
                  strToU8(buildJson(task.entries, lang)),
                ]),
              ),
            )
          : JSON.stringify(task.project);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'invalid' });
  }
};
