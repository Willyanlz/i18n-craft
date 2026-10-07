import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Braces, Check, ChevronRight, Clipboard, Code2, Download, FileJson, Github, Globe2, Languages, Moon, Plus, Search, Settings2, Sparkles, Sun, Trash2, Upload, X } from 'lucide-react';
import { strToU8, zipSync } from 'fflate';
import { buildJson, languages, mergeJson, newEntry, parseJsonInput, providers, tokensMatch, validateKeys, type Entry, type Provider } from './core';
import { messages, type Locale, type MessageKey } from './i18n';
import { AI_SETTINGS_KEY, readAiSettings } from './ai-settings';
import { readProjectSession, saveProjectSession } from './project-session';

type Suggestion = { text: string; source: string; key: string; base: string };
type Suggestions = Record<string, Record<string, Suggestion>>;
type ModalName = 'import' | 'export' | 'clear' | null;
const LOCALE_KEY = 'i18ncraft.locale';
const readLocale = (): Locale => { try { const value = localStorage.getItem(LOCALE_KEY); return value === 'en' || value === 'es' ? value : 'pt'; } catch { return 'pt'; } };
const langName = (code: string) => languages.find(l => l.code === code)?.name || code;

function Modal({ title, closeLabel, onClose, children }: { title: string; closeLabel: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={dialog} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}><div className="modal-inner"><div className="section-heading"><h2>{title}</h2><button className="icon-button" aria-label={closeLabel} onClick={onClose}><X size={19}/></button></div>{children}</div></dialog>;
}

function JsonTree({ value }: { value: Record<string, unknown> }) {
  return <ul className="json-tree">{Object.entries(value).map(([key, child]) => <li key={key}>{typeof child === 'object' && child !== null ? <details open><summary><Braces size={14}/>{key}</summary><JsonTree value={child as Record<string, unknown>}/></details> : <div><span>{key}</span><em>{String(child) || '""'}</em></div>}</li>)}</ul>;
}

