import type { Session } from '@supabase/supabase-js';
import { backend, client, storageKey } from '../../lib/supabase/client';
import { Operations } from '../../lib/operations/protocol';
import { loadAccount, type Account } from '../household/load';
import { captureEntry, intent } from './intent';

type Snapshot = {
  phase: 'initial' | 'guest' | 'loading' | 'ready' | 'error' | 'config';
  user: string | null;
  account: Account | null;
  recovery: boolean;
  callbackError: boolean;
  notice: string;
  epoch: number;
  inviteRevision: number;
};
let state: Snapshot = {
  phase: 'initial',
  user: null,
  account: null,
  recovery: false,
  callbackError: false,
  notice: '',
  epoch: 0,
  inviteRevision: 0,
};
const listeners = new Set<() => void>();
export const snapshot = () => state;
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function update(change: Partial<Snapshot>) {
  state = { ...state, ...change };
  for (const fn of listeners) fn();
}
let session: Session | null = null;
let reads = new AbortController();
let scope = new AbortController();
let flight: Promise<void> | null = null;
let generation: string | null = null;
let loggingOut = false;
let recoveryUser: string | null = null;
export const operations = new Operations();
function invalidate() {
  scope.abort();
  scope = new AbortController();
  operations.clear();
}
function clear() {
  reads.abort();
  reads = new AbortController();
  flight = null;
  generation = null;
  invalidate();
}
export function activeScope() {
  return {
    signal: scope.signal,
    user: state.user,
    email: session?.user.email,
    epoch: state.epoch,
    jwt: session?.access_token,
  };
}
export function refresh(afterWrite = false): Promise<void> {
  if (!session || loggingOut) return Promise.resolve();
  if (flight) {
    const waiting = flight;
    return afterWrite ? waiting.then(() => refresh()) : waiting;
  }
  const user = session.user.id,
    controller = reads;
  const work = async () => {
    try {
      const account = await loadAccount(
        user,
        AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
      );
      if (controller.signal.aborted || state.user !== user) return;
      const next = account.home?.g ?? null;
      const lost = !!generation && !next;
      if (next !== generation) {
        invalidate();
        generation = next;
        if (next || lost) intent.clear();
      }
      update({
        account,
        phase: 'ready',
        ...(lost ? { notice: 'Deine Mitgliedschaft ist beendet.' } : {}),
      });
    } catch {
      if (!controller.signal.aborted) {
        update({ account: null, phase: 'error' });
      }
    }
  };
  const pending = work().finally(() => {
    if (flight === pending) flight = null;
  });
  flight = pending;
  return pending;
}
function accept(next: Session | null) {
  if (loggingOut) return;
  const id = next?.user.email_confirmed_at ? next.user.id : null;
  if (state.user === id && state.phase !== 'initial') {
    session = id ? next : null;
    return;
  }
  const previous = state.user;
  clear();
  if (previous && previous !== id) intent.clear();
  session = id ? next : null;
  if (id) intent.bind(id, next?.user.email);
  if (recoveryUser !== id) recoveryUser = null;
  const localOnly = !id && sessionStorage.getItem('zaeme-local-logout') === '1';
  sessionStorage.removeItem('zaeme-local-logout');
  const notice = localOnly
    ? 'Auf diesem Gerät abgemeldet. Die Abmeldung beim Server konnte nicht bestätigt werden.'
    : previous && !id
      ? 'Deine Sitzung wurde beendet.'
      : '';
  update({
    user: id,
    epoch: state.epoch + 1,
    phase: id ? 'loading' : 'guest',
    account: null,
    recovery: !!id && recoveryUser === id,
    notice,
  });
  if (id)
    setTimeout(() => {
      if (state.user === id) void refresh();
    }, 0);
}
export function completeRecovery() {
  recoveryUser = null;
  update({ recovery: false, notice: 'Dein neues Passwort ist gespeichert.' });
}
export function dismissCallback() {
  update({ callbackError: false });
}
export function announce(notice: string) {
  update({ notice });
}
export async function logout() {
  if (loggingOut) return;
  loggingOut = true;
  clear();
  intent.clear();
  session = null;
  recoveryUser = null;
  update({
    user: null,
    account: null,
    recovery: false,
    phase: 'initial',
    epoch: state.epoch + 1,
    notice: '',
  });
  let resetClient = false;
  try {
    const { error } = await backend().auth.signOut({ scope: 'local' });
    if (error) throw error;
    update({ phase: 'guest', notice: 'Du bist auf diesem Gerät abgemeldet.' });
  } catch {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(storageKey + '-code-verifier');
    localStorage.removeItem(storageKey + '-user');
    resetClient = true;
    sessionStorage.setItem('zaeme-local-logout', '1');
    update({
      phase: 'guest',
      notice:
        'Auf diesem Gerät abgemeldet. Die Abmeldung beim Server konnte nicht bestätigt werden.',
    });
    const restart = () => location.replace('/welcome');
    if (navigator.onLine) restart();
    else window.addEventListener('online', restart, { once: true });
  } finally {
    loggingOut = resetClient;
  }
}
export async function startSession() {
  const url = new URL(location.href),
    callback = captureEntry(url);
  if ((callback || url.pathname === '/join') && (url.hash || url.search))
    history.replaceState(null, '', url.pathname);
  if (!client) {
    update({ phase: 'config' });
    return;
  }
  if (callback) {
    intent.restore();
    try {
      if (!callback.code) throw new Error();
      const { data, error } = await client.auth.exchangeCodeForSession(
        callback.code,
      );
      if (error || !data.session) throw new Error();
      if (callback.recovery) {
        if (!('redirectType' in data) || data.redirectType !== 'recovery')
          throw new Error();
        recoveryUser = data.session.user.id;
      } else if ('redirectType' in data && data.redirectType === 'recovery')
        throw new Error();
      accept(data.session);
    } catch {
      intent.clear();
      update({ callbackError: true });
    }
  }
  const { data } = client.auth.onAuthStateChange((_event, s) => accept(s));
  const reload = () => {
    if (document.visibilityState === 'visible') void refresh();
  };
  const timer = window.setInterval(reload, 30000);
  const captureFragment = () => {
    const url = new URL(location.href);
    if (url.pathname !== '/join' || !url.hash) return;
    captureEntry(url);
    history.replaceState(history.state, '', url.pathname);
    if (session) intent.bind(session.user.id, session.user.email);
    update({ inviteRevision: state.inviteRevision + 1 });
  };
  window.addEventListener('hashchange', captureFragment);
  window.addEventListener('focus', reload);
  window.addEventListener('online', reload);
  document.addEventListener('visibilitychange', reload);
  return () => {
    clearInterval(timer);
    window.removeEventListener('hashchange', captureFragment);
    data.subscription.unsubscribe();
    window.removeEventListener('focus', reload);
    window.removeEventListener('online', reload);
    document.removeEventListener('visibilitychange', reload);
    clear();
  };
}
