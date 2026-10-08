import type { Dispatch, SetStateAction } from 'react';
import { Braces, Clipboard, Code2, Download } from 'lucide-react';
import { useMemo } from 'react';
import type { Translate } from '../types';
import { langName } from '../core';

import { JsonTree } from './JsonTree';
type Props = {
  previewMode: 'tree' | 'json';
  setPreviewMode: Dispatch<SetStateAction<'tree' | 'json'>>;
  t: Translate;
  previewLang: string;
  setPreviewLang: Dispatch<SetStateAction<string>>;
  languages?: string[];
  errors: Map<string, string>;
  json: string;
  copyJson: () => Promise<void>;
  download: (content: BlobPart, filename: string, type: string) => void;
};
export function JsonPreview({
  previewMode,
  setPreviewMode,
  t,
  previewLang,
  setPreviewLang,
  languages,
  errors,
  json,
  copyJson,
  download,
}: Props) {
  // Memoized tree parse: collapsed <details> nodes already cut DOM cost, and
  // this avoids re-parsing a ~200KB string on every keystroke.
  const treeValue = useMemo<Record<string, unknown> | null>(() => {
    if (errors.size || previewMode !== 'tree') return null;
    try {
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [json, errors.size, previewMode]);
  return (
    <>
      <div className="preview-tabs">
        <div className="segmented">
          <button
            className={previewMode === 'json' ? 'active' : ''}
            onClick={() => setPreviewMode('json')}
          >
            <Code2 size={15} />
            {t('preview')}
          </button>
          <button
            className={previewMode === 'tree' ? 'active' : ''}
            onClick={() => setPreviewMode('tree')}
          >
            <Braces size={15} />
            {t('tree')}
          </button>
        </div>
        {languages && (
          <select
            aria-label={t('importLanguage')}
            value={previewLang}
            onChange={(event) => setPreviewLang(event.target.value)}
          >
            {languages.map((code) => (
              <option key={code} value={code}>
                {langName(code)} ({code}.json)
              </option>
            ))}
          </select>
        )}
      </div>
      {errors.size ? (
        <p className="inline-error">{t('invalidExport')}</p>
      ) : previewMode === 'json' ? (
        <pre className="code-preview">
          <code>{json}</code>
        </pre>
      ) : treeValue ? (
        <div className="tree-container">
          <JsonTree value={treeValue} />
        </div>
      ) : (
        <div className="tree-container">
          <JsonTree value={{}} />
        </div>
      )}
      <div className="preview-footer">
        <span>
          <span className="status-dot" /> JSON
        </span>
        <button onClick={() => void copyJson()} disabled={!!errors.size}>
          <Clipboard size={15} />
          {t('copy')}
        </button>
        <button
          onClick={() => download(json, `${previewLang}.json`, 'application/json')}
          disabled={!!errors.size}
        >
          <Download size={15} />
          {t('download')}
        </button>
      </div>
    </>
  );
}
