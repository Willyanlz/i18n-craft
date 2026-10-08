import type { Dispatch, SetStateAction } from 'react';
import { Globe2, Moon, Sparkles, Sun } from 'lucide-react';
import type { AiSettings } from '../ai-settings';
import { languages, providers, type Provider } from '../core';
import { type Locale } from '../i18n';
import type { Translate } from '../types';

type Props = {
  t: Translate;
  locale: 'pt' | 'en' | 'es';
  setLocale: Dispatch<SetStateAction<'pt' | 'en' | 'es'>>;
  theme: 'light' | 'dark';
  setTheme: Dispatch<SetStateAction<'light' | 'dark'>>;
  ai: boolean;
  setAi: Dispatch<SetStateAction<boolean>>;
  provider: 'gemini' | 'claude' | 'openai' | 'openrouter';
  setAiSettings: Dispatch<SetStateAction<AiSettings>>;
  model: string;
  apikey: string;
};
export function SettingsPanel({
  t,
  locale,
  setLocale,
  theme,
  setTheme,
  ai,
  setAi,
  provider,
  setAiSettings,
  model,
  apikey,
}: Props) {
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> WORKSPACE
          </div>
          <h1>{t('settings')}</h1>
          <p>{t('settingsText')}</p>
        </div>
      </section>
      <div className="settings-grid">
        <section className="settings-card">
          <h2>
            <Globe2 size={19} />
            {t('interface')}
          </h2>
          <label>
            {t('interface')}
            <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
              {languages.slice(0, 3).map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('appearance')}
            <div className="theme-options">
              <button
                className={theme === 'light' ? 'button selected' : 'button'}
                onClick={() => setTheme('light')}
              >
                <Sun size={17} />
                {t('light')}
              </button>
              <button
                className={theme === 'dark' ? 'button selected' : 'button'}
                onClick={() => setTheme('dark')}
              >
                <Moon size={17} />
                {t('dark')}
              </button>
            </div>
          </label>
          <p className="help-text">{t('sessionHelp')}</p>
        </section>
        <section className="settings-card">
          <div className="section-heading">
            <h2>
              <Sparkles size={19} />
              {t('ai')}
            </h2>
            <input
              type="checkbox"
              aria-label={t('ai')}
              checked={ai}
              onChange={(event) => setAi(event.target.checked)}
            />
          </div>
          <p>{t('aiHelp')}</p>
          <label>
            {t('provider')}
            <select
              value={provider}
              onChange={(event) => {
                const next = event.target.value as Provider;
                setAiSettings({ provider: next, model: providers[next].model, apikey: '' });
              }}
            >
              {Object.entries(providers).map(([id, item]) => (
                <option key={id} value={id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('model')}
            <input
              value={model}
              maxLength={120}
              onChange={(event) =>
                setAiSettings((previous) => ({ ...previous, model: event.target.value }))
              }
            />
          </label>
          <label>
            {t('apiKey')}
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apikey}
              maxLength={4096}
              placeholder={t('apiPlaceholder')}
              onChange={(event) =>
                setAiSettings((previous) => ({ ...previous, apikey: event.target.value }))
              }
            />
          </label>
        </section>
      </div>
    </>
  );
}
