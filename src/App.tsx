import { strToU8, zipSync } from 'fflate';
import { Braces, Download, FileJson, Globe2, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* Theme still applies without storage. */
    }
  }, [theme]);
  useEffect(() => {
    try {
      saveProjectSession({ entries, selected });
      saveSelectedLangs(selected);
    } catch {
      setNotice(messages[locale].sessionSaveError);
    }
  }, [entries, selected, locale]);
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
  const keyed = entries.filter((e) => e.key.trim());
  const filled = keyed.reduce(
    (sum, e) => sum + selected.filter((code) => e.values[code]?.trim()).length,
    0,
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
  const pendingSources = entries.filter(
    (entry) =>
      entry.key.trim() &&
      !errors.has(entry.id) &&
      valueType(entry, base) === 'string' &&
      entry.values[base]?.trim() &&
      targets.some((code) => !entry.values[code]?.trim() && !validSuggestion(entry, code)),
  );
  const pendingByLang = useMemo(
    () =>
      Object.fromEntries(
        selected.map((code) => [
          code,
          keyed.filter((entry) => !errors.has(entry.id) && !entry.values[code]?.trim()).length,
        ]),
      ),
    [keyed, selected, errors, entries],
  );
  const effectivePreviewLang =
    modal === 'export' && selected.includes(previewLang) ? previewLang : active;
  const visible = entries.filter((entry) => {
    const matches = `${entry.key} ${Object.values(entry.values).join(' ')}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase());
    return (
      matches &&
      (filter === 'all' ||
        (filter === 'missing' && !entry.values[active]?.trim()) ||
        (filter === 'suggestions' && validSuggestion(entry, active) !== undefined))
    );
  });
  const json = useMemo(
    () => (errors.size ? '' : buildJson(entries, effectivePreviewLang)),
    [entries, effectivePreviewLang, errors],
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
    setEntries((previous) => [...previous, entry]);
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
      const cells = visible.flatMap((entry) => [`key-${entry.id}`, `value-${entry.id}-${active}`]);
      const next = cells.indexOf(event.currentTarget.id) + (event.shiftKey ? -1 : 1);
      if (next >= 0 && next < cells.length) {
        event.preventDefault();
        document.getElementById(cells[next])?.focus();
      } else if (!event.shiftKey) {
        event.preventDefault();
        addEntry();
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
      json={json}
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
                setEntries([]);
                setSuggestions({});
                setQuery('');
                setFilter('all');
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
