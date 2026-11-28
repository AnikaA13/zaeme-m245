import { useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { backend } from '../../lib/supabase/client';
import { activeScope, refresh } from '../auth/session';
import { inventoryScope, isCurrent } from '../inventory/read';
import { invalidateInventory } from '../inventory/resource';
import { readRevision, synchronizedScopes } from './revision';

let removing: Promise<unknown> = Promise.resolve();

export function HouseholdSync() {
  const identity = activeScope().signal;
  const [status, setStatus] = useState('Synchronisation wird aufgebaut …');
  const [checkedAt, setCheckedAt] = useState<Date>();
  useEffect(() => {
    if (!activeScope().jwt || !activeScope().household) return;
    const db = backend(),
      controller = new AbortController();
    const scope = inventoryScope(controller.signal);
    synchronizedScopes.add(identity);
    let channel: RealtimeChannel | undefined, revision: bigint | undefined;
    let timer: ReturnType<typeof setTimeout>,
      reconnect: ReturnType<typeof setTimeout>;
    let busy = false,
      pending = false,
      force = false,
      delay = 300,
      connection = 0;
    let subscribed = false;
    const live = () => isCurrent(scope);
    function schedule(all = false) {
      if (!live() || !navigator.onLine) return;
      force ||= all;
      if (pending) return;
      pending = true;
      if (!busy) timer = setTimeout(run, 45);
    }
    async function run() {
      if (!live() || !navigator.onLine) {
        pending = false;
        return;
      }
      pending = false;
      busy = true;
      const full = force;
      force = false;
      try {
        await refresh(true);
        if (!live()) return;
        const current = await readRevision(inventoryScope(controller.signal));
        if (!live()) return;
        if (full || current !== revision) invalidateInventory();
        revision = current;
        setCheckedAt(new Date());
        if (subscribed) setStatus('');
      } catch {
        if (live()) {
          setStatus(
            'Abgleich ausstehend. Angezeigte Daten können veraltet sein.',
          );
          clearTimeout(timer);
          timer = setTimeout(() => schedule(true), 1500);
        }
      } finally {
        busy = false;
        if (pending && live()) timer = setTimeout(run, 45);
      }
    }
    function detach() {
      connection++;
      subscribed = false;
      if (channel) {
        removing = db.removeChannel(channel).catch(() => undefined);
        channel = undefined;
      }
    }
    function retry() {
      if (!live()) return;
      detach();
      clearTimeout(reconnect);
      setStatus(
        'Verbindung unterbrochen. Angezeigte Daten können veraltet sein.',
      );
      if (navigator.onLine) reconnect = setTimeout(connect, delay);
      delay = Math.min(delay * 2, 5000);
    }
    async function connect() {
      detach();
      const attempt = connection;
      const current = () =>
        live() && attempt === connection && navigator.onLine;
      try {
        await removing;
        if (!current()) return;
        await db.realtime.setAuth(inventoryScope().jwt);
        if (!current()) return;
        channel = db.channel(
          'haushalt-' + scope.household + '-' + scope.generation,
          {
            config: { postgres_changes_options: { wait: true } },
          },
        );
        channel
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'household_signals',
              filter: 'id=eq.' + scope.household,
            },
            () => {
              if (current()) {
                delay = 300;
                schedule();
              }
            },
          )
          .on('system', {}, (message) => {
            if (current() && message.status === 'error') retry();
          })
          .subscribe((state) => {
            if (!current()) return;
            if (state === 'SUBSCRIBED') {
              subscribed = true;
              schedule(true);
            } else if (['CHANNEL_ERROR', 'CLOSED', 'TIMED_OUT'].includes(state))
              retry();
          });
      } catch {
        if (current()) retry();
      }
    }
    const focus = () => schedule(true);
    const online = () => {
      clearTimeout(reconnect);
      void connect();
    };
    const token = () => {
      if (live()) online();
    };
    // Nach einem Entzug unterbindet RLS weitere Signale an das entfernte Mitglied.
    let checkingMembership = false;
    const membershipTimer = setInterval(async () => {
      if (checkingMembership || !live() || !navigator.onLine) return;
      checkingMembership = true;
      try {
        const current = await readRevision(inventoryScope(controller.signal));
        if (live() && current !== revision) schedule();
      } catch {
        if (live()) await refresh(true);
      } finally {
        checkingMembership = false;
      }
    }, 1500);
    const close = () => {
      clearInterval(membershipTimer);
      controller.abort();
      clearTimeout(timer);
      clearTimeout(reconnect);
      detach();
      synchronizedScopes.delete(identity);
    };
    identity.addEventListener('abort', close, { once: true });
    window.addEventListener('focus', focus);
    window.addEventListener('zaeme-token', token);
    window.addEventListener('zaeme-reconnected', online);
    window.addEventListener('offline', retry);
    void connect();
    return () => {
      identity.removeEventListener('abort', close);
      window.removeEventListener('focus', focus);
      window.removeEventListener('zaeme-token', token);
      window.removeEventListener('zaeme-reconnected', online);
      window.removeEventListener('offline', retry);
      close();
    };
  }, [identity]);
  if (!status && navigator.onLine) return null;
  return (
    <small role="status">
      {navigator.onLine && status}{' '}
      {checkedAt &&
        'Haushalt zuletzt geprüft um ' +
          checkedAt.toLocaleTimeString('de-CH', { timeZone: 'Europe/Zurich' }) +
          ' Uhr.'}
    </small>
  );
}
