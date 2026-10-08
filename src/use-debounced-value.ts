import { useEffect, useState } from 'react';

// Debounces a value with a fixed delay. Returns the latest value immediately
// for controlled inputs to stay responsive while heavy consumers (session
// save, JSON preview) use the debounced copy. The delay only affects large
// projects; small projects update within the same window.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
