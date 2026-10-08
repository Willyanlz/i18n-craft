import { ArrowDown, ArrowUp } from 'lucide-react';
import type { Translate } from '../types';

export function ScrollControls({ t }: { t: Translate }) {
  const scroll = (toBottom: boolean) => {
    window.scrollTo({
      top: toBottom ? document.documentElement.scrollHeight : 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  };

  return (
    <div className="scroll-controls">
      <button
        type="button"
        aria-label={t('scrollTop')}
        title={t('scrollTop')}
        onClick={() => scroll(false)}
      >
        <ArrowUp size={20} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={t('scrollBottom')}
        title={t('scrollBottom')}
        onClick={() => scroll(true)}
      >
        <ArrowDown size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
