import type { Work } from './project-worker';

export function runProjectTask<T>(task: Work, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./project-worker.ts', import.meta.url), { type: 'module' });
    const finish = () => {
      worker.terminate();
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => {
      finish();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    worker.onmessage = ({ data }) => {
      finish();
      if (data.error) reject(new Error(data.error));
      else resolve(data.result);
    };
    worker.onerror = () => {
      finish();
      reject(new Error('worker'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    else {
      try {
        worker.postMessage(task);
      } catch (error) {
        finish();
        reject(error);
      }
    }
  });
}
