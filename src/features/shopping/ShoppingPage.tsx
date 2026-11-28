import { useState } from 'react';
import { Link } from 'react-router';
import { Confirm } from '../../components/ui/Confirm';
import { quantity } from '../inventory/domain';
import { inventoryScope } from '../inventory/read';
import { useResource } from '../inventory/resource';
import { useWrite } from '../inventory/writes';
import { readShopping, type ShoppingItem } from './read';
import { ShoppingForm } from './ShoppingForm';

export function ShoppingPage({ editId }: { editId?: string }) {
  const result = useResource('shopping', readShopping);
  const [removing, setRemoving] = useState<ShoppingItem | null>(null);
  const write = useWrite(),
    scope = inventoryScope();
  const context = { h: scope.household, g: scope.generation };
  if (result.error && (!editId || !result.data))
    return (
      <>
        <h1>Einkauf</h1>
        <p role="alert">Die Einkaufsliste konnte nicht geladen werden.</p>
        <button onClick={result.again}>Erneut laden</button>
      </>
    );
  if (!result.data)
    return (
      <>
        <h1>Einkauf</h1>
        <p role="status">
          {navigator.onLine
            ? 'Einkaufsliste wird geladen …'
            : 'Verbinde dich mit dem Netz, um die Einkaufsliste zu laden.'}
        </p>
      </>
    );
  const rows = result.data;
  if (editId) {
    const item = rows.find((row) => row.id === editId);
    return item ? (
      <>
        {result.error && (
          <>
            <p role="alert">
              Der aktuelle Eintrag konnte nicht geladen werden. Dein Entwurf
              bleibt erhalten.
            </p>
            <button onClick={result.again}>Erneut laden</button>
          </>
        )}
        <div hidden={result.error}>
          <ShoppingForm key={editId} item={item} />
        </div>
      </>
    ) : (
      <>
        <h1>Eintrag nicht verfügbar</h1>
        <Link to="/shopping">Zum Einkauf</Link>
      </>
    );
  }
  return (
    <>
      <h1>Einkauf</h1>
      <Link className="primary" to="/shopping/add">
        Eintrag hinzufügen
      </Link>
      {write.message && <p role="alert">{write.message}</p>}
      {[false, true].map((done) => {
        const items = rows.filter((row) => row.checked === done);
        const title = done ? 'Eingekauft' : 'Offen';
        return (
          <section key={title} aria-label={title}>
            <h2>{title}</h2>
            {items.length ? (
              <ul className="shopping-list">
                {items.map((item) => {
                  const args = { ...context, id: item.id, v: item.version };
                  const valid =
                    Number.isSafeInteger(item.version) && item.version > 0;
                  return (
                    <li key={item.id}>
                      <label className="shopping-check">
                        <input
                          type="checkbox"
                          aria-label={item.name}
                          checked={item.checked}
                          disabled={
                            !valid || write.blocked('check_shopping', item.id)
                          }
                          onChange={(e) =>
                            void write.submit(
                              'check_shopping',
                              { ...args, checked: e.target.checked },
                              item.name,
                              done
                                ? 'Eintrag wieder geöffnet.'
                                : 'Als eingekauft markiert.',
                              () => {},
                            )
                          }
                        />
                        <span>
                          <strong>{item.name}</strong>
                          {item.quantity !== null && item.unit && (
                            <small>{quantity(item.quantity, item.unit)}</small>
                          )}
                        </span>
                      </label>
                      <div className="choices">
                        <Link
                          className="secondary"
                          aria-label={item.name + ' bearbeiten'}
                          to={'/shopping/edit/' + item.id}
                        >
                          Bearbeiten
                        </Link>
                        <button
                          className="text-button"
                          aria-label={item.name + ' entfernen'}
                          disabled={
                            !valid || write.blocked('delete_shopping', item.id)
                          }
                          onClick={() => setRemoving(item)}
                        >
                          Entfernen
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>
                {done
                  ? 'Noch keine erledigten Einträge.'
                  : 'Keine offenen Einkaufseinträge.'}
              </p>
            )}
          </section>
        );
      })}
      {removing &&
        (rows.some(
          (i) => i.id === removing.id && i.version === removing.version,
        ) ? (
          <Confirm
            title="Einkaufseintrag entfernen?"
            description={
              '«' + removing.name + '» aus der Einkaufsliste entfernen?'
            }
            action="Eintrag entfernen"
            cancel={() => setRemoving(null)}
            confirm={() => {
              setRemoving(null);
              void write.submit(
                'delete_shopping',
                { ...context, id: removing.id, v: removing.version },
                removing.name,
                'Einkaufseintrag entfernt.',
                () => {},
              );
            }}
          />
        ) : (
          <p role="alert">
            Der Eintrag hat sich geändert. Prüfe die Liste vor dem Entfernen.
          </p>
        ))}
    </>
  );
}
