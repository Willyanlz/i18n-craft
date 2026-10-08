import type { Dispatch, SetStateAction } from 'react';
import { Upload } from 'lucide-react';
import { languages } from '../core';
import type { Locale } from '../i18n';
import type { ModalName, Translate } from '../types';

import { LangPicker } from './LangPicker';
import { Modal } from './Modal';
type Props = {
  t: Translate;
  locale: Locale;
  setModal: Dispatch<SetStateAction<ModalName>>;
  importLang: string;
  setImportLang: Dispatch<SetStateAction<string>>;
  setImportText: Dispatch<SetStateAction<string>>;
  setImportError: Dispatch<SetStateAction<string>>;
  importText: string;
  overwrite: boolean;
  setOverwrite: Dispatch<SetStateAction<boolean>>;
  importError: string;
  importJson: () => void;
};
export function ImportDialog({
  t,
  locale,
  setModal,
  importLang,
  setImportLang,
  setImportText,
  setImportError,
  importText,
  overwrite,
  setOverwrite,
  importError,
  importJson,
}: Props) {
  return (
    <Modal title={t('importTitle')} closeLabel={t('close')} onClose={() => setModal(null)}>
      <p>{t('importText')}</p>
      <label>
        {t('importLanguage')}
        <LangPicker
          label={t('importLanguage')}
          value={importLang}
          options={languages.map((lang) => lang.code)}
          onPick={setImportLang}
          locale={locale}
        />
      </label>
      <label className="file-picker">
        <Upload size={22} />
        {t('file')}
        <input
          type="file"
          accept=".json,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
              setImportText('');
              setImportError(t('fileSize'));
              return;
            }
            void file
              .text()
              .then((text) => {
                setImportText(text);
                setImportError('');
              })
              .catch(() => setImportError(t('importError')));
          }}
        />
      </label>
      <label>
        {t('paste')}
        <textarea
          className="import-text"
          value={importText}
          onChange={(event) => {
            setImportText(event.target.value);
            setImportError('');
          }}
          placeholder={'{ "example": "Exemplo" }'}
        />
      </label>
      <label>
        {t('conflictMode')}
        <select
          value={overwrite ? 'overwrite' : 'keep'}
          onChange={(event) => setOverwrite(event.target.value === 'overwrite')}
        >
          <option value="keep">{t('keep')}</option>
          <option value="overwrite">{t('overwrite')}</option>
        </select>
      </label>
      {importError && (
        <p className="inline-error" role="alert">
          {importError}
        </p>
      )}
      <div className="modal-actions">
        <button className="button" onClick={() => setModal(null)}>
          {t('cancel')}
        </button>
        <button className="button primary" disabled={!importText.trim()} onClick={importJson}>
          <Upload size={15} />
          {t('merge')}
        </button>
      </div>
    </Modal>
  );
}
