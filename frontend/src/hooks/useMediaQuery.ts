import { useEffect, useState } from 'react';

/** True while the media query matches. Without `matchMedia` (tests, old browsers) it answers `fallback`. */
export function useMediaQuery(query: string, fallback = true): boolean {
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const [matches, setMatches] = useState(() => (supported ? window.matchMedia(query).matches : fallback));

  useEffect(() => {
    if (!supported) return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query, supported]);

  return matches;
}
