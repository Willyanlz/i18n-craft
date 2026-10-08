import { providers, type Provider } from './core';

export const AI_SETTINGS_KEY = 'i18ncraft.ai-settings';
export type AiSettings = { provider: Provider; model: string; apikey: string };
export function readAiSettings(): AiSettings {
  const defaults: AiSettings = { provider: 'gemini', model: providers.gemini.model, apikey: '' };
  try {
    const saved = JSON.parse(localStorage.getItem(AI_SETTINGS_KEY) || 'null');
    if (
      saved &&
      Object.hasOwn(providers, saved.provider) &&
      typeof saved.model === 'string' &&
      typeof saved.apikey === 'string'
    )
      return { provider: saved.provider, model: saved.model, apikey: saved.apikey };
  } catch {
    /* Use defaults when storage is unavailable or malformed. */
  }
  return defaults;
}
