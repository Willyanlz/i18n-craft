import type { Dispatch, SetStateAction } from 'react';
import { Braces, ChevronRight, Github, Globe2, Languages, Settings2 } from 'lucide-react';
import type { Translate } from '../types';

type Props = {
  setPage: Dispatch<SetStateAction<'editor' | 'settings'>>;
  t: Translate;
  page: 'editor' | 'settings';
};
export function Sidebar({ setPage, t, page }: Props) {
  return (
    <aside className="sidebar">
      <a
        className="brand"
        href="#"
        onClick={(event) => {
          event.preventDefault();
          setPage('editor');
        }}
      >
        <span className="brand-icon">
          <Braces size={24} />
        </span>
        <span>
          i18n<span className="brand-light">Craft</span>
          <small>TRANSLATION WORKSPACE</small>
        </span>
      </a>
      <div className="nav-label">{t('workspace')}</div>
      <nav>
        <button
          className={page === 'editor' ? 'nav-item active' : 'nav-item'}
          onClick={() => setPage('editor')}
        >
          <Languages size={19} />
          {t('editor')}
          <ChevronRight size={15} />
        </button>
        <button
          className={page === 'settings' ? 'nav-item active' : 'nav-item'}
          onClick={() => setPage('settings')}
        >
          <Settings2 size={19} />
          {t('settings')}
        </button>
      </nav>
      <div className="sidebar-note">
        <span className="note-icon">
          <Globe2 size={23} />
        </span>
        <strong>
          {t('oneKey')}
          <br />
          {t('everyLanguage')}
        </strong>
        <p>{t('subtitle')}</p>
        <div className="tiny-languages">
          <span>PT</span>
          <span>EN</span>
          <span>ES</span>
          <span>+</span>
        </div>
      </div>
      <div className="sidebar-bottom">
        <a href="https://github.com/Willyanlz/i18n-craft" target="_blank" rel="noreferrer">
          <Github size={17} />
          {t('openSource')}
        </a>
        <span className="version">
          i18nCraft <span>v1.0</span>
        </span>
      </div>
    </aside>
  );
}
