import { isEan13 } from '../barcode/ean';
import { FormError, nameValue } from '../../lib/operations/protocol';

export const categories = [
  'Früchte/Gemüse',
  'Fleisch/Fisch',
  'Brot/Backwaren',
  'Trockenwaren',
  'Getränke',
  'Milchprodukte',
  'Sonstiges',
] as const;
export const units = ['Stück', 'Packung', 'kg', 'Liter'] as const;
export const locations = [
  'Kühlschrank',
  'Gefrierfach',
  'Vorratsschrank',
  'Sonstiges',
] as const;
export const dateTypes = ['MHD', 'Verbrauchsdatum', 'unbekannt'] as const;
export function compatible(category: string, unit: string) {
  return (
    categories.some((c) => c === category) &&
    units.some((u) => u === unit) &&
    (unit === 'kg'
      ? category !== 'Getränke'
      : unit !== 'Liter' ||
        ['Getränke', 'Milchprodukte', 'Sonstiges'].includes(category))
  );
}
export function decimal(raw: string, unit: string, zero = false) {
  if (!/^\d+(?:[.,]\d{1,3})?$/.test(raw))
    throw new FormError(
      'Gib eine Menge mit höchstens drei Nachkommastellen ein.',
    );
  const [whole, fraction = ''] = raw.replace(',', '.').split('.');
  const normalized = whole.replace(/^0+(?=\d)/, '');
  const part = fraction.replace(/0+$/, '');
  if (
    normalized.length > 4 ||
    (normalized === '9999' && part) ||
    (!zero && normalized === '0' && !part)
  )
    throw new FormError(
      'Die Menge muss ' +
        (zero
          ? 'zwischen 0 und 9999 liegen.'
          : 'grösser als 0 und höchstens 9999 sein.'),
    );
  if (part && (unit === 'Stück' || unit === 'Packung'))
    throw new FormError(
      'Für Stück und Packungen sind nur ganze Mengen möglich.',
    );
  return normalized + (part ? '.' + part : '');
}
export function millis(value: string | number) {
  const [n, f = ''] = String(value).split('.');
  return Number(n) * 1000 + Number(f.padEnd(3, '0'));
}
export function fromMillis(n: number) {
  return (
    String(Math.floor(n / 1000)) +
    (n % 1000
      ? '.' +
        String(n % 1000)
          .padStart(3, '0')
          .replace(/0+$/, '')
      : '')
  );
}
export function quantity(value: string | number, unit: string) {
  return (
    String(value).replace('.', ',') +
    ' ' +
    (unit === 'Packung' && millis(value) !== 1000 ? 'Packungen' : unit)
  );
}
const zurich = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Zurich',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export const today = (instant = new Date()) => zurich.format(instant);
function ordinal(iso: string) {
  return Date.parse(iso + 'T00:00:00Z') / 86400000;
}
export function validDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso.startsWith('0000')) return false;
  const d = new Date(iso + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}
export function yearsAfter(iso: string, years: number) {
  const target = String(Number(iso.slice(0, 4)) + years) + iso.slice(4);
  return validDate(target) ? target : target.slice(0, 8) + '28';
}
export function expiry(date: string | null, days: number, day: string) {
  if (!date)
    return { kind: 'unknown', urgent: false, text: 'Kein Datum erfasst' };
  const n = ordinal(date) - ordinal(day);
  return {
    kind: n < 0 ? 'overdue' : n === 0 ? 'today' : n <= days ? 'soon' : 'later',
    urgent: n <= days,
    text:
      n < 0
        ? 'Seit ' + (-n === 1 ? '1 Tag' : -n + ' Tagen') + ' überschritten'
        : n === 0
          ? 'Heute'
          : n === 1
            ? 'Morgen'
            : 'In ' + n + ' Tagen',
  };
}
export const showDate = (date: string) => date.split('-').reverse().join('.');
export const dateLabel = (type: string | null) =>
  type === 'unbekannt' ? 'Datumsart unbekannt' : type;
export const defaults = {
  name: '',
  quantity: '1',
  unit: 'Stück',
  category: 'Sonstiges',
  location: '',
  expiry_date: '',
  date_type: '',
  barcode: '',
};
export type Draft = typeof defaults;
export type CaptureInput = {
  barcode: string;
  lookup:
    | { outcome: 'unknown' | 'unavailable' }
    | {
        outcome: 'verified';
        name?: string;
        category?: (typeof categories)[number];
      };
};
export function captureDraft(seed?: CaptureInput): Draft {
  const verified =
    seed?.lookup.outcome === 'verified' ? seed.lookup : undefined;
  return {
    ...defaults,
    barcode: seed?.barcode ?? '',
    name: verified?.name ?? '',
    category: verified?.category ?? defaults.category,
  };
}
export function validate(
  d: Draft,
  ack: boolean,
  stored: string | null,
  day = today(),
) {
  const errors: Partial<Record<keyof Draft, string>> = {};
  let name = '',
    amount = '';
  try {
    name = nameValue(d.name);
  } catch {
    errors.name = 'Gib einen Produktnamen mit 1 bis 100 Zeichen ein.';
  }
  try {
    amount = decimal(d.quantity, d.unit);
  } catch (e) {
    errors.quantity = e instanceof Error ? e.message : 'Menge prüfen.';
  }
  if (!compatible(d.category, d.unit))
    errors.unit =
      'Wähle eine passende Einheit für diese Kategorie und prüfe die Menge.';
  if (d.location && !locations.some((v) => v === d.location))
    errors.location = 'Wähle einen Lagerort aus der Liste.';
  if (d.barcode && !isEan13(d.barcode))
    errors.barcode = 'Gib 13 Ziffern mit gültiger EAN-Prüfziffer ein.';
  if (
    d.expiry_date &&
    (!validDate(d.expiry_date) || d.expiry_date > yearsAfter(day, 20))
  )
    errors.expiry_date =
      'Prüfe das Kalenderdatum. Es darf höchstens 20 Jahre in der Zukunft liegen.';
  if (d.expiry_date ? !dateTypes.some((t) => t === d.date_type) : !!d.date_type)
    errors.date_type = 'Prüfe Datum und Datumsart zusammen.';
  const needsAck =
    !!d.expiry_date &&
    !errors.expiry_date &&
    stored !== d.expiry_date &&
    d.expiry_date > yearsAfter(day, 5);
  if (needsAck && !ack)
    errors.expiry_date = 'Prüfe und bestätige das weit entfernte Datum.';
  const fields = {
    name,
    quantity: amount,
    unit: d.unit,
    category: d.category,
    location: d.location || null,
    barcode: d.barcode || null,
    expiry_date: d.expiry_date || null,
    date_type: d.date_type || null,
  };
  return { fields, errors, needsAck };
}
