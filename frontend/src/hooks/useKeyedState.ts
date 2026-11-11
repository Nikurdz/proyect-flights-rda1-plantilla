import { useCallback, useState } from 'react';

/**
 * State that belongs to one `key`: when the key changes the value goes back to `initial` in the same
 * render, without an effect that resets it afterwards (and without a stale frame in between).
 * A value set under an old key (e.g. by a request that finished after the key changed) is ignored.
 */
export function useKeyedState<T>(key: string, initial: T): readonly [T, (next: T) => void] {
  const [state, setState] = useState<{ key: string; value: T }>({ key, value: initial });
  const value = state.key === key ? state.value : initial;
  const set = useCallback((next: T) => setState({ key, value: next }), [key]);
  return [value, set] as const;
}
