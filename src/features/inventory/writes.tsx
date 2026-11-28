import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import { readShopping } from '../shopping/read';
import type { Payloads, ShoppingMutation } from '../../lib/operations/rpc';
import { mutate, reviewPending } from '../../lib/operations/rpc';
import { FlowError } from '../../lib/operations/protocol';
import { activeScope, announce, refresh, snapshot } from '../auth/session';
import {
  inventoryScope,
  isCurrent,
  readInventory,
  readItem,
  type Scope,
} from './read';
import { invalidateInventory } from './resource';
import { quantity } from './domain';

type Name =
  | ShoppingMutation
  | 'set_warning_days'
  | 'create_item'
  | 'edit_item'
  | 'consume_item'
  | 'delete_item'
  | 'set_reservation';
type Args<K extends Name> = Payloads[K];
type Job = {
  key: string;
  name: Name;
  label: string;
  intention: string;
  retryable: boolean;
  scope: Scope;
  status: 'sending' | 'uncertain' | 'acknowledged';
  message: string;
  retry: () => Promise<void>;
  review: () => Promise<void>;
  finish?: () => void;
  summary?: string[];
  forget: () => void;
};
let jobs: Job[] = [];
const createMarker = 'zaeme-pruefung-offen';
const createKey = JSON.stringify(['create_item', '']);
function describe(name: Name, args: Payloads[Name]) {
  if (name === 'set_warning_days' && 'days' in args)
    return 'Warnfrist · ' + args.days + ' Tage';
  if (name === 'delete_shopping') return 'Einkaufseintrag entfernen';
  if ('checked' in args)
    return args.checked ? 'Als eingekauft markieren' : 'Wieder öffnen';
  if (
    'fields' in args &&
    args.fields &&
    typeof args.fields === 'object' &&
    !Array.isArray(args.fields)
  ) {
    const f = args.fields;
    const amount =
      typeof f.quantity === 'string' && typeof f.unit === 'string'
        ? quantity(f.quantity, f.unit)
        : '';
    const intention =
      name === 'create_item'
        ? 'Zum Vorrat hinzufügen'
        : name === 'create_shopping'
          ? 'Zur Einkaufsliste hinzufügen'
          : 'Änderungen speichern';
    return [intention, amount].filter(Boolean).join(' · ');
  }
  if ('amount' in args)
    return 'Bestand entfernen · ' + quantity(String(args.amount), args.unit);
  if ('desired' in args)
    return (
      'Eigene Reservierung · Zielmenge ' +
      String(args.desired).replace('.', ',')
    );
  return 'Fehlerhaften Eintrag löschen';
}
function canWrite() {
  return navigator.onLine && !snapshot().checkingConnection;
}
function missingOriginal(shopping = false) {
  const marker = shopping ? 'zaeme-einkauf-offen' : createMarker;
  const key = shopping ? JSON.stringify(['create_shopping', '']) : createKey;
  return (
    sessionStorage.getItem(marker) === '1' && !jobs.some((j) => j.key === key)
  );
}
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const getJobs = () => jobs;
const emit = () => {
  jobs = [...jobs];
  for (const fn of listeners) fn();
};
function drop(j: Job) {
  if (j.name === 'create_shopping')
    sessionStorage.removeItem('zaeme-einkauf-offen');
  if (j.key === createKey) sessionStorage.removeItem(createMarker);
  jobs = jobs.filter((other) => other !== j);
  j.scope.signal.removeEventListener('abort', j.forget);
  emit();
}

