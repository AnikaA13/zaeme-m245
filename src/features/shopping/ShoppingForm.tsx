import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { nameValue } from '../../lib/operations/protocol';
import { decimal, quantity, units } from '../inventory/domain';
import { inventoryScope } from '../inventory/read';
import { useWrite } from '../inventory/writes';
import type { ShoppingItem } from './read';

export function ShoppingForm({
  item,
  initialName = '',
  back = '/shopping',
}: {
  item?: ShoppingItem;
  initialName?: string;
  back?: string;
}) {
  const [name, setName] = useState(item?.name ?? initialName);
  const [amount, setAmount] = useState(item?.quantity?.toString() ?? '');
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [version, setVersion] = useState(item?.version);
  const [error, setError] = useState('');
  const write = useWrite(),
    nav = useNavigate();
  const stale = item?.version !== version;
  const invalidVersion =
    item && (!Number.isSafeInteger(version) || !version || version < 1);
  function save() {
    if (stale || invalidVersion) return;
    try {
      const validName = nameValue(name);
      if (Boolean(amount) !== Boolean(unit))
        throw new Error(
          'Gib Menge und Einheit zusammen an oder lasse beide Felder leer.',
        );
      const fields = {
        name: validName,
        quantity: amount ? decimal(amount, unit) : null,
        unit: unit || null,
      };
      const scope = inventoryScope(),
        args = { h: scope.household, g: scope.generation, fields };
      const done = () => void nav(back);
      setError('');
      if (item && version)
        void write.submit(
          'edit_shopping',
          { ...args, id: item.id, v: version },
          validName,
          'Einkaufseintrag gespeichert.',
          done,
        );
      else
        void write.submit(
          'create_shopping',
          args,
          validName,
          'Zur Einkaufsliste hinzugefügt.',
          done,
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prüfe deine Eingabe.');
    }
  }
  return (
    <>
      <h1>
        {item ? 'Einkaufseintrag bearbeiten' : 'Einkaufseintrag hinzufügen'}
      </h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label>
          Name
          <input
            value={name}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Menge (optional)
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Einheit (optional)
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="">Keine Einheit</option>
            {units.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        {stale && item && (
          <section role="alert">
            <p>
              Der Eintrag wurde geändert. Aktuell gespeichert: {item.name}
              {item.quantity !== null &&
                item.unit &&
                ' · ' + quantity(item.quantity, item.unit)}{' '}
              · {item.checked ? 'Eingekauft' : 'Offen'}.
            </p>
            <button
              type="button"
              className="secondary"
              onClick={() => setVersion(item.version)}
            >
              Aktuellen Stand als Grundlage verwenden
            </button>
          </section>
        )}
        {(error || write.message || invalidVersion) && (
          <p role="alert">
            {error || write.message || 'Die Version ist nicht verarbeitbar.'}
          </p>
        )}
        <button
          disabled={
            !!invalidVersion ||
            stale ||
            write.blocked(item ? 'edit_shopping' : 'create_shopping', item?.id)
          }
        >
          Speichern
        </button>
        <Link className="secondary" to={back}>
          Abbrechen
        </Link>
      </form>
    </>
  );
}
