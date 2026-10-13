import { TranslationRow } from './TranslationRow';
import type { Dispatch, SetStateAction } from 'react';
import { Check, ChevronDown, ChevronUp, Globe2, Plus, Search, Sparkles, X } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import { langName, languages, type Entry } from '../core';
import { flagFor } from '../flags';
import type { Suggestion, Suggestions, Translate } from '../types';

import { LangPicker } from './LangPicker';

// Shared pagination controls rendered above and below the table so large
// projects never require scrolling to the bottom to change pages. Purely
// presentational: suggestion/AI logic operates on the full `visible` list,
// never on the current slice.
function PaginationBar({
  t,
  tablePage,
  pageCount,
  setTablePage,
  visibleCount,
  pageSize,
  pickPageSize,
  position,
}: {
  t: Translate;
  tablePage: number;
  pageCount: number;
  setTablePage: Dispatch<SetStateAction<number>>;
  visibleCount: number;
  pageSize: 20 | 50 | 100;
  pickPageSize: (size: 20 | 50 | 100) => void;
  position: 'top' | 'bottom';
}) {
  return (
    <div className={`pagination-bar pagination-${position}`}>
      <button
        className="button"
        disabled={tablePage === 0}
        onClick={() => setTablePage(tablePage - 1)}
      >
        {t('prevPage')}
      </button>
      <span>
        {t('page')} {tablePage + 1} {t('of')} {pageCount} · {visibleCount} {t('keys')}
      </span>
      <button
        className="button"
        disabled={tablePage >= pageCount - 1}
        onClick={() => setTablePage(tablePage + 1)}
      >
        {t('nextPage')}
      </button>
      <label>
        <select
          aria-label={t('perPage')}
          value={pageSize}
          onChange={(event) => pickPageSize(Number(event.target.value) as 20 | 50 | 100)}
        >
          {([20, 50, 100] as const).map((size) => (
            <option key={size} value={size}>
              {size} {t('perPage')}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
export type EditorProps = {
  onEditingChange: (id: string | null) => void;
  t: Translate;
  selected: string[];
  pendingByLang: { [k: string]: number };
  active: string;
  base: 'pt' | 'en' | 'es';
  setActiveLang: Dispatch<SetStateAction<string>>;
  removeLanguage: (code: string) => void;
  setSelected: Dispatch<SetStateAction<string[]>>;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  filter: string;
  setFilter: Dispatch<SetStateAction<string>>;
  ai: boolean;
  pendingSources: Entry[];
  busy: boolean;
  suggest: () => Promise<void>;
  visible: Entry[];
  paged: Entry[];
  pageStart: number;
  tablePage: number;
  pageCount: number;
  setTablePage: Dispatch<SetStateAction<number>>;
  pageSize: 20 | 50 | 100;
  pickPageSize: (size: 20 | 50 | 100) => void;
  validSuggestion: (entry: Entry, code: string) => Suggestion | undefined;
  errors: Map<string, string>;
  updateEntry: (id: string, change: Partial<Entry>) => void;
  onCellKey: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, _last: boolean) => void;
  setValue: (entry: Entry, code: string, value: string) => void;
  dismissSuggestion: (entry: Entry, code: string, accept: boolean) => void;
  suggestionCount: number;
  acceptAllSuggestions: () => void;
  setEntries: Dispatch<SetStateAction<Entry[]>>;
  setSuggestions: Dispatch<SetStateAction<Suggestions>>;
  entries: Entry[];
  addEntry: () => void;
};
export function TranslationEditor({
  onEditingChange,
  t,
  selected,
  pendingByLang,
  active,
  base,
  setActiveLang,
  removeLanguage,
  setSelected,
  query,
  setQuery,
  filter,
  setFilter,
  ai,
  pendingSources,
  busy,
  suggest,
  visible,
  paged,
  pageStart,
  tablePage,
  pageCount,
  setTablePage,
  pageSize,
  pickPageSize,
  validSuggestion,
  errors,
  updateEntry,
  onCellKey,
  setValue,
  dismissSuggestion,
  suggestionCount,
  acceptAllSuggestions,
  setEntries,
  setSuggestions,
  entries,
  addEntry,
}: EditorProps) {
  const [valuesCollapsed, setValuesCollapsed] = useState(false);
  return (
    <section className="editor-card">
      <div className="language-toolbar">
        <div className="language-tabs" role="tablist" aria-label={t('editingLanguage')}>
          {selected.map((code) => {
            const pending = pendingByLang[code] || 0;
            const isActive = code === active;
            return (
              <div
                className={`language-tab ${isActive ? 'active' : ''} ${code === base ? 'base' : ''}`}
                key={code}
              >
                <button
                  role="tab"
                  aria-selected={isActive}
                  className="language-tab-button"
                  onClick={() => {
                    setActiveLang(code);
                    setTablePage(0);
                  }}
                  title={`${langName(code)}${pending ? ` · ${pending} ${t('pending')}` : ''}`}
                >
                  <img className="lang-flag" src={flagFor(code)} alt="" aria-hidden="true" />
                  <span className="lang-tab-name">{langName(code)}</span>
                  {code === base && <small>{t('baseLabel')}</small>}
                  {pending > 0 && (
                    <span className="lang-badge" aria-label={`${pending} ${t('pending')}`}>
                      {pending > 99 ? '99+' : pending}
                    </span>
                  )}
                </button>
                {code !== base && (
                  <button
                    className="lang-remove"
                    aria-label={`${t('removeLanguage')} ${langName(code)}`}
                    onClick={() => removeLanguage(code)}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="add-language-wrap">
          <LangPicker
            add
            label={t('addLanguage')}
            value={selected[0]}
            options={languages
              .filter((lang) => !selected.includes(lang.code))
              .map((lang) => lang.code)}
            disabled={selected.length === languages.length}
            onPick={(code) => {
              setSelected((previous) => [...previous, code]);
              setActiveLang(code);
            }}
            locale={base}
          />
        </div>
      </div>
      <div className="filter-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label={t('search')}
            placeholder={t('search')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setTablePage(0);
            }}
          />
        </label>
        <select
          aria-label={t('all')}
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setTablePage(0);
          }}
        >
          {(['all', 'missing', 'suggestions'] as const).map((item) => (
            <option key={item} value={item}>
              {t(item)}
            </option>
          ))}
        </select>
        {ai && (pendingSources.length > 0 || busy) && (
          <button
            className="button subtle"
            disabled={busy}
            title={t('batchHelp')}
            onClick={() => void suggest()}
          >
            <Sparkles size={15} />
            {t(busy ? 'generating' : 'suggestBatch')}
          </button>
        )}
        {ai && suggestionCount > 0 && (
          <button
            className="button subtle"
            disabled={busy}
            title={t('acceptAllHelp')}
            onClick={acceptAllSuggestions}
          >
            <Check size={15} />
            {t('acceptAll')} ({suggestionCount})
          </button>
        )}
      </div>
      <div className="table-scroll">
        {entries.length > 0 && pageCount > 1 && (
          <PaginationBar
            t={t}
            tablePage={tablePage}
            pageCount={pageCount}
            setTablePage={setTablePage}
            visibleCount={visible.length}
            pageSize={pageSize}
            pickPageSize={pickPageSize}
            position="top"
          />
        )}
        <table>
          <thead>
            <tr>
              <th className="row-number">#</th>
              <th>
                {t('key')}
                <span className="muted"> / path</span>
              </th>
              <th className="value-head">
                <span className="value-header">
                  <span>
                    {langName(active)} {active === base && <small>{t('baseLabel')}</small>}
                  </span>
                </span>
              </th>
              <th className="right-column">
                <span className="sr-only">{t('remove')}</span>
                <button
                  className="icon-button value-collapse"
                  aria-expanded={!valuesCollapsed}
                  aria-label={t(valuesCollapsed ? 'valuesExpand' : 'valuesCollapse')}
                  title={t(valuesCollapsed ? 'valuesExpand' : 'valuesCollapse')}
                  onClick={() => setValuesCollapsed((was) => !was)}
                >
                  {valuesCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                  <span>{t(valuesCollapsed ? 'valuesExpand' : 'valuesCollapse')}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody hidden={valuesCollapsed}>
            {paged.map((entry, index) => (
              <TranslationRow
                key={entry.id}
                entry={entry}
                index={index}
                pageStart={pageStart}
                last={index === paged.length - 1}
                item={validSuggestion(entry, active)}
                error={errors.get(entry.id)}
                valuesCollapsed={valuesCollapsed}
                t={t}
                active={active}
                base={base}
                updateEntry={updateEntry}
                onCellKey={onCellKey}
                setValue={setValue}
                dismissSuggestion={dismissSuggestion}
                setEntries={setEntries}
                setSuggestions={setSuggestions}
                onEditingChange={onEditingChange}
              />
            ))}
          </tbody>
        </table>
      </div>
      {valuesCollapsed && entries.length > 0 && (
        <p className="values-collapsed-note">
          {visible.length} {t('keys')} · {t('valuesExpand')}
        </p>
      )}
      {!entries.length ? (
        <div className="empty-state">
          <div className="empty-art">
            <div className="floating-code">{'{ }'}</div>
            <Globe2 size={47} strokeWidth={1.25} />
            <div className="floating-lang">Aa</div>
          </div>
          <h2>{t('emptyTitle')}</h2>
          <p>{t('emptyText')}</p>
          <button className="button primary" onClick={addEntry}>
            <Plus size={16} />
            {t('addKey')}
          </button>
        </div>
      ) : !visible.length ? (
        <div className="no-matches">{t('noMatches')}</div>
      ) : null}
      {entries.length > 0 && (
        <button className="add-row" onClick={addEntry}>
          <Plus size={17} />
          {t('addKey')}
        </button>
      )}
      {entries.length > 0 && pageCount > 1 && (
        <PaginationBar
          t={t}
          tablePage={tablePage}
          pageCount={pageCount}
          setTablePage={setTablePage}
          visibleCount={visible.length}
          pageSize={pageSize}
          pickPageSize={pickPageSize}
          position="bottom"
        />
      )}
      <div className="editor-footer">
        <span>
          <kbd>↵</kbd> {t('keyboard')}
        </span>
        <span>
          {visible.length} {t('keys')}
        </span>
      </div>
    </section>
  );
}
