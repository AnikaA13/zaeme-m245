import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCapture } from '../../components/navigation/Navigation';
import { announce } from '../auth/session';
import { Confirm } from '../../components/ui/Confirm';
import {
  captureDraft,
  categories,
  compatible,
  dateTypes,
  locations,
  millis,
  quantity,
  showDate,
  units,
  validate,
  type CaptureInput,
  type Draft,
} from '../inventory/domain';
import { inventoryScope, type Item } from '../inventory/read';
import { useWrite } from '../inventory/writes';
import { invalidateInventory } from '../inventory/resource';

function fromItem(i: Item): Draft {
  return {
    name: i.name,
    quantity: String(i.quantity),
    unit: i.unit,
    category: i.category,
    barcode: i.barcode ?? '',
    location: i.location ?? '',
    expiry_date: i.expiry_date ?? '',
    date_type: i.date_type ?? '',
  };
}
const labels: Draft = {
  name: 'Produktname',
  quantity: 'Menge',
  unit: 'Einheit',
  category: 'Kategorie',
  location: 'Lagerort',
  expiry_date: 'Haltbarkeitsdatum',
  date_type: 'Datumsart',
  barcode: 'Barcode (EAN-13)',
};
export function ProductForm({
  item,
  seed,
  review,
}: {
  item?: Item;
  seed?: CaptureInput;
  review?: ReactNode;
}) {
  const [base, setBase] = useState(item),
    [draft, setDraft] = useState<Draft>(() =>
      item ? fromItem(item) : captureDraft(seed),
    );
  const [attempted, setAttempted] = useState(false),
    [ack, setAck] = useState(false),
    [serverDate, setServerDate] = useState(''),
    [deleted, setDeleted] = useState<number | null>(null),
    [saved, setSaved] = useState('');
  const confirmation = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (saved) confirmation.current?.focus();
  }, [saved]);
  const write = useWrite(),
    navigate = useNavigate(),
    capture = useCapture(),
    scope = inventoryScope();
  const { errors, fields, needsAck } = validate(
    draft,
    ack,
    base?.expiry_date ?? null,
  );
  if (
    base &&
    base.reserved_quantity > 0 &&
    millis(fields.quantity) < millis(base.reserved_quantity)
  )
    errors.quantity =
      'Die Menge muss mindestens der reservierten Menge entsprechen.';
  const changed = base?.version !== item?.version;
  const context = { h: scope.household, g: scope.generation };
  const blocked = write.blocked(item ? 'edit_item' : 'create_item', item?.id);
  function change(k: keyof Draft, value: string) {
    setDraft((d) => ({
      ...d,
      [k]: value,
      ...(k === 'expiry_date' && !value ? { date_type: '' } : {}),
    }));
    if (k === 'expiry_date') {
      setAck(false);
      setServerDate('');
    }
  }
  function submit() {
    setAttempted(true);
    const first = Object.keys(errors)[0];
    if (first) {
      document.getElementById('field-' + first)?.focus();
      return;
    }
    if (changed || blocked || (serverDate && !ack)) return;
    const conflict = (code: string) => {
      if (code === 'DATE_ACK') {
        setServerDate(draft.expiry_date);
        setAck(false);
      }
      invalidateInventory();
    };
    if (item && base)
      void write.submit(
        'edit_item',
        { ...context, id: item.id, v: base.version, fields, ack },
        fields.name,
        fields.name + ' wurde aktualisiert.',
        () => void navigate('/inventory/' + item.id),
        conflict,
      );
    else
      void write.submit(
        'create_item',
        { ...context, fields, ack },
        fields.name,
        fields.name + ' wurde zum Vorrat hinzugefügt.',
        () => setSaved(fields.name),
        conflict,
      );
  }
  function field(
    k: keyof Draft,
    options?: readonly string[],
    optional = false,
  ): ReactNode {
    const invalid =
      (attempted ||
        (k === 'unit' && !compatible(draft.category, draft.unit))) &&
      errors[k];
    const props = {
      id: 'field-' + k,
      value: draft[k],
      'aria-invalid': !!invalid,
      'aria-describedby': invalid ? 'error-' + k : undefined,
    };
    const locked =
      !!base?.reserved_quantity && (k === 'category' || k === 'unit');
    return (
      <div className="field">
        <label htmlFor={props.id}>
          {labels[k]}
          {optional && ' (optional)'}
        </label>
        {options ? (
          <select
            {...props}
            disabled={locked}
            onChange={(e) => change(k, e.target.value)}
          >
            {(optional || k === 'date_type') && (
              <option value="">
                {optional ? 'Nicht erfasst' : 'Bitte wählen'}
              </option>
            )}
            {options.map((o) => (
              <option
                key={o}
                value={o}
                disabled={k === 'unit' && !compatible(draft.category, o)}
              >
                {o === 'unbekannt'
                  ? 'Unbekannt'
                  : o === 'MHD'
                    ? 'Mindesthaltbarkeitsdatum (MHD)'
                    : o}
              </option>
            ))}
          </select>
        ) : (
          <input
            {...props}
            type={k === 'expiry_date' ? 'date' : 'text'}
            autoComplete="off"
            inputMode={
              k === 'quantity'
                ? 'decimal'
                : k === 'barcode'
                  ? 'numeric'
                  : undefined
            }
            onChange={(e) => change(k, e.target.value)}
          />
        )}
        {invalid && (
          <small className="field-error" id={'error-' + k}>
            {invalid}
          </small>
        )}
      </div>
    );
  }
  function nextCapture(path: '/capture/scan' | '/capture/manual') {
    announce('');
    void navigate(path);
  }
  if (saved)
    return (
      <>
        <h1 tabIndex={-1} ref={confirmation}>
          Lebensmittel hinzugefügt
        </h1>
        <button onClick={() => nextCapture('/capture/scan')}>
          Weiter scannen
        </button>
        <button
          className="secondary"
          onClick={() => nextCapture('/capture/manual')}
        >
          Weiteres Lebensmittel hinzufügen
        </button>
        <Link className="secondary" to="/inventory">
          Zum Vorrat
        </Link>
      </>
    );
  return (
    <>
      <h1>{item ? 'Lebensmittel bearbeiten' : 'Lebensmittel hinzufügen'}</h1>
      {review}
      {changed && item && base && (
        <section className="pending">
          <p role="alert">
            Der Eintrag wurde geändert. Prüfe den aktuellen Stand (Version{' '}
            {item.version}).
          </p>
          <dl>
            {(Object.keys(labels) as (keyof Draft)[])
              .filter((k) => fromItem(item)[k] !== fromItem(base)[k])
              .map((k) => (
                <div key={k}>
                  <dt>{labels[k]}</dt>
                  <dd>{fromItem(item)[k] || 'Nicht erfasst'}</dd>
                </div>
              ))}
          </dl>
          <button
            onClick={() => {
              const next = fromItem(item),
                old = fromItem(base);
              for (const k of Object.keys(labels) as (keyof Draft)[])
                if (draft[k] !== old[k]) next[k] = draft[k];
              setDraft(next);
              setBase(item);
              setAck(false);
            }}
          >
            Aktuellen Stand als Grundlage übernehmen
          </button>
        </section>
      )}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {field('name')}
        <div className="field-pair">
          {field('quantity')}
          {field('unit', units)}
        </div>
        {field('category', categories)}
        {!!base?.reserved_quantity && (
          <p>
            {quantity(base.reserved_quantity, base.unit)} reserviert. Kategorie
            und Einheit sind gebunden.
          </p>
        )}
        {field('location', locations, true)}
        {field('expiry_date', undefined, true)}
        {draft.expiry_date && field('date_type', dateTypes)}
        {(needsAck || !!serverDate) && (
          <label className="check">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            Ich habe das Datum {showDate(draft.expiry_date)} geprüft.
          </label>
        )}
        {field('barcode', undefined, true)}
        {attempted && Object.keys(errors).length > 0 && (
          <p role="alert">Prüfe die markierten Felder.</p>
        )}
        {write.message && <p role="alert">{write.message}</p>}
        <button disabled={blocked || changed}>
          {item ? 'Änderungen speichern' : 'Zum Vorrat hinzufügen'}
        </button>
      </form>
      <button
        className="secondary"
        onClick={() =>
          item ? void navigate('/inventory/' + item.id) : capture.cancel()
        }
      >
        Abbrechen
      </button>
      {item && (
        <section className="deletion">
          <h2>Fehlerhaften Eintrag entfernen</h2>
          <p>
            Wurde das Lebensmittel aufgebraucht, wähle «Verbrauchen». Löschen
            korrigiert einen fehlerhaften Eintrag.
          </p>
          {item.reserved_quantity > 0 && (
            <p>Dieser Eintrag ist reserviert und kann nicht gelöscht werden.</p>
          )}
          <button
            className="danger"
            disabled={
              item.reserved_quantity > 0 ||
              changed ||
              write.blocked('delete_item', item.id)
            }
            onClick={() => setDeleted(item.version)}
          >
            Eintrag löschen
          </button>
        </section>
      )}
      {item && deleted !== null && deleted === item.version && (
        <Confirm
          title="Eintrag löschen?"
          description={item.name + ' wird aus dem Vorrat gelöscht.'}
          action="Endgültig löschen"
          cancel={() => setDeleted(null)}
          confirm={() => {
            setDeleted(null);
            void write.submit(
              'delete_item',
              { ...context, id: item.id, v: deleted, confirm: true },
              item.name,
              item.name + ' wurde gelöscht.',
              () => void navigate('/inventory'),
            );
          }}
        />
      )}
    </>
  );
}
