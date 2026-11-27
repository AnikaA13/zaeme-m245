import { useCallback, useEffect, useState } from 'react';
import { refresh } from '../auth/session';
import { inventoryScope, isCurrent, type Scope } from './read';
import { today } from './domain';

export function invalidateInventory() {
  window.dispatchEvent(new Event('zaeme-inventory'));
}
export function useResource<T>(
  key: string,
  loader: (scope: Scope) => Promise<T>,
) {
  const s = inventoryScope();
  const [attempt, retry] = useState(0);
  const again = useCallback(() => retry((n) => n + 1), []);
  const [state, setState] = useState<{
    key: string;
    signal: AbortSignal;
    data?: T;
    error?: boolean;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    const scope = inventoryScope(controller.signal);
    async function run() {
      if (!navigator.onLine) return;
      try {
        const data = await loader(scope);
        if (isCurrent(scope)) setState({ key, signal: scope.signal, data });
      } catch {
        if (isCurrent(scope) && navigator.onLine)
          setState({ key, signal: scope.signal, error: true });
      }
    }
    void run();
    return () => {
      controller.abort();
    };
  }, [s.signal, key, loader, attempt]);
  useEffect(() => {
    let live = true;
    const revalidate = async () => {
      if (!navigator.onLine) return;
      await refresh();
      if (live && !s.signal.aborted) again();
    };
    window.addEventListener('focus', revalidate);
    window.addEventListener('online', revalidate);
    window.addEventListener('zaeme-inventory', again);
    return () => {
      live = false;
      window.removeEventListener('focus', revalidate);
      window.removeEventListener('online', revalidate);
      window.removeEventListener('zaeme-inventory', again);
    };
  }, [again, s.signal]);
  return {
    ...(state?.key === key && state.signal === s.signal ? state : {}),
    again,
  };
}
export function useToday() {
  const [day, setDay] = useState(today);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function schedule() {
      clearTimeout(timer);
      const now = Date.now(),
        date = today(new Date(now));
      setDay(date);
      let lo = now,
        hi = now + 26 * 3600000;
      while (hi - lo > 1) {
        const mid = Math.floor((hi + lo) / 2);
        if (today(new Date(mid)) === date) lo = mid;
        else hi = mid;
      }
      timer = setTimeout(schedule, hi - now + 5);
    }
    schedule();
    window.addEventListener('focus', schedule);
    window.addEventListener('online', schedule);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', schedule);
      window.removeEventListener('online', schedule);
    };
  }, []);
  return day;
}
