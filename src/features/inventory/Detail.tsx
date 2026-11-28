import { ProductSource } from '../capture/ProductSource';
import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Confirm } from '../../components/ui/Confirm';
import { ProductForm } from '../capture/ProductForm';
import { decimal, expiry, fromMillis, millis, quantity } from './domain';
import {
  inventoryScope,
  readItem,
  readOwners,
  type Item,
  type Scope,
} from './read';
import { ReadFailure, Status } from './List';
import { useResource, useToday } from './resource';
import { useWrite } from './writes';
import { FlowError } from '../../lib/operations/protocol';

function AmountForm({
  item,
  reserve,
  remove,
  conflict,
  onConflict,
}: {
  item: Item;
  reserve: boolean;
  remove: boolean;
  conflict: string;
  onConflict: (message: string) => void;
}) {
  const [amount, setAmount] = useState(
    reserve && item.own_quantity
      ? String(item.own_quantity)
      : item.consumable_quantity < 1
        ? String(item.consumable_quantity)
        : '1',
  );
  const [full, setFull] = useState<{ version: number; amount: string } | null>(
      null,
    ),
    [error, setError] = useState('');
  const write = useWrite(),
    s = inventoryScope(),
    nav = useNavigate();
  const back = '/inventory/' + item.id,
    ctx = { h: s.household, g: s.generation, id: item.id };
  const q = (n: number | string) => quantity(n, item.unit);
  const verb = remove ? 'Aus Bestand entfernen' : 'Verbrauchen';
  const blocked = write.blocked(
    reserve ? 'set_reservation' : 'consume_item',
    item.id,
  );
  function send(value: string, confirmed?: number) {
    setError('');
    onConflict('');
    const changed = (code: string) => onConflict(new FlowError(code).message);
    try {
      const n = decimal(value, item.unit, reserve);
      if (millis(n) > millis(item.consumable_quantity))
        throw new Error(
          'Für diese Menge reicht der für dich verfügbare Vorrat nicht aus.',
        );
      if (reserve)
        void write.submit(
          'set_reservation',
          { ...ctx, desired: n, v: item.version },
          item.name,
          n === '0'
            ? 'Deine Reservierung wurde freigegeben.'
            : 'Deine Reservierung wurde gespeichert.',
          () => void nav(back),
          changed,
        );
      else if (millis(n) === millis(item.quantity) && confirmed === undefined)
        setFull({ version: item.version, amount: n });
      else {
        void write.submit(
          'consume_item',
          {
            ...ctx,
            amount: n,
            unit: item.unit,
            confirm_full: confirmed !== undefined,
            ...(confirmed === undefined ? {} : { confirmed_v: confirmed }),
          },
          item.name,
          q(n) + ' aus dem Vorrat entfernt.',
          () => void nav(confirmed !== undefined ? '/inventory' : back),
          changed,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prüfe die Menge.');
    }
  }
  let remaining = '';
  try {
    const n = decimal(amount, item.unit, reserve);
    if (!reserve && millis(n) <= millis(item.consumable_quantity))
      remaining = q(fromMillis(millis(item.quantity) - millis(n)));
  } catch {
    /* Eingabe noch unvollständig. */
  }
  return (
    <>
      <Link to={back}>Zurück zum Produkt</Link>
      <h1>{reserve ? 'Eigene Reservierung' : verb}</h1>
      <h2>{item.name}</h2>
      <dl className="amounts">
        <div>
          <dt>Gesamtbestand</dt>
          <dd>{q(item.quantity)}</dd>
        </div>
        <div>
          <dt>Für dich verfügbar</dt>
          <dd>{q(item.consumable_quantity)}</dd>
        </div>
        {reserve && (
          <>
            <div>
              <dt>Für dich reserviert</dt>
              <dd>{q(item.own_quantity)}</dd>
            </div>
            <div>
              <dt>Für andere reserviert</dt>
              <dd>
                {q(
                  fromMillis(
                    millis(item.reserved_quantity) - millis(item.own_quantity),
                  ),
                )}
              </dd>
            </div>
          </>
        )}
      </dl>
      {reserve ? (
        <p>
          Reservierte Lebensmittel bleiben im Vorrat, sind aber für andere
          Mitglieder nicht frei verfügbar.
        </p>
      ) : (
        remove && (
          <p>
            Das Verbrauchsdatum ist überschritten. Entferne die entsprechende
            Menge aus dem Bestand.
          </p>
        )
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(amount);
        }}
      >
        <label>
          {reserve ? 'Gewünschte eigene Menge' : 'Menge'} ({item.unit})
          <input
            inputMode="decimal"
            value={amount}
            aria-invalid={!!error}
            onChange={(e) => {
              setAmount(e.target.value);
              setError('');
            }}
          />
        </label>
        {reserve ? (
          <p>Maximal für dich reservierbar · {q(item.consumable_quantity)}</p>
        ) : (
          remaining && <p>Danach im Vorrat · {remaining}</p>
        )}
        {(error || write.message || conflict) && (
          <p role="alert">{error || write.message || conflict}</p>
        )}
        <button disabled={blocked || (!reserve && !item.consumable_quantity)}>
          {reserve ? 'Reservierung speichern' : verb}
        </button>
      </form>
      {reserve && item.own_quantity > 0 && (
        <button
          className="secondary"
          disabled={blocked}
          onClick={() => send('0')}
        >
          Reservierung freigeben
        </button>
      )}
      {!reserve &&
        millis(item.quantity) === millis(item.consumable_quantity) && (
          <button
            className="secondary"
            disabled={blocked}
            onClick={() => send(String(item.quantity))}
          >
            Gesamten Bestand entfernen
          </button>
        )}
      {full && full.version === item.version && (
        <Confirm
          title="Gesamten Bestand entfernen?"
          description={
            q(full.amount) +
            ' ' +
            item.name +
            ' werden vollständig aus dem Vorrat entfernt.'
          }
          action="Vollständig entfernen"
          cancel={() => setFull(null)}
          confirm={() => {
            setFull(null);
            send(full.amount, full.version);
          }}
        />
      )}
    </>
  );
}
export function Detail({
  id,
  action,
  days,
}: {
  id: string;
  action: string;
  days: number;
}) {
  const day = useToday(),
    [conflict, onConflict] = useState('');
  const load = useCallback(
    async (s: Scope) => {
      for (let attempt = 0; ; attempt++) {
        const item = await readItem(s, id);
        if (!item) return null;
        try {
          const owners = await readOwners(s, [item]);
          return { item, owners: owners[id] ?? [] };
        } catch (e) {
          if (e instanceof FlowError && e.code === 'FORBIDDEN') throw e;
          if (e instanceof FlowError && e.code === 'STALE' && attempt < 2)
            continue;
          return { item, owners: null };
        }
      }
    },
    [id],
  );
  const result = useResource(id, load);
  if (result.error) return <ReadFailure again={result.again} />;
  if (result.data === undefined)
    return <p role="status">Eintrag wird geladen …</p>;
  if (!result.data)
    return (
      <>
        <h1>Eintrag nicht verfügbar</h1>
        <p>Diese Charge ist in deinem aktiven Vorrat nicht verfügbar.</p>
        <Link to="/inventory">Zum Vorrat</Link>
      </>
    );
  const { item, owners } = result.data;
  const remove =
    item.date_type === 'Verbrauchsdatum' &&
    expiry(item.expiry_date, days, day).kind === 'overdue';
  if (action === 'edit') return <ProductForm key={id} item={item} />;
  if (action === 'reserve' || action === 'consume')
    return (
      <AmountForm
        key={[action, id, item.version].join('-')}
        item={item}
        reserve={action === 'reserve'}
        remove={remove}
        conflict={conflict}
        onConflict={onConflict}
      />
    );
  const base = '/inventory/' + id,
    q = (n: number) => quantity(n, item.unit);
  return (
    <>
      <Link to="/inventory">Zurück zum Vorrat</Link>
      <div>
        <p className="context-label">{item.category}</p>
        <h1>{item.name}</h1>
      </div>
      <Status item={item} days={days} day={day} />
      {item.barcode && <ProductSource barcode={item.barcode} />}
      {item.location && <p>Lagerort · {item.location}</p>}
      {remove && (
        <p className="safety">
          Das Verbrauchsdatum ist überschritten. Dieses Lebensmittel nicht mehr
          verzehren.
        </p>
      )}
      {item.date_type === 'MHD' &&
        expiry(item.expiry_date, days, day).kind === 'overdue' && (
          <p>
            Das Mindesthaltbarkeitsdatum ist überschritten. Prüfe das
            Lebensmittel vor der Verwendung.
          </p>
        )}
      <Link className="primary" to={base + '/consume'}>
        {remove ? 'Aus Bestand entfernen' : 'Verbrauchen'}
      </Link>
      <dl className="amounts">
        {(
          [
            ['Gesamtbestand', item.quantity],
            ['Reserviert', item.reserved_quantity],
            ['Davon für dich reserviert', item.own_quantity],
            ['Frei verfügbar', item.free_quantity],
            ['Für dich verfügbar', item.consumable_quantity],
          ] as const
        ).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{q(v)}</dd>
          </div>
        ))}
      </dl>
      <div className="choices">
        <Link className="secondary" to={base + '/reserve'}>
          {item.own_quantity ? 'Reservierung bearbeiten' : 'Reservieren'}
        </Link>
        <Link className="secondary" to={base + '/edit'}>
          Bearbeiten
        </Link>
      </div>
      {item.reserved_quantity > 0 && (
        <section>
          <h2>Reservierungen</h2>
          {owners ? (
            <ul>
              {owners.map((o) => (
                <li key={o.user}>
                  {o.name} · {q(o.quantity)}
                </li>
              ))}
            </ul>
          ) : (
            <ReadFailure again={result.again} />
          )}
        </section>
      )}
      <button className="text-button" onClick={result.again}>
        Eintrag aktualisieren
      </button>
    </>
  );
}
