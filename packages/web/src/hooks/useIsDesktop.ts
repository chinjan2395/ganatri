import { useState, useEffect } from 'react';

export function useIsDesktop(): boolean {
  const [v, setV] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const handler = (e: MediaQueryListEvent): void => setV(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return v;
}
