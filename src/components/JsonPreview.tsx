import type { Dispatch, SetStateAction } from 'react';
import { Braces, Clipboard, Code2, Download } from 'lucide-react';
import type { Translate } from '../types';

import { JsonTree } from './JsonTree';
type Props = {
  previewMode: 'tree' | 'json';
  setPreviewMode: Dispatch<SetStateAction<'tree' | 'json'>>;
  t: Translate;
  previewLang: string;
  setPreviewLang: Dispatch<SetStateAction<string>>;
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
  errors,
  json,
  copyJson,
  download,
}: Props) {
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
      </div>
      {errors.size ? (
        <p className="inline-error">{t('invalidExport')}</p>
      ) : previewMode === 'json' ? (
        <pre className="code-preview">
          <code>{json}</code>
        </pre>
      ) : (
        <div className="tree-container">
          <JsonTree value={JSON.parse(json)} />
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
