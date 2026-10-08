import type { Dispatch, SetStateAction } from 'react';
import { ChevronRight, Moon, Sun } from 'lucide-react';
import { languages } from '../core';
import { type Locale } from '../i18n';
import type { Translate } from '../types';

import { LangPicker } from './LangPicker';
type Props = {
  t: Translate;
  page: 'editor' | 'settings';
  theme: 'light' | 'dark';
  setTheme: Dispatch<SetStateAction<'light' | 'dark'>>;
  locale: 'pt' | 'en' | 'es';
  setLocale: Dispatch<SetStateAction<'pt' | 'en' | 'es'>>;
};
export function Topbar({ t, page, theme, setTheme, locale, setLocale }: Props) {
  return (
    <header className="topbar">
      <div className="breadcrumbs">
        {t('workspace')}
        <ChevronRight size={14} />
        <strong>{t(page === 'editor' ? 'editor' : 'settings')}</strong>
      </div>
      <div className="topbar-actions">
        <span className="session-label">
          <span className="status-dot" />
          {t('memory')}
        </span>
        <button
          className="icon-button"
          aria-label={t(theme === 'light' ? 'dark' : 'light')}
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <LangPicker
          label={t('interface')}
          value={locale}
          options={languages.slice(0, 3).map((lang) => lang.code)}
          onPick={(code) => setLocale(code as Locale)}
          locale={locale}
        />
      </div>
    </header>
  );
}
