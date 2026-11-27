import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { Link, useLocation } from 'react-router';
import { useCapture } from '../../components/navigation/Navigation';
import { activeScope } from '../auth/session';
import { FlowError } from '../../lib/operations/protocol';
import { dateLabel, expiry, quantity, showDate } from './domain';
import {
  matches,
  readInventory,
  readOwners,
  sorted,
  type Item,
  type Scope,
} from './read';
import { invalidateInventory, useResource, useToday } from './resource';

export function Status({
  item,
  days,
  day,
}: {
  item: Item;
  days: number;
  day: string;
}) {
  const s = expiry(item.expiry_date, days, day);
  return (
    <span className={'expiry ' + s.kind}>
      {s.text}
      {item.expiry_date && (
        <>
          {' '}
          · {dateLabel(item.date_type)}{' '}
          <time dateTime={item.expiry_date}>{showDate(item.expiry_date)}</time>
        </>
      )}
    </span>
  );
}
export function ReadFailure({ again }: { again: () => void }) {
  return (
    <div>
      <p role="alert">Der aktuelle Stand konnte nicht geladen werden.</p>
      <button
        className="secondary"
        disabled={!navigator.onLine}
        onClick={again}
      >
        Erneut laden
      </button>
    </div>
  );
}
function Rows({
  items,
  days,
  day,
}: {
  items: Item[];
  days: number;
  day: string;
}) {
  const load = useCallback(
    async (s: Scope) => {
      try {
        return await readOwners(s, items);
      } catch (e) {
        if (e instanceof FlowError && e.code === 'STALE') {
          const updated = await readInventory(s);
          const fresh = updated.filter((i) =>
            items.some((old) => old.id === i.id),
          );
          await readOwners(s, fresh);
          invalidateInventory();
        }
        throw e;
      }
    },
    [items],
  );
  const key = items.map((i) => i.id + '-' + i.version).join(',');
  const owners = useResource(key, load);
  return (
    <ul className="stock-list">
      {items.map((i) => (
        <li key={i.id}>
          <Link to={'/inventory/' + i.id}>
            <span className="row-main">
              <strong>{i.name}</strong>
              <span>
                {quantity(i.quantity, i.unit)}
                {i.location ? ' · ' + i.location : ''}
              </span>
              <Status item={i} days={days} day={day} />
              {i.reserved_quantity > 0 && (
                <small>
                  {quantity(i.reserved_quantity, i.unit)} reserviert ·{' '}
                  {quantity(i.free_quantity, i.unit)} frei ·{' '}
                  {owners.data?.[i.id]
                    ?.map(
                      (o) => o.name + ' (' + quantity(o.quantity, i.unit) + ')',
                    )
                    .join(', ') ??
                    (owners.error
                      ? 'Namen nicht verfügbar'
                      : 'Namen werden geladen …')}
                </small>
              )}
            </span>
            <span aria-hidden="true">›</span>
          </Link>
          {i.reserved_quantity > 0 && owners.error && (
            <button className="text-button" onClick={invalidateInventory}>
              Reservierungen neu laden
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
const preferences = new WeakMap<
  AbortSignal,
  { query: string; urgent: boolean; limit: number; scroll: number }
>();
export function InventoryList({
  overview,
  days,
}: {
  overview: boolean;
  days: number;
}) {
  const scope = activeScope(),
    location = useLocation(),
    capture = useCapture();
  const [prefs] = useState(() => {
    const p = preferences.get(scope.signal) ?? {
      query: '',
      urgent: false,
      limit: 30,
      scroll: 0,
    };
    preferences.set(scope.signal, p);
    return p;
  });
  const [query, setQuery] = useState(prefs.query),
    [urgent, setUrgent] = useState(
      location.search === '?ablauf' || prefs.urgent,
    ),
    [limit, setLimit] = useState(prefs.limit);
  const day = useToday(),
    list = useResource(overview ? 'start' : 'list', readInventory);
  const all = useMemo(() => sorted(list.data ?? []), [list.data]);
  const warnings = useMemo(
    () => all.filter((i) => expiry(i.expiry_date, days, day).urgent),
    [all, day, days],
  );
  const found = useMemo(
    () =>
      overview
        ? warnings.slice(0, 3)
        : (urgent ? warnings : all).filter((i) => matches(i.name, query)),
    [overview, urgent, warnings, all, query],
  );
  const visible = useMemo(() => found.slice(0, limit), [found, limit]);
  const [restore] = useState(() => prefs.scroll);
  const loaded = !!list.data;
  useLayoutEffect(() => {
    if (!overview && loaded) window.scrollTo(0, restore);
  }, [overview, loaded, restore]);
  useEffect(() => {
    if (overview || !loaded) return;
    const remember = () => {
      prefs.scroll = window.scrollY;
    };
    window.addEventListener('scroll', remember);
    return () => window.removeEventListener('scroll', remember);
  }, [loaded, overview, prefs]);
  function filter(q: string, u: boolean) {
    Object.assign(prefs, { query: q, urgent: u, limit: 30, scroll: 0 });
    setQuery(q);
    setUrgent(u);
    setLimit(30);
  }
  return (
    <>
      <div className="screen-heading">
        <h1>{overview ? 'Haltbarkeitsdaten prüfen' : 'Vorrat'}</h1>
        {!overview && (
          <button id="list-add" onClick={() => capture.open('list-add')}>
            Hinzufügen
          </button>
        )}
      </div>
      {!overview && (
        <>
          <label>
            Produktname suchen
            <input
              type="search"
              value={query}
              onChange={(e) => filter(e.target.value, urgent)}
            />
          </label>
          <div className="filters">
            {['Alle', 'Ablaufhinweise'].map((label, i) => (
              <button
                key={label}
                aria-pressed={urgent === !!i}
                onClick={() => filter(query, !!i)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
      {list.error ? (
        <ReadFailure again={list.again} />
      ) : !list.data ? (
        <p role="status">Vorrat wird geladen …</p>
      ) : (
        <>
          {visible.length ? (
            <Rows items={visible} day={day} days={days} />
          ) : (
            <p className="empty">
              {!all.length
                ? 'Euer Vorrat ist noch leer.'
                : overview || urgent
                  ? query
                    ? 'Keine passenden Ablaufhinweise.'
                    : 'Aktuell gibt es keine Ablaufhinweise.'
                  : 'Keine Lebensmittel mit diesem Namen gefunden.'}
            </p>
          )}
          {!overview && (query || urgent) && (
            <button className="text-button" onClick={() => filter('', false)}>
              Suche und Filter zurücksetzen
            </button>
          )}
          {!overview && found.length > limit && (
            <button
              className="secondary"
              onClick={() => {
                prefs.limit = limit + 30;
                setLimit(limit + 30);
              }}
            >
              Weitere Lebensmittel anzeigen
            </button>
          )}
          {overview && (
            <>
              <Link
                to="/inventory?ablauf"
                onClick={() =>
                  Object.assign(prefs, { query: '', urgent: true, scroll: 0 })
                }
              >
                Alle Ablaufhinweise anzeigen
              </Link>
              {all.some((i) => !i.expiry_date) && (
                <p>
                  {all.filter((i) => !i.expiry_date).length} ohne erfasstes
                  Haltbarkeitsdatum
                </p>
              )}
              <Link
                className="secondary"
                to="/inventory"
                onClick={() =>
                  Object.assign(prefs, { query: '', urgent: false, scroll: 0 })
                }
              >
                Gesamten Vorrat anzeigen
              </Link>
            </>
          )}
        </>
      )}
      {(overview || list.data?.length === 0) && (
        <section className="capture-entry">
          <h2>Lebensmittel hinzufügen</h2>
          <button id="manual-add" onClick={() => capture.open('manual-add')}>
            Manuell erfassen
          </button>
          <small>Scannen mit der Kamera ist noch nicht verfügbar.</small>
        </section>
      )}
      <button
        className="text-button"
        disabled={!navigator.onLine}
        onClick={list.again}
      >
        Vorrat aktualisieren
      </button>
      {overview && <Link to="/household">Haushalt öffnen</Link>}
    </>
  );
}
