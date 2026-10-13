import { memo } from 'react';
import { Check, Sparkles, Trash2, X } from 'lucide-react';
import { langName, tokensMatch, valueType, type Entry } from '../core';
import { editKey, isNestedKey, keyLabel } from '../json-format';
import { flagFor } from '../flags';
import type { MessageKey } from '../i18n';
import type { Suggestion } from '../types';
import type { EditorProps } from './TranslationEditor';

type Props = Pick<
  EditorProps,
  | 't'
  | 'active'
  | 'base'
  | 'updateEntry'
  | 'onCellKey'
  | 'setValue'
  | 'dismissSuggestion'
  | 'setEntries'
  | 'setSuggestions'
  | 'onEditingChange'
> & {
  entry: Entry;
  index: number;
  pageStart: number;
  last: boolean;
  item: Suggestion | undefined;
  error: string | undefined;
  valuesCollapsed: boolean;
};
export const TranslationRow = memo(function TranslationRow({
  entry,
  index,
  pageStart,
  last,
  item,
  error,
  valuesCollapsed,
  t,
  active,
  base,
  updateEntry,
  onCellKey,
  setValue,
  dismissSuggestion,
  setEntries,
  setSuggestions,
  onEditingChange,
}: Props) {
  const missing = !entry.values[active]?.trim();
  const missingId = `missing-${entry.id}-${active}`;
  const baseText = active === base ? '' : entry.values[base] || '';
  const mismatch =
    active !== base &&
    entry.values[active] &&
    entry.values[base] &&
    !tokensMatch(entry.values[base], entry.values[active]);
  return (
    <tr
      onFocus={() => onEditingChange(entry.id)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          onEditingChange(null);
      }}
      className={!!error ? 'invalid-row' : ''}
    >
      <td className="row-number">{String(pageStart + index + 1).padStart(2, '0')}</td>
      <td className="key-cell">
        <input
          id={`key-${entry.id}`}
          aria-label={`${t('key')} ${pageStart + index + 1}`}
          className="key-input"
          value={keyLabel(entry)}
          placeholder={t('keyPlaceholder')}
          onChange={(event) =>
            updateEntry(entry.id, editKey(event.target.value, isNestedKey(entry)))
          }
          onKeyDown={(event) => onCellKey(event, false)}
        />
        <label className="nesting-toggle" title={t('nestingHelp')}>
          <input
            type="checkbox"
            checked={isNestedKey(entry)}
            aria-label={`${t('nesting')} ${pageStart + index + 1}`}
            onChange={(event) =>
              updateEntry(entry.id, editKey(keyLabel(entry), event.target.checked))
            }
          />
          {t('nesting')}
        </label>
        {!!error && <span className="field-error">{t(error as MessageKey)}</span>}
      </td>
      <td className="value-cell">
        {valueType(entry, active) !== 'string' && (
          <span className="muted">{valueType(entry, active)}</span>
        )}
        {valuesCollapsed ? (
          <span className="value-collapsed">
            {entry.values[active]?.trim() || t('fillMissing')}
          </span>
        ) : (
          <>
            <textarea
              id={`value-${entry.id}-${active}`}
              rows={2}
              className={missing ? 'value-missing' : undefined}
              aria-invalid={missing || undefined}
              aria-describedby={missing ? missingId : undefined}
              aria-label={`${langName(active)}: ${entry.key || index + 1}`}
              placeholder={t('fillMissing')}
              value={entry.values[active] || ''}
              onChange={(event) => setValue(entry, active, event.target.value)}
              onKeyDown={(event) => onCellKey(event, last)}
            />
            {baseText ? (
              <span className="base-reference">
                <img className="lang-flag" src={flagFor(base)} alt="" aria-hidden="true" />
                <span className="sr-only">{`${langName(base)}: `}</span>
                <span className="base-reference-text">{baseText}</span>
              </span>
            ) : null}
          </>
        )}
        {missing && (
          <span id={missingId} className="sr-only">
            {t('valueMissing')}
          </span>
        )}
        {mismatch && <span className="field-error">{t('tokenLabel')}</span>}
        {item && (
          <div className="suggestion">
            <span>
              <Sparkles size={12} />
              {t('suggestion')}
            </span>
            <p>{item.text}</p>
            <div>
              <button onClick={() => dismissSuggestion(entry, active, true)}>
                <Check size={13} />
                {t('accept')}
              </button>
              <button onClick={() => dismissSuggestion(entry, active, false)}>
                <X size={13} />
                {t('reject')}
              </button>
            </div>
          </div>
        )}
      </td>
      <td>
        <button
          className="icon-button delete-button"
          aria-label={`${t('remove')} ${entry.key}`}
          onClick={() => {
            setEntries((previous) => previous.filter((item) => item.id !== entry.id));
            setSuggestions((previous) => {
              const next = { ...previous };
              delete next[entry.id];
              return next;
            });
          }}
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
});
