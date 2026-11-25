import { afterEach, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import type { Account } from '../household/load';

const mocks = vi.hoisted(() => ({
  listen: vi.fn(),
  load: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('../../lib/supabase/client', () => {
  const client = {
    auth: { onAuthStateChange: mocks.listen, signOut: mocks.signOut },
  };
  return { client, backend: () => client, storageKey: 'unit-auth' };
});
vi.mock('../household/load', () => ({ loadAccount: mocks.load }));
let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  vi.useRealTimers();
  vi.resetModules();
  vi.clearAllMocks();
  sessionStorage.clear();
});
function session(id: string, confirmed = true) {
  return {
    user: {
      id,
      email_confirmed_at: confirmed ? '2026-11-25' : null,
      email: id + '@example.invalid',
    },
    access_token: 'fixture',
  } as Session;
}
const profile = (display_name: string) => ({ display_name, version: 1 });
async function start() {
  vi.useFakeTimers();
  let emit!: (event: string, s: Session | null) => void;
  mocks.listen.mockImplementation((fn) => {
    emit = fn;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  const store = await import('./session');
  stop = await store.startSession();
  return { store, emit: (s: Session | null) => emit('SIGNED_IN', s) };
}
it('hält private Daten bis zur bestätigten Sitzung und erfolgreichen Antwort zurück', async () => {
  const { store, emit } = await start();
  expect(store.snapshot().phase).toBe('initial');
  emit(session('a', false));
  expect(store.snapshot().phase).toBe('guest');
  mocks.load.mockRejectedValueOnce(new Error());
  emit(session('a'));
  expect(store.snapshot().account).toBeNull();
  await vi.advanceTimersByTimeAsync(0);
  expect(store.snapshot().phase).toBe('error');
  mocks.load.mockResolvedValueOnce({ profile: null, home: null });
  await store.refresh();
  expect(store.snapshot().phase).toBe('ready');
  expect(store.snapshot().account?.profile).toBeNull();
});
it('verwirft die verspätete Antwort der vorherigen Identität', async () => {
  const { store, emit } = await start();
  let resolve!: (v: Account) => void;
  mocks.load.mockReturnValueOnce(
    new Promise<Account>((r) => {
      resolve = r;
    }),
  );
  emit(session('a'));
  await vi.advanceTimersByTimeAsync(0);
  const scope = store.activeScope();
  mocks.load.mockResolvedValueOnce({ profile: profile('B'), home: null });
  emit(session('b'));
  expect(scope.signal.aborted).toBe(true);
  expect(store.snapshot().account).toBeNull();
  await vi.advanceTimersByTimeAsync(0);
  resolve({ profile: profile('A'), home: null });
  await vi.advanceTimersByTimeAsync(0);
  expect(store.snapshot().account?.profile?.display_name).toBe('B');
});
it('widerruft alte Operationskontexte bei Generationenwechsel, Entzug und Logout', async () => {
  const { store, emit } = await start();
  mocks.load.mockResolvedValueOnce({
    profile: profile('A'),
    home: { g: 'g1' },
  });
  emit(session('a'));
  await vi.advanceTimersByTimeAsync(0);
  const first = store.activeScope();
  mocks.load.mockResolvedValueOnce({
    profile: profile('A'),
    home: { g: 'g2' },
  });
  await store.refresh();
  expect(first.signal.aborted).toBe(true);
  const second = store.activeScope();
  mocks.load.mockResolvedValueOnce({ profile: profile('A'), home: null });
  await store.refresh();
  expect(second.signal.aborted).toBe(true);
  expect(store.snapshot().notice).toContain('Mitgliedschaft');
  mocks.signOut.mockResolvedValueOnce({ error: null });
  await store.logout();
  expect(store.snapshot().phase).toBe('guest');
  expect(store.snapshot().account).toBeNull();
});