export function useWrite() {
  const mounted = useRef(true),
    [message, setMessage] = useState('');
  const tracked = useSyncExternalStore(subscribe, getJobs);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function submit<K extends Name>(
    name: K,
    args: Args<K>,
    label: string,
    success: string,
    onDone: () => void,
    onConflict?: (code: string) => void,
  ) {
    const s = inventoryScope(),
      key = JSON.stringify([name, 'id' in args ? args.id : '']);
    if (
      (['create_item', 'create_shopping'].includes(name) &&
        missingOriginal(name === 'create_shopping')) ||
      !canWrite() ||
      args.h !== s.household ||
      args.g !== s.generation ||
      jobs.some((j) => j.key === key && j.scope.signal === s.signal)
    )
      return;
    const payload = structuredClone(args);
    const job: Job = {
      key,
      name,
      scope: s,
      label,
      intention: describe(name, payload),
      retryable: true,
      status: 'sending',
      message: '',
      forget: () => drop(job),
      retry: run,
      review,
    };
    function done() {
      if (!isCurrent(s)) return;
      drop(job);
      invalidateInventory();
      announce(success);
      if (mounted.current) onDone();
    }
    let running = false;
    async function run() {
      if (running || !isCurrent(s) || !canWrite()) return;
      running = true;
      job.status = 'sending';
      job.finish = undefined;
      job.summary = undefined;
      emit();
      try {
        for (let attempt = 0; ; attempt++) {
          try {
            await mutate(name, payload);
            break;
          } catch (error) {
            if (
              !(error instanceof FlowError) ||
              error.code !== 'RETRY' ||
              attempt >= 2
            )
              throw error;
            await new Promise((resolve) =>
              setTimeout(resolve, (attempt + 1) * 100 + Math.random() * 100),
            );
            if (!isCurrent(s) || !canWrite()) throw error;
          }
        }
        done();
      } catch (e) {
        if (s.signal.aborted) return;
        const code = e instanceof FlowError ? e.code : 'TRANSPORT';
        job.message =
          e instanceof FlowError
            ? e.message
            : 'Die Antwort fehlt. Der Ausgang ist offen.';
        if (code === 'REFRESH_FAILED') {
          job.status = 'acknowledged';
          job.retry = async () => {
            await refresh(true);
            if (!isCurrent(s)) return;
            try {
              if (name.endsWith('_shopping')) await readShopping(s);
              else if (name === 'set_warning_days') {
                if (!snapshot().account?.home)
                  throw new FlowError('REFRESH_FAILED');
              } else if ('id' in payload && typeof payload.id === 'string')
                await readItem(s, payload.id);
              else await readInventory(s);
              done();
            } catch {
              emit();
            }
          };
        } else if (
          [
            'TRANSPORT',
            'RETRY',
            'UNRESOLVED',
            'OP_EXPIRED',
            'OP_MISMATCH',
          ].includes(code)
        ) {
          job.status = 'uncertain';
          job.retryable = !['OP_EXPIRED', 'OP_MISMATCH'].includes(code);
          invalidateInventory();
        } else {
          drop(job);
          if (isCurrent(s) && mounted.current) {
            setMessage(job.message);
            onConflict?.(code);
          }
          invalidateInventory();
        }
        emit();
      } finally {
        running = false;
      }
    }
    async function review() {
      if (!isCurrent(s) || !canWrite()) return;
      try {
        const decision = await reviewPending(name, payload);
        const all = name.endsWith('_shopping')
          ? await readShopping(s)
          : name === 'set_warning_days'
            ? []
            : await readInventory(s);
        if (!isCurrent(s) || !jobs.includes(job)) return;
        const relevant = all.filter((i) =>
          'id' in payload ? i.id === payload.id : i.name === label,
        );
        job.summary = relevant.map(
          (i) =>
            i.name +
            ' · ' +
            (i.quantity !== null && i.unit
              ? quantity(i.quantity, i.unit)
              : 'Ohne Mengenangabe') +
            ('checked' in i ? (i.checked ? ' · Eingekauft' : ' · Offen') : '') +
            ' · Version ' +
            i.version,
        );
        if (name === 'set_warning_days')
          job.summary = [
            'Aktuelle Warnfrist · ' +
              snapshot().account?.home?.warning_days +
              ' Tage',
          ];
        job.finish = () => {
          if (!isCurrent(s)) return;
          decision.resolve();
          drop(job);
          invalidateInventory();
        };
      } catch {
        job.message = 'Der aktuelle Stand konnte nicht geprüft werden.';
      }
      emit();
    }
    if (name === 'create_shopping')
      sessionStorage.setItem('zaeme-einkauf-offen', '1');
    if (name === 'create_item') sessionStorage.setItem(createMarker, '1');
    setMessage('');
    announce('');
    jobs.push(job);
    s.signal.addEventListener('abort', job.forget, { once: true });
    await run();
  }
  return {
    submit,
    message,
    blocked: (name: Name, id = '') =>
      !canWrite() ||
      (['create_item', 'create_shopping'].includes(name) &&
        missingOriginal(name === 'create_shopping')) ||
      tracked.some(
        (j) =>
          j.scope.signal === activeScope().signal &&
          j.key === JSON.stringify([name, id]),
      ),
  };
}
export function PendingWrites() {
  const list = useSyncExternalStore(subscribe, getJobs);
  const [reviewed, setReviewed] = useState(false),
    [error, setError] = useState(false);
  const current = activeScope();
  if (!current.household)
    return list.some(
      (j) => j.scope.signal === current.signal && j.status === 'acknowledged',
    ) ? (
      <p role="status">
        Die Änderung wurde gespeichert. Lade den aktuellen Stand erneut.
      </p>
    ) : null;
  return (
    <>
      {missingOriginal(true) && (
        <section className="pending">
          <p role="alert">Eine frühere Einkaufserfassung ist noch zu prüfen.</p>
          <Link to="/shopping">Einkauf zur Prüfung öffnen</Link>
          <button
            disabled={!canWrite()}
            onClick={async () => {
              const s = inventoryScope();
              try {
                await readShopping(s);
                if (
                  isCurrent(s) &&
                  window.confirm(
                    'Hast du die Einkaufsliste abgeglichen und den Ausgang geklärt?',
                  )
                ) {
                  sessionStorage.removeItem('zaeme-einkauf-offen');
                  emit();
                }
              } catch {
                if (isCurrent(s))
                  announce('Die Einkaufsliste konnte nicht geprüft werden.');
              }
            }}
          >
            Einkauf abgleichen
          </button>
        </section>
      )}
      {missingOriginal() && (
        <section className="pending">
          <p role="alert">
            Eine frühere Erfassung ist noch zu prüfen. Nach dem Neuladen fehlt
            die ursprüngliche Anfrage.
          </p>
          <Link to="/inventory">Vorrat zur Prüfung öffnen</Link>
          <button
            disabled={!canWrite()}
            onClick={async () => {
              const s = inventoryScope();
              try {
                await readInventory(s);
                if (isCurrent(s)) setReviewed(true);
              } catch {
                if (isCurrent(s)) setError(true);
              }
            }}
          >
            Vollständigen Vorrat neu lesen
          </button>
          {error && (
            <p role="alert">
              Der Vorrat konnte nicht vollständig gelesen werden.
            </p>
          )}
          {reviewed && (
            <button
              onClick={() => {
                if (
                  window.confirm(
                    'Hast du den Vorrat abgeglichen und den Ausgang der früheren Erfassung geklärt?',
                  )
                ) {
                  sessionStorage.removeItem(createMarker);
                  setReviewed(false);
                  emit();
                }
              }}
            >
              Abgleich bestätigen
            </button>
          )}
        </section>
      )}
      {list
        .filter((j) => isCurrent(j.scope))
        .map((j) => (
          <section className="pending" key={j.key} aria-label="Speicherstatus">
            <strong>{j.label}</strong>
            <p>{j.intention}</p>
            {j.status === 'sending' ? (
              <p role="status">Wird gespeichert …</p>
            ) : (
              <>
                <p role="alert">{j.message}</p>
                {j.retryable && (
                  <button disabled={!canWrite()} onClick={() => void j.retry()}>
                    {j.status === 'acknowledged'
                      ? 'Gespeicherten Stand laden'
                      : 'Ursprüngliche Anfrage identisch wiederholen'}
                  </button>
                )}
                {j.status === 'uncertain' && (
                  <>
                    <button
                      className="secondary"
                      disabled={!canWrite()}
                      onClick={() => void j.review()}
                    >
                      {j.name.endsWith('_shopping')
                        ? 'Einkauf abgleichen'
                        : j.name === 'set_warning_days'
                          ? 'Warnfrist abgleichen'
                          : 'Aktuellen Vorrat abgleichen'}
                    </button>
                    {j.summary && (
                      <>
                        <p>
                          {j.name.endsWith('_shopping')
                            ? 'Passende Einkaufseinträge'
                            : j.name === 'set_warning_days'
                              ? 'Gespeicherte Einstellung'
                              : 'Aktuelle passende Chargen im vollständigen Vorrat'}
                        </p>
                        {j.summary.length ? (
                          <ul>
                            {j.summary.map((v, i) => (
                              <li key={i}>{v}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>Kein passender Eintrag.</p>
                        )}
                        <p>
                          Gleiche Produktdaten oder fehlende Einträge belegen
                          den Ausgang der Anfrage nicht.
                        </p>
                        <Link
                          to={
                            j.name.endsWith('_shopping')
                              ? '/shopping'
                              : j.name === 'set_warning_days'
                                ? '/household'
                                : '/inventory'
                          }
                        >
                          Zur Übersicht
                        </Link>
                        <button
                          className="secondary"
                          onClick={() => {
                            if (
                              window.confirm(
                                'Hast du den Ausgang geklärt und möchtest du die ursprüngliche Anfrage abschliessen?',
                              )
                            )
                              j.finish?.();
                          }}
                        >
                          Geprüfte Anfrage abschliessen
                        </button>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        ))}
    </>
  );
}
