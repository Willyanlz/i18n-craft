import { Check, ChevronDown, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { langName } from '../core';
import { flagFor } from '../flags';

export function LangPicker({
  label,
  value,
  options,
  onPick,
  disabled,
  add = false,
}: {
  label: string;
  value: string;
  options: string[];
  onPick: (code: string) => void;
  disabled?: boolean;
  add?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const keys = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', keys);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', keys);
    };
  }, [open]);
  return (
    <div className="lang-picker" ref={box}>
      <button
        className="lang-picker-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((was) => !was)}
      >
        <>
          {add ? (
            <Plus size={15} />
          ) : (
            <img className="lang-flag" src={flagFor(value)} alt="" aria-hidden="true" />
          )}
          <span>{add ? label : langName(value)}</span>
        </>
        <ChevronDown size={14} />
      </button>
      {open && (
        <ul className="lang-picker-list" role="listbox" aria-label={label}>
          {options.map((code) => (
            <li key={code}>
              <button
                role="option"
                aria-selected={code === value}
                className={code === value ? 'selected' : ''}
                onClick={() => {
                  onPick(code);
                  setOpen(false);
                }}
              >
                <img className="lang-flag" src={flagFor(code)} alt="" aria-hidden="true" />
                <span>{langName(code)}</span>
                {code === value && <Check size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
