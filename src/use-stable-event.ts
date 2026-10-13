import { useCallback, useLayoutEffect, useRef } from 'react';

// Stable identity for memoized rows, with the latest committed state.
export function useStableEvent<A extends unknown[], R>(callback: (...args: A) => R) {
  const ref = useRef(callback);
  useLayoutEffect(() => {
    ref.current = callback;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}