export default function App() {
  const [savedProject] = useState(readProjectSession);
  const [locale, setLocale] = useState<Locale>(readLocale);
  const t = (key: MessageKey) => messages[locale][key];
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [page, setPage] = useState<'editor' | 'settings'>('editor');
  const [entries, setEntries] = useState<Entry[]>(savedProject.entries);
  const [selected, setSelected] = useState(savedProject.selected);
  const base = locale;
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
  const entriesRef = useRef(entries); entriesRef.current = entries;
  const currentRef = useRef({ base, selected }); currentRef.current = { base, selected };
  const focusTarget = useRef<string | null>(null);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    try { saveProjectSession({ entries, selected }); }
    catch { setNotice(messages[locale].sessionSaveError); }
  }, [entries, selected, locale]);
  useEffect(() => { document.documentElement.lang = locale === 'pt' ? 'pt-BR' : locale; try { localStorage.setItem(LOCALE_KEY, locale); } catch { /* Interface still works without storage. */ } }, [locale]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 6500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (focusTarget.current) { document.getElementById(focusTarget.current)?.focus(); focusTarget.current = null; } }, [entries, query, filter, page]);
  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    setSelected(previous => previous.includes(locale) ? previous : [...previous, locale]);
    setSuggestions({});
    controller.current?.abort();
  }, [locale]);
  useEffect(() => {
    if (!ai) controller.current?.abort();
  }, [ai]);
  useEffect(() => {
    try { localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(aiSettings)); }
    catch { setNotice(messages[locale].storageError); }
  }, [aiSettings, locale]);

  const errors = useMemo(() => validateKeys(entries), [entries]);
  const keyed = entries.filter(e => e.key.trim());
  const filled = keyed.reduce((sum, e) => sum + selected.filter(code => e.values[code]?.trim()).length, 0);
  const total = keyed.length * selected.length;
  const progress = total ? Math.round(filled / total * 100) : 0;
  const validSuggestion = (entry: Entry, code: string) => {
    const item = suggestions[entry.id]?.[code];
    return ai && item && item.source === entry.values[base] && item.key === entry.key && item.base === base && !entry.values[code]?.trim() ? item : undefined;
  };
  const targets = selected.filter(code => code !== base);
  const pendingSources = entries.filter(entry => entry.key.trim() && !errors.has(entry.id) && entry.values[base]?.trim() && targets.some(code => !entry.values[code]?.trim() && !validSuggestion(entry, code)));
  const visible = entries.filter(entry => {
    const matches = `${entry.key} ${Object.values(entry.values).join(' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
    return matches && (filter === 'all' || (filter === 'missing' && selected.some(code => !entry.values[code]?.trim())) || (filter === 'suggestions' && selected.some(code => validSuggestion(entry, code))));
  });
  const json = useMemo(() => errors.size ? '' : buildJson(entries, previewLang), [entries, previewLang, errors]);
  const updateEntry = (id: string, change: Partial<Entry>) => setEntries(previous => previous.map(entry => entry.id === id ? { ...entry, ...change } : entry));
  const setValue = (entry: Entry, code: string, value: string) => updateEntry(entry.id, { values: { ...entry.values, [code]: value } });
  const addEntry = () => {
    const entry = newEntry(); focusTarget.current = `key-${entry.id}`; setQuery(''); setFilter('all'); setPage('editor'); setEntries(previous => [...previous, entry]);
  };
  const onCellKey = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, _last: boolean) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); addEntry(); return; }
    if (event.key === 'Tab') {
      const cells = visible.flatMap(entry => [`key-${entry.id}`, ...selected.map(code => `value-${entry.id}-${code}`)]);
      const next = cells.indexOf(event.currentTarget.id) + (event.shiftKey ? -1 : 1);
      if (next >= 0 && next < cells.length) { event.preventDefault(); document.getElementById(cells[next])?.focus(); }
      else if (!event.shiftKey) { event.preventDefault(); addEntry(); }
    }
  };
  const removeLanguage = (code: string) => {
    if (code === base || !window.confirm(t('removeLanguageConfirm'))) return;
    setSelected(previous => previous.filter(lang => lang !== code));
    setEntries(previous => previous.map(entry => { const values = { ...entry.values }; delete values[code]; return { ...entry, values }; }));
    setSuggestions({});
    if (previewLang === code) setPreviewLang(base);
  };
  const download = (content: BlobPart, filename: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copyJson = async () => { try { if (errors.size) throw new Error(); await navigator.clipboard.writeText(json); setNotice(t('copied')); } catch { setNotice(t(errors.size ? 'invalidExport' : 'copyError')); } };
  const downloadAll = () => { if (errors.size) return setNotice(t('invalidExport')); const files = Object.fromEntries(selected.map(code => [`${code}.json`, strToU8(buildJson(entries, code))])); download(zipSync(files) as BlobPart, 'i18nCraft.zip', 'application/zip'); };
  const importJson = () => {
    try {
      if (new TextEncoder().encode(importText).length > 2 * 1024 * 1024) return setImportError(t('fileSize'));
      const merged = mergeJson(entries, parseJsonInput(importText), importLang, overwrite);
      setEntries(merged); setSuggestions({}); if (!selected.includes(importLang)) setSelected(previous => [...previous, importLang]);
      setQuery(''); setFilter('all'); setModal(null); setImportText(''); setNotice(t('importSuccess'));
    } catch (error) { setImportError(t(error instanceof Error && error.message === 'conflict' ? 'importConflict' : 'importError')); }
  };
  const suggest = async () => {
    if (!ai || !apikey.trim()) { setNotice(t('noApi')); setPage('settings'); return; }
    const sources = pendingSources;
    if (!sources.length || !targets.length) return setNotice(t('noPending'));
    const requestBase = base;
    const abort = new AbortController(); controller.current = abort; setBusy(true);
    try {
      const remaining = new Set(sources.map(entry => entry.id));
      while (remaining.size && !abort.signal.aborted) {
      const currentErrors = validateKeys(entriesRef.current);
      const eligible = entriesRef.current.filter(entry => remaining.has(entry.id) && entry.key.trim() && !currentErrors.has(entry.id) && entry.values[base]?.trim());
      const missingTargets = (entry: Entry) => targets.filter(code => currentRef.current.selected.includes(code) && !entry.values[code]?.trim() && !validSuggestion(entry, code));
      const first = eligible.find(entry => missingTargets(entry).length);
      if (!first) break;
      const batchTargets = missingTargets(first);
      const signature = batchTargets.join(',');
      const batch = eligible.filter(entry => missingTargets(entry).join(',') === signature).slice(0, 100);
      for (const entry of batch) remaining.delete(entry.id);
      const response = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abort.signal, body: JSON.stringify({ provider, model: model, apiKey: apikey.trim(), base, targets: batchTargets, entries: batch.map(entry => ({ id: entry.id, key: entry.key, text: entry.values[base] })) }) });
      const data = await response.json();
      if (!response.ok) {
        const providerError = data.providerStatus === 404 ? 'aiModelError'
          : data.providerStatus === 401 || data.providerStatus === 403 ? 'aiCredentialsError'
          : data.providerStatus === 429 ? 'aiQuotaError' : undefined;
        if (providerError) {
          setNotice(`${providers[provider].name} (${model}): ${t(providerError)}`);
          return;
        }
        throw new Error(data.error);
      }
      const next: Suggestions = {};
      for (const item of data.translations as { id: string; values: Record<string, string> }[]) {
        const source = batch.find(entry => entry.id === item.id);
        const current = entriesRef.current.find(entry => entry.id === item.id);
        if (!source || !current || current.key !== source.key || current.values[requestBase] !== source.values[requestBase] || currentRef.current.base !== requestBase) continue;
        for (const code of batchTargets) {
          const text = item.values[code];
          if (typeof text !== 'string' || !tokensMatch(source.values[requestBase], text)) throw new Error('tokens');
          if (!current.values[code]?.trim() && currentRef.current.selected.includes(code)) (next[item.id] ??= {})[code] = { text, source: source.values[requestBase], key: source.key, base: requestBase };
        }
      }
      setSuggestions(previous => { const merged = { ...previous }; for (const [id, values] of Object.entries(next)) merged[id] = { ...merged[id], ...values }; return merged; });
      }
    } catch (error) { if (!abort.signal.aborted) setNotice(t(error instanceof Error && error.message === 'tokens' ? 'tokenError' : 'aiError')); }
    finally { setBusy(false); controller.current = null; }
  };
  const dismissSuggestion = (entry: Entry, code: string, accept: boolean) => {
    const item = validSuggestion(entry, code);
    if (accept && item) updateEntry(entry.id, { values: { ...entry.values, [code]: item.text } });
    setSuggestions(previous => { const values = { ...previous[entry.id] }; delete values[code]; return { ...previous, [entry.id]: values }; });
    if (!accept) document.getElementById(`value-${entry.id}-${code}`)?.focus();
  };

  const preview = <><div className="preview-tabs"><div className="segmented"><button className={previewMode === 'json' ? 'active' : ''} onClick={() => setPreviewMode('json')}><Code2 size={15}/>{t('preview')}</button><button className={previewMode === 'tree' ? 'active' : ''} onClick={() => setPreviewMode('tree')}><Braces size={15}/>{t('tree')}</button></div><select aria-label={t('preview')} value={previewLang} onChange={event => setPreviewLang(event.target.value)}>{selected.map(code => <option key={code} value={code}>{code}.json</option>)}</select></div>{errors.size ? <p className="inline-error">{t('invalidExport')}</p> : previewMode === 'json' ? <pre className="code-preview"><code>{json}</code></pre> : <div className="tree-container"><JsonTree value={JSON.parse(json)}/></div>}<div className="preview-footer"><span><span className="status-dot"/> JSON</span><button onClick={() => void copyJson()} disabled={!!errors.size}><Clipboard size={15}/>{t('copy')}</button><button onClick={() => download(json, `${previewLang}.json`, 'application/json')} disabled={!!errors.size}><Download size={15}/>{t('download')}</button></div></>;

  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="#" onClick={event => { event.preventDefault(); setPage('editor'); }}><span className="brand-icon"><Braces size={24}/></span><span>i18n<span className="brand-light">Craft</span><small>TRANSLATION WORKSPACE</small></span></a><div className="nav-label">{t('workspace')}</div><nav><button className={page === 'editor' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('editor')}><Languages size={19}/>{t('editor')}<ChevronRight size={15}/></button><button className={page === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('settings')}><Settings2 size={19}/>{t('settings')}</button></nav><div className="sidebar-note"><span className="note-icon"><Globe2 size={23}/></span><strong>One key.<br/>Every language.</strong><p>{t('subtitle')}</p><div className="tiny-languages"><span>PT</span><span>EN</span><span>ES</span><span>+</span></div></div><div className="sidebar-bottom"><a href="https://github.com/Willyanlz/i18n-craft" target="_blank" rel="noreferrer"><Github size={17}/>{t('openSource')}</a><span className="version">i18nCraft <span>v1.0</span></span></div></aside>
    <main><header className="topbar"><div className="breadcrumbs">{t('workspace')}<ChevronRight size={14}/><strong>{t(page === 'editor' ? 'editor' : 'settings')}</strong></div><div className="topbar-actions"><span className="session-label"><span className="status-dot"/>{t('memory')}</span><button className="icon-button" aria-label={t(theme === 'light' ? 'dark' : 'light')} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}</button><select className="locale-select" aria-label={t('interface')} value={locale} onChange={event => setLocale(event.target.value as Locale)}><option value="pt">PT</option><option value="en">EN</option><option value="es">ES</option></select></div></header>
    <div className="main-content">{page === 'editor' ? <>
      <section className="page-heading"><div><div className="eyebrow"><span/> {t('welcome')}</div><h1>{t('heading')}</h1><p>{t('subtitle')}</p></div><div className="actions project-actions"><button className="button danger" onClick={() => setModal('clear')} disabled={!entries.length}><Trash2 size={16}/>{t('clear')}</button><button className="button" onClick={() => { setImportError(''); setImportLang(base); setModal('import'); }}><Upload size={16}/>{t('import')}</button><button className="button primary" disabled={!keyed.length || !!errors.size} onClick={() => setModal('export')}><Download size={16}/>{t('export')}</button></div></section>
      <section className="overview"><div className="stat"><span className="stat-icon"><Braces size={20}/></span><div><strong>{keyed.length.toString().padStart(2, '0')}</strong><span>{t('keys')}</span></div></div><div className="stat"><span className="stat-icon"><Globe2 size={20}/></span><div><strong>{selected.length.toString().padStart(2, '0')}</strong><span>{t('languages')}</span></div></div><div className="progress-stat"><div><strong>{progress}% <span>{t('complete')}</span></strong><span>{total - filled} {t('pending')}</span></div><div className="progress-track"><span style={{ width: `${progress}%` }}/></div></div><button className={`ai-switch ${ai ? 'enabled' : ''}`} onClick={() => setAi(!ai)} aria-pressed={ai}><Sparkles size={17}/>{t(ai ? 'aiOn' : 'aiOff')}<span className="switch-track"><span/></span></button></section>
      <section className="editor-card"><div className="language-toolbar"><div className="language-chips">{selected.map(code => <div className={`language-chip ${code === base ? 'base' : ''}`} key={code}><span className="lang-code">{code.toUpperCase()}</span><span>{langName(code)}</span>{code === base ? <small>{t('baseLabel')}</small> : <button aria-label={`${t('removeLanguage')} ${langName(code)}`} onClick={() => removeLanguage(code)}><X size={13}/></button>}</div>)}</div><select className="add-language" aria-label={t('addLanguage')} value="" onChange={event => { if (event.target.value) setSelected(previous => [...previous, event.target.value]); }} disabled={selected.length === languages.length}><option value="">+ {t('addLanguage')}</option>{languages.filter(lang => !selected.includes(lang.code)).map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}</select></div>
        <div className="filter-toolbar"><label className="search-field"><Search size={17}/><input aria-label={t('search')} placeholder={t('search')} value={query} onChange={event => setQuery(event.target.value)}/></label><select aria-label={t('all')} value={filter} onChange={event => setFilter(event.target.value)}>{(['all', 'missing', 'suggestions'] as const).map(item => <option key={item} value={item}>{t(item)}</option>)}</select>{ai && (pendingSources.length > 0 || busy) && <button className="button subtle" disabled={busy} title={t('batchHelp')} onClick={() => void suggest()}><Sparkles size={15}/>{t(busy ? 'generating' : 'suggestBatch')}</button>}</div>
        <div className="table-scroll"><table><thead><tr><th className="row-number">#</th><th>{t('key')}<span className="muted"> / path</span></th>{selected.map(code => <th key={code}>{langName(code)} {code === base && <small>{t('baseLabel')}</small>}</th>)}<th><span className="sr-only">{t('remove')}</span></th></tr></thead><tbody>{visible.map((entry, index) => <tr key={entry.id} className={errors.has(entry.id) ? 'invalid-row' : ''}><td className="row-number">{String(index + 1).padStart(2, '0')}</td><td className="key-cell"><input id={`key-${entry.id}`} aria-label={`${t('key')} ${index + 1}`} className="key-input" value={entry.key} maxLength={300} placeholder={t('keyPlaceholder')} onChange={event => updateEntry(entry.id, { key: event.target.value })} onKeyDown={event => onCellKey(event, false)}/>{errors.has(entry.id) && <span className="field-error">{t(errors.get(entry.id) as MessageKey)}</span>}</td>{selected.map((code, langIndex) => { const item = validSuggestion(entry, code); const missing = !entry.values[code]?.trim(); const missingId = `missing-${entry.id}-${code}`; const mismatch = code !== base && entry.values[code] && entry.values[base] && !tokensMatch(entry.values[base], entry.values[code]); return <td key={code} className="value-cell"><textarea id={`value-${entry.id}-${code}`} rows={2} className={missing ? 'value-missing' : undefined} aria-invalid={missing || undefined} aria-describedby={missing ? missingId : undefined} aria-label={`${langName(code)} ${entry.key || index + 1}`} placeholder={t(missing ? 'valueMissing' : 'valuePlaceholder')} value={entry.values[code] || ''} onChange={event => setValue(entry, code, event.target.value)} onKeyDown={event => onCellKey(event, langIndex === selected.length - 1 && index === visible.length - 1)}/>{missing && <span id={missingId} className="field-error">{t('valueMissing')}</span>}{mismatch && <span className="field-error">{t('tokenLabel')}</span>}{item && <div className="suggestion"><span><Sparkles size={12}/>{t('suggestion')}</span><p>{item.text}</p><div><button onClick={() => dismissSuggestion(entry, code, true)}><Check size={13}/>{t('accept')}</button><button onClick={() => dismissSuggestion(entry, code, false)}><X size={13}/>{t('reject')}</button></div></div>}</td>; })}<td><button className="icon-button delete-button" aria-label={`${t('remove')} ${entry.key}`} onClick={() => { setEntries(previous => previous.filter(item => item.id !== entry.id)); setSuggestions(previous => { const next = { ...previous }; delete next[entry.id]; return next; }); }}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>
        {!entries.length ? <div className="empty-state"><div className="empty-art"><div className="floating-code">{'{ }'}</div><Globe2 size={47} strokeWidth={1.25}/><div className="floating-lang">Aa</div></div><h2>{t('emptyTitle')}</h2><p>{t('emptyText')}</p><button className="button primary" onClick={addEntry}><Plus size={16}/>{t('addKey')}</button></div> : !visible.length ? <div className="no-matches">{t('noMatches')}</div> : null}
        {entries.length > 0 && <button className="add-row" onClick={addEntry}><Plus size={17}/>{t('addKey')}</button>}<div className="editor-footer"><span><kbd>↵</kbd> {t('keyboard')}</span><span>{visible.length} {t('keys')}</span></div>
      </section>
      <div className="json-panel"><section className="preview-card">{preview}</section></div>
    </> : <>
      <section className="page-heading"><div><div className="eyebrow"><span/> WORKSPACE</div><h1>{t('settings')}</h1><p>{t('settingsText')}</p></div></section><div className="settings-grid"><section className="settings-card"><h2><Globe2 size={19}/>{t('interface')}</h2><label>{t('interface')}<select value={locale} onChange={event => setLocale(event.target.value as Locale)}>{languages.slice(0, 3).map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}</select></label><label>{t('appearance')}<div className="theme-options"><button className={theme === 'light' ? 'button selected' : 'button'} onClick={() => setTheme('light')}><Sun size={17}/>{t('light')}</button><button className={theme === 'dark' ? 'button selected' : 'button'} onClick={() => setTheme('dark')}><Moon size={17}/>{t('dark')}</button></div></label><p className="help-text">{t('sessionHelp')}</p></section>
      <section className="settings-card"><div className="section-heading"><h2><Sparkles size={19}/>{t('ai')}</h2><input type="checkbox" aria-label={t('ai')} checked={ai} onChange={event => setAi(event.target.checked)}/></div><p>{t('aiHelp')}</p><label>{t('provider')}<select value={provider} onChange={event => { const next = event.target.value as Provider; setAiSettings({ provider: next, model: providers[next].model, apikey: '' }); }}>{Object.entries(providers).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}</select></label><label>{t('model')}<input value={model} maxLength={120} onChange={event => setAiSettings(previous => ({ ...previous, model: event.target.value }))}/></label><label>{t('apiKey')}<input type="password" autoComplete="off" spellCheck={false} value={apikey} maxLength={4096} placeholder={t('apiPlaceholder')} onChange={event => setAiSettings(previous => ({ ...previous, apikey: event.target.value }))}/></label></section>
      </div>
    </>}</div></main>
    {modal === 'import' && <Modal title={t('importTitle')} closeLabel={t('close')} onClose={() => setModal(null)}><p>{t('importText')}</p><label>{t('importLanguage')}<select value={importLang} onChange={event => setImportLang(event.target.value)}>{languages.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}</select></label><label className="file-picker"><Upload size={22}/>{t('file')}<input type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) { setImportText(''); setImportError(t('fileSize')); return; } void file.text().then(text => { setImportText(text); setImportError(''); }).catch(() => setImportError(t('importError'))); }}/></label><label>{t('paste')}<textarea className="import-text" value={importText} onChange={event => { setImportText(event.target.value); setImportError(''); }} placeholder={'{ "example": "Exemplo" }'}/></label><label>{t('conflictMode')}<select value={overwrite ? 'overwrite' : 'keep'} onChange={event => setOverwrite(event.target.value === 'overwrite')}><option value="keep">{t('keep')}</option><option value="overwrite">{t('overwrite')}</option></select></label>{importError && <p className="inline-error" role="alert">{importError}</p>}<div className="modal-actions"><button className="button" onClick={() => setModal(null)}>{t('cancel')}</button><button className="button primary" disabled={!importText.trim()} onClick={importJson}><Upload size={15}/>{t('merge')}</button></div></Modal>}
    {modal === 'export' && <Modal title={t('export')} closeLabel={t('close')} onClose={() => setModal(null)}><p>{t('exportText')}</p><section className="preview-card">{preview}</section><p className="help-text">{t('exportEmpty')}</p><div className="modal-actions"><button className="button primary" onClick={downloadAll}><Download size={16}/>{t('zip')}</button></div></Modal>}
    {modal === 'clear' && <Modal title={t('clear')} closeLabel={t('close')} onClose={() => setModal(null)}><p>{t('clearConfirm')}</p><div className="modal-actions"><button className="button" onClick={() => setModal(null)}>{t('cancel')}</button><button className="button danger" onClick={() => { controller.current?.abort(); setEntries([]); setSuggestions({}); setQuery(''); setFilter('all'); setImportText(''); setModal(null); }}>{t('yesClear')}</button></div></Modal>}
    {notice && <div className="toast" role="status"><FileJson size={18}/><span>{notice}</span><button aria-label={t('close')} onClick={() => setNotice('')}><X size={16}/></button></div>}
  </div>;
}
