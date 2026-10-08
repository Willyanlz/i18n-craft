import { strToU8, zipSync } from 'fflate';
import { Braces, Download, FileJson, Globe2, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AI_SETTINGS_KEY, readAiSettings } from './ai-settings';
import { ImportDialog } from './components/ImportDialog';
import { JsonPreview } from './components/JsonPreview';
import { Modal } from './components/Modal';
import { SettingsPanel } from './components/SettingsPanel';
import { ScrollControls } from './components/ScrollControls';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { TranslationEditor } from './components/TranslationEditor';
import {
  buildJson,
  mergeJson,
  newEntry,
  parseJsonInput,
  providers,
  tokensMatch,
  validateKeys,
  valueType,
  type Entry,
} from './core';
import { messages, type Locale, type MessageKey } from './i18n';
import {
  readProjectSession,
  readSelectedLangs,
  saveProjectSession,
  saveSelectedLangs,
} from './project-session';
import type { ModalName, Suggestions } from './types';
import { useDebouncedValue } from './use-debounced-value';

const LOCALE_KEY = 'i18ncraft.locale';
const readLocale = (): Locale => {
  try {
    const value = localStorage.getItem(LOCALE_KEY);
    return value === 'en' || value === 'es' ? value : 'pt';
  } catch {
    return 'pt';
  }
};
const THEME_KEY = 'i18ncraft.theme';
const PAGE_SIZE_KEY = 'i18ncraft.page-size';
type PageSize = 20 | 50 | 100;
const readPageSize = (): PageSize => {
  try {
    const value = Number(localStorage.getItem(PAGE_SIZE_KEY));
    return value === 20 || value === 100 ? value : 50;
  } catch {
    return 50;
  }
};
const readTheme = (): 'light' | 'dark' => {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export default function App() {
  const [savedProject] = useState(readProjectSession);
  const [locale, setLocale] = useState<Locale>(readLocale);
  const t = (key: MessageKey) => messages[locale][key];
  const [theme, setTheme] = useState<'light' | 'dark'>(readTheme);
  const [page, setPage] = useState<'editor' | 'settings'>('editor');
  const [entries, setEntries] = useState<Entry[]>(savedProject.entries);
  const base = locale;
  const [selected, setSelected] = useState<string[]>(() => {
    const stored = readSelectedLangs(savedProject.selected);
    return stored.includes(base) ? stored : [...stored, base];
  });
  const [activeLang, setActiveLang] = useState(
    savedProject.selected.includes(base) ? base : savedProject.selected[0],
  );
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  // Pagination: slices the filtered list so the DOM never holds thousands of
  // rows at once. Small projects (visible <= pageSize) render exactly as
  // before — controls stay hidden and numbering/Tab order are unchanged.
  const [tablePage, setTablePage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>(readPageSize);
  const [previewLang, setPreviewLang] = useState(savedProject.selected[0]);
  const [previewMode, setPreviewMode] = useState<'json' | 'tree'>('json');
  const [modal, setModal] = useState<ModalName>(null);
  const [importLang, setImportLang] = useState('pt');
  const [importText, setImportText] = useState('');
  const [overwrite, setOverwrite] = useState(false);
  const [importError, setImportError] = useState('');
  const [ai, setAi] = useState(false);
  const [aiSettings, setAiSettings] = useState(readAiSettings);
  const { provider, model, apikey } = aiSettings;
  const [suggestions, setSuggestions] = useState<Suggestions>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const controller = useRef<AbortController | null>(null);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const currentRef = useRef({ base, selected });
  currentRef.current = { base, selected };
  const focusTarget = useRef<string | null>(null);
  // Guards the debounced saver: clearing bumps the epoch so a stale timer
  // never resurrects entries that were just wiped.
  const saveEpoch = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* Theme still applies without storage. */
    }
  }, [theme]);
  const flushSession = useCallback(() => {
    try {
      saveProjectSession({ entries: entriesRef.current, selected: currentRef.current.selected });
      saveSelectedLangs(currentRef.current.selected);
    } catch {
      setNotice(messages[locale].sessionSaveError);
    }
  }, [locale]);
  useEffect(() => {
    // Debounced save: typing stays instant, sessionStorage writes (which can
    // exceed 1MB on large projects) happen 500ms after the last keystroke.
    // flushSession covers unload + destructive actions so no work is lost.
    const epoch = saveEpoch.current;
    const timer = setTimeout(() => {
      if (saveEpoch.current === epoch) flushSession();
    }, 500);
    return () => clearTimeout(timer);
  }, [entries, selected, flushSession]);
  useEffect(() => {
    const flush = () => flushSession();
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [flushSession]);
  useEffect(() => {
    document.documentElement.lang = locale === 'pt' ? 'pt-BR' : locale;
    try {
      localStorage.setItem(LOCALE_KEY, locale);
    } catch {
      /* Interface still works without storage. */
    }
  }, [locale]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (focusTarget.current) {
      document.getElementById(focusTarget.current)?.focus();
      focusTarget.current = null;
    }
  });
  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    setSelected((previous) => (previous.includes(locale) ? previous : [...previous, locale]));
    setActiveLang(locale);
    setSuggestions({});
    controller.current?.abort();
  }, [locale]);
  useEffect(() => {
    if (!ai) controller.current?.abort();
  }, [ai]);
  useEffect(() => {
    try {
      localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(aiSettings));
    } catch {
      setNotice(messages[locale].storageError);
    }
  }, [aiSettings, locale]);

  const errors = useMemo(() => validateKeys(entries), [entries]);
  // Memoized derivations: without this, every keystroke re-runs filter +
  // join(' ') over thousands of entries. keyed is stable so pendingByLang
  // no longer recomputes on every render.
  const keyed = useMemo(() => entries.filter((e) => e.key.trim()), [entries]);
  const filled = useMemo(
    () =>
      keyed.reduce((sum, e) => sum + selected.filter((code) => e.values[code]?.trim()).length, 0),
    [keyed, selected],
  );
  const total = keyed.length * selected.length;
  const progress = total ? Math.round((filled / total) * 100) : 0;
  const validSuggestion = (entry: Entry, code: string) => {
    const item = suggestions[entry.id]?.[code];
    return ai &&
      item &&
      item.source === entry.values[base] &&
      item.key === entry.key &&
      item.base === base &&
      !entry.values[code]?.trim()
      ? item
      : undefined;
  };
  const targets = selected.filter((code) => code !== base);
  const active = selected.includes(activeLang) ? activeLang : base;
  const suggestionCount = entries.reduce(
    (count, entry) => count + (validSuggestion(entry, active) ? 1 : 0),
    0,
  );
  const acceptAllSuggestions = () => {
    setEntries((previous) =>
      previous.map((entry) => {
        const item = validSuggestion(entry, active);
        return item ? { ...entry, values: { ...entry.values, [active]: item.text } } : entry;
      }),
    );
    setSuggestions((previous) =>
      Object.fromEntries(
        Object.entries(previous).map(([id, suggestionsByLanguage]) => {
          const remaining = { ...suggestionsByLanguage };
          delete remaining[active];
          return [id, remaining];
        }),
      ),
    );
  };
  const pendingSources = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.key.trim() &&
          !errors.has(entry.id) &&
          valueType(entry, base) === 'string' &&
          entry.values[base]?.trim() &&
          targets.some((code) => !entry.values[code]?.trim() && !validSuggestion(entry, code)),
      ),
    // validSuggestion closes over suggestions/ai/base; recompute when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, errors, base, targets, suggestions, ai],
  );
  const pendingByLang = useMemo(
    () =>
      Object.fromEntries(
        selected.map((code) => [
          code,
          keyed.filter((entry) => !errors.has(entry.id) && !entry.values[code]?.trim()).length,
        ]),
      ),
    [keyed, selected, errors],
  );
  const effectivePreviewLang =
    modal === 'export' && selected.includes(previewLang) ? previewLang : active;
  const loweredQuery = query.toLocaleLowerCase();
  const visible = useMemo(
    () =>
      entries.filter((entry) => {
        const matches = `${entry.key} ${Object.values(entry.values).join(' ')}`
          .toLocaleLowerCase()
          .includes(loweredQuery);
        return (
          matches &&
          (filter === 'all' ||
            (filter === 'missing' && !entry.values[active]?.trim()) ||
            (filter === 'suggestions' && validSuggestion(entry, active) !== undefined))
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, loweredQuery, filter, active, suggestions, ai],
  );
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const safeTablePage = Math.min(tablePage, pageCount - 1);
  const paged = useMemo(
    () => visible.slice(safeTablePage * pageSize, safeTablePage * pageSize + pageSize),
    [visible, safeTablePage, pageSize],
  );
  const pickPageSize = (size: PageSize) => {
    setPageSize(size);
    setTablePage(0);
    try {
      localStorage.setItem(PAGE_SIZE_KEY, String(size));
    } catch {
      /* Page size still applies without storage. */
    }
  };
  // Debounced preview: inputs update instantly from `entries`, while the
  // expensive buildJson (~200KB stringify on large projects) runs 400ms
  // after typing stops. Small projects (<500 keys) stay effectively instant.
  const previewEntries = useDebouncedValue(entries, 400);
  const json = useMemo(
    () => (errors.size ? '' : buildJson(entries, effectivePreviewLang)),
    [entries, effectivePreviewLang, errors],
  );
  const previewJson = useMemo(
    () => (errors.size ? '' : buildJson(previewEntries, effectivePreviewLang)),
    [previewEntries, effectivePreviewLang, errors],
  );
  const updateEntry = (id: string, change: Partial<Entry>) =>
    setEntries((previous) =>
      previous.map((entry) => (entry.id === id ? { ...entry, ...change } : entry)),
    );
  const setValue = (entry: Entry, code: string, value: string) =>
    updateEntry(entry.id, { values: { ...entry.values, [code]: value } });
  const addEntry = () => {
    const entry = newEntry();
    focusTarget.current = `key-${entry.id}`;
    setQuery('');
    setFilter('all');
    setPage('editor');
    setEntries((previous) => {
      const next = [...previous, entry];
      // Jump to the page holding the new row so small-project UX is
      // identical and large-project users see the focused input at once.
      setTablePage(Math.floor(next.length / pageSize));
      return next;
    });
  };
  const onCellKey = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    _last: boolean,
  ) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      addEntry();
      return;
    }
    if (event.key === 'Tab') {
      const cells = paged.flatMap((entry) => [`key-${entry.id}`, `value-${entry.id}-${active}`]);
      const next = cells.indexOf(event.currentTarget.id) + (event.shiftKey ? -1 : 1);
      if (next >= 0 && next < cells.length) {
        event.preventDefault();
        document.getElementById(cells[next])?.focus();
      } else if (!event.shiftKey) {
        if (safeTablePage < pageCount - 1) {
          // Advance to the next page instead of trapping focus, then focus
          // its first input once the slice renders.
          event.preventDefault();
          const first = visible[(safeTablePage + 1) * pageSize];
          if (first) focusTarget.current = `key-${first.id}`;
          setTablePage(safeTablePage + 1);
        } else {
          event.preventDefault();
          addEntry();
        }
      }
    }
  };
  const removeLanguage = (code: string) => {
    if (code === base || !window.confirm(t('removeLanguageConfirm'))) return;
    setSelected((previous) => previous.filter((lang) => lang !== code));
    if (activeLang === code) setActiveLang(base);
    setEntries((previous) =>
      previous.map((entry) => {
        const values = { ...entry.values };
        delete values[code];
        const types = { ...entry.types };
        delete types[code];
        return { ...entry, values, types };
      }),
    );
    setSuggestions({});
    if (previewLang === code) setPreviewLang(base);
  };
  const download = (content: BlobPart, filename: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copyJson = async () => {
    try {
      if (errors.size) throw new Error();
      await navigator.clipboard.writeText(json);
      setNotice(t('copied'));
    } catch {
      setNotice(t(errors.size ? 'invalidExport' : 'copyError'));
    }
  };
  const downloadAll = () => {
    if (errors.size) return setNotice(t('invalidExport'));
    const files = Object.fromEntries(
      selected.map((code) => [`${code}.json`, strToU8(buildJson(entries, code))]),
    );
    download(zipSync(files) as BlobPart, 'i18nCraft.zip', 'application/zip');
  };
  const importJson = () => {
    try {
      if (new TextEncoder().encode(importText).length > 2 * 1024 * 1024)
        return setImportError(t('fileSize'));
      const merged = mergeJson(entries, parseJsonInput(importText), importLang, overwrite);
      setEntries(merged);
      setSuggestions({});
      if (!selected.includes(importLang)) setSelected((previous) => [...previous, importLang]);
      setQuery('');
      setFilter('all');
      setTablePage(0);
      setModal(null);
      setImportText('');
      setNotice(t('importSuccess'));
    } catch (error) {
      setImportError(
        t(
          error instanceof Error && error.message === 'conflict' ? 'importConflict' : 'importError',
        ),
      );
    }
  };
  const suggest = async () => {
    if (!ai || !apikey.trim()) {
      setNotice(t('noApi'));
      setPage('settings');
      return;
    }
    const sources = pendingSources;
    if (!sources.length || !targets.length) return setNotice(t('noPending'));
    const requestBase = base;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    try {
      const remaining = new Set(sources.map((entry) => entry.id));
      const completed = new Map<string, Set<string>>();
      while (remaining.size && !abort.signal.aborted) {
        const currentErrors = validateKeys(entriesRef.current);
        const eligible = entriesRef.current.filter(
          (entry) =>
            remaining.has(entry.id) &&
            entry.key.trim() &&
            !currentErrors.has(entry.id) &&
            valueType(entry, base) === 'string' &&
            entry.values[base]?.trim(),
        );
        const missingTargets = (entry: Entry) =>
          targets.filter(
            (code) =>
              currentRef.current.selected.includes(code) &&
              !entry.values[code]?.trim() &&
              !validSuggestion(entry, code) &&
              !completed.get(entry.id)?.has(code),
          );
        const first = eligible.find((entry) => missingTargets(entry).length);
        if (!first) break;
        const batchTargets = missingTargets(first).slice(0, 6);
        const signature = batchTargets.join(',');
        const batch = eligible
          .filter((entry) => missingTargets(entry).slice(0, 6).join(',') === signature)
          .slice(0, 100);

        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abort.signal,
          body: JSON.stringify({
            provider,
            model: model,
            apiKey: apikey.trim(),
            base,
            targets: batchTargets,
            entries: batch.map((entry) => ({
              id: entry.id,
              key: entry.key,
              text: entry.values[base],
            })),
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          const providerError =
            data.providerStatus === 404
              ? 'aiModelError'
              : data.providerStatus === 401 || data.providerStatus === 403
                ? 'aiCredentialsError'
                : data.providerStatus === 429
                  ? 'aiQuotaError'
                  : [502, 503, 504].includes(data.providerStatus)
                    ? 'aiUnavailableError'
                    : undefined;
          if (providerError) {
            setNotice(`${providers[provider].name} (${model}): ${t(providerError)}`);
            return;
          }
          throw new Error(data.error);
        }
        const next: Suggestions = {};
        for (const item of data.translations as { id: string; values: Record<string, string> }[]) {
          const source = batch.find((entry) => entry.id === item.id);
          const current = entriesRef.current.find((entry) => entry.id === item.id);
          if (
            !source ||
            !current ||
            current.key !== source.key ||
            current.values[requestBase] !== source.values[requestBase] ||
            currentRef.current.base !== requestBase
          )
            continue;
          for (const code of batchTargets) {
            const text = item.values[code];
            if (typeof text !== 'string' || !tokensMatch(source.values[requestBase], text))
              throw new Error('tokens');
            if (!current.values[code]?.trim() && currentRef.current.selected.includes(code))
              (next[item.id] ??= {})[code] = {
                text,
                source: source.values[requestBase],
                key: source.key,
                base: requestBase,
              };
          }
        }
        for (const entry of batch) {
          const done = completed.get(entry.id) ?? new Set<string>();
          for (const code of batchTargets) done.add(code);
          completed.set(entry.id, done);
        }
        setSuggestions((previous) => {
          const merged = { ...previous };
          for (const [id, values] of Object.entries(next))
            merged[id] = { ...merged[id], ...values };
          return merged;
        });
      }
    } catch (error) {
      if (!abort.signal.aborted)
        setNotice(
          t(error instanceof Error && error.message === 'tokens' ? 'tokenError' : 'aiError'),
        );
    } finally {
      setBusy(false);
      controller.current = null;
    }
  };
  const dismissSuggestion = (entry: Entry, code: string, accept: boolean) => {
    const item = validSuggestion(entry, code);
    if (accept && item) updateEntry(entry.id, { values: { ...entry.values, [code]: item.text } });
    setSuggestions((previous) => {
      const values = { ...previous[entry.id] };
      delete values[code];
      return { ...previous, [entry.id]: values };
    });
    if (!accept) {
      if (active !== code) setActiveLang(code);
      setQuery('');
      setFilter('all');
      setTablePage(0);
      focusTarget.current = `value-${entry.id}-${code}`;
    }
  };

  const preview = (
    <JsonPreview
      previewMode={previewMode}
      setPreviewMode={setPreviewMode}
      t={t}
      previewLang={effectivePreviewLang}
      setPreviewLang={setPreviewLang}
      languages={modal === 'export' ? selected : undefined}
      errors={errors}
      // Lazy preview: the editor panel uses the debounced JSON so typing
      // never blocks on a ~200KB stringify; export actions use the live
      // `json` so copy/download are always exact.
      json={modal === 'export' ? json : previewJson}
      copyJson={copyJson}
      download={download}
    />
  );

  return (
    <div className="app-shell">
      <Sidebar setPage={setPage} t={t} page={page} />
      <main>
        <Topbar
          t={t}
          page={page}
          theme={theme}
          setTheme={setTheme}
          locale={locale}
          setLocale={setLocale}
        />
        <div className="main-content">
          {page === 'editor' ? (
            <>
              <section className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span /> {t('welcome')}
                  </div>
                  <h1>{t('heading')}</h1>
                  <p>{t('subtitle')}</p>
                </div>
                <div className="actions project-actions">
                  <button
                    className="button danger"
                    onClick={() => setModal('clear')}
                    disabled={!entries.length}
                  >
                    <Trash2 size={16} />
                    {t('clear')}
                  </button>
                  <button
                    className="button"
                    onClick={() => {
                      setImportError('');
                      setImportLang(base);
                      setModal('import');
                    }}
                  >
                    <Upload size={16} />
                    {t('import')}
                  </button>
                  <button
                    className="button primary"
                    disabled={!keyed.length || !!errors.size}
                    onClick={() => {
                      setPreviewLang(active);
                      setModal('export');
                    }}
                  >
                    <Download size={16} />
                    {t('export')}
                  </button>
                </div>
              </section>
              <section className="overview">
                <div className="stat">
                  <span className="stat-icon">
                    <Braces size={20} />
                  </span>
                  <div>
                    <strong>{keyed.length.toString().padStart(2, '0')}</strong>
                    <span>{t('keys')}</span>
                  </div>
                </div>
                <div className="stat">
                  <span className="stat-icon">
                    <Globe2 size={20} />
                  </span>
                  <div>
                    <strong>{selected.length.toString().padStart(2, '0')}</strong>
                    <span>{t('languages')}</span>
                  </div>
                </div>
                <div className="progress-stat">
                  <div>
                    <strong>
                      {progress}% <span>{t('complete')}</span>
                    </strong>
                    <span>
                      {total - filled} {t('pending')}
                    </span>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <button
                  className={`ai-switch ${ai ? 'enabled' : ''}`}
                  onClick={() => setAi(!ai)}
                  aria-pressed={ai}
                >
                  <Sparkles size={17} />
                  {t(ai ? 'aiOn' : 'aiOff')}
                  <span className="switch-track">
                    <span />
                  </span>
                </button>
              </section>
              <TranslationEditor
                t={t}
                selected={selected}
                pendingByLang={pendingByLang}
                active={active}
                base={base}
                setActiveLang={setActiveLang}
                removeLanguage={removeLanguage}
                setSelected={setSelected}
                query={query}
                setQuery={setQuery}
                filter={filter}
                setFilter={setFilter}
                ai={ai}
                pendingSources={pendingSources}
                busy={busy}
                suggest={suggest}
                visible={visible}
                paged={paged}
                pageStart={safeTablePage * pageSize}
                tablePage={safeTablePage}
                pageCount={pageCount}
                setTablePage={setTablePage}
                pageSize={pageSize}
                pickPageSize={pickPageSize}
                validSuggestion={validSuggestion}
                errors={errors}
                updateEntry={updateEntry}
                onCellKey={onCellKey}
                setValue={setValue}
                dismissSuggestion={dismissSuggestion}
                suggestionCount={suggestionCount}
                acceptAllSuggestions={acceptAllSuggestions}
                setEntries={setEntries}
                setSuggestions={setSuggestions}
                entries={entries}
                addEntry={addEntry}
              />
              <div className="json-panel">
                <section className="preview-card">{preview}</section>
              </div>
            </>
          ) : (
            <SettingsPanel
              t={t}
              locale={locale}
              setLocale={setLocale}
              theme={theme}
              setTheme={setTheme}
              ai={ai}
              setAi={setAi}
              provider={provider}
              setAiSettings={setAiSettings}
              model={model}
              apikey={apikey}
            />
          )}
        </div>
      </main>
      {modal === 'import' && (
        <ImportDialog
          t={t}
          locale={locale}
          setModal={setModal}
          importLang={importLang}
          setImportLang={setImportLang}
          setImportText={setImportText}
          setImportError={setImportError}
          importText={importText}
          overwrite={overwrite}
          setOverwrite={setOverwrite}
          importError={importError}
          importJson={importJson}
        />
      )}
      {modal === 'export' && (
        <Modal title={t('export')} closeLabel={t('close')} onClose={() => setModal(null)}>
          <p>{t('exportText')}</p>
          <section className="preview-card">{preview}</section>
          <p className="help-text">{t('exportEmpty')}</p>
          <div className="modal-actions">
            <button className="button primary" onClick={downloadAll}>
              <Download size={16} />
              {t('zip')}
            </button>
          </div>
        </Modal>
      )}
      {modal === 'clear' && (
        <Modal title={t('clear')} closeLabel={t('close')} onClose={() => setModal(null)}>
          <p>{t('clearConfirm')}</p>
          <div className="modal-actions">
            <button className="button" onClick={() => setModal(null)}>
              {t('cancel')}
            </button>
            <button
              className="button danger"
              onClick={() => {
                controller.current?.abort();
                // Clear synchronously and invalidate pending debounce timers:
                // the saver still holds previous entries, so wipe storage now
                // and bump the epoch to avoid resurrecting the project.
                saveEpoch.current += 1;
                try {
                  saveProjectSession({ entries: [], selected });
                } catch {
                  /* Clearing continues without storage. */
                }
                setEntries([]);
                setSuggestions({});
                setQuery('');
                setFilter('all');
                setTablePage(0);
                setImportText('');
                setModal(null);
              }}
            >
              {t('yesClear')}
            </button>
          </div>
        </Modal>
      )}
      {!modal && <ScrollControls t={t} />}
      {notice && (
        <div className="toast" role="status">
          <FileJson size={18} />
          <span>{notice}</span>
          <button aria-label={t('close')} onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
