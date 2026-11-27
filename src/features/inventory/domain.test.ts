import { describe, it, expect } from 'vitest';
import fixtures from '../../../fixtures/inventory-validation.json';
import {
  captureDraft,
  decimal,
  defaults,
  expiry,
  fromMillis,
  millis,
  quantity,
  today,
  validate,
  yearsAfter,
} from './domain';
import { matches, pages, sorted, type Item } from './read';
describe('Exakte Mengen', () => {
  it.each(fixtures.swissInputs)('$raw $unit', ({ raw, unit, normalized }) => {
    if (normalized === null) expect(() => decimal(raw, unit)).toThrow();
    else {
      expect(decimal(raw, unit)).toBe(normalized);
      expect(fromMillis(millis(normalized))).toBe(normalized);
    }
  });
  it.each(fixtures.reservations)(
    'Ziel $desired bei $stock $unit',
    ({ desired, stock, unit, code }) => {
      if (code === 'INVALID')
        expect(() => decimal(desired, unit, true)).toThrow();
      else
        expect(millis(decimal(desired, unit, true)) > millis(stock)).toBe(
          code === 'INSUFFICIENT',
        );
    },
  );
  it('beugt Packung und behält die Präzision', () => {
    expect(quantity(1, 'Packung')).toBe('1 Packung');
    expect(quantity(2, 'Packung')).toBe('2 Packungen');
    expect(quantity(0.001, 'kg')).toBe('0,001 kg');
  });
});
const comparable = fixtures.items.filter(
  (test) =>
    Object.entries(test.fields).every(
      ([key, v]) => key in defaults && typeof v === 'string',
    ) && test.label !== 'Komma an API',
);
it.each(comparable)('Gemeinsame Felddaten · $label', ({ fields, valid }) => {
  const result = validate(
    {
      ...defaults,
      name: 'Birne',
      ...Object.fromEntries(Object.entries(fields)),
    },
    false,
    null,
    '2026-01-01',
  );
  expect(Object.keys(result.errors).length === 0).toBe(valid);
});
it('prüft zukünftige Daten an beiden inklusiven Grenzen', () => {
  for (const { years, days, ack, code } of fixtures.expiry) {
    const date = String(2026 + years) + '-01-0' + String(days + 1);
    const result = validate(
      { ...defaults, name: 'Tee', expiry_date: date, date_type: 'MHD' },
      ack,
      null,
      '2026-01-01',
    );
    expect(!!result.errors.expiry_date).toBe(!!code);
  }
  expect(
    validate(
      { ...defaults, name: 'Tee', expiry_date: '2036-12-31', date_type: 'MHD' },
      false,
      '2036-12-31',
      '2026-01-01',
    ).errors,
  ).toEqual({});
  expect(yearsAfter('2024-02-29', 5)).toBe('2029-02-28');
});
it.each([0, 3, 7, 30])('inklusive Warnfrist %i', (days) => {
  const base = '2026-01-01',
    date = (n: number) => '2026-01-' + String(1 + n).padStart(2, '0');
  expect(expiry('2025-12-31', days, base).kind).toBe('overdue');
  expect(expiry(base, days, base).kind).toBe('today');
  expect(expiry(date(days), days, base).urgent).toBe(true);
  expect(
    expiry(days === 30 ? '2026-02-01' : date(days + 1), days, base).urgent,
  ).toBe(false);
  expect(expiry(null, days, base).kind).toBe('unknown');
});
it.each([
  ['2026-03-28T23:00:00Z', '2026-03-29', '2026-03-30'],
  ['2026-10-24T22:00:00Z', '2026-10-25', '2026-10-26'],
  ['2024-02-28T23:00:00Z', '2024-02-29', '2024-03-01'],
])('Zürcher Kalendertag %s', (instant, day, next) => {
  expect(today(new Date(instant))).toBe(day);
  expect(expiry(next, 3, day).text).toBe('Morgen');
});
it('trennt Barcode und bestätigte Metadaten', () => {
  expect(
    captureDraft({ barcode: '0123456789012', lookup: { outcome: 'unknown' } }),
  ).toEqual({ ...defaults, barcode: '0123456789012' });
  expect(
    captureDraft({
      barcode: '0123456789012',
      lookup: { outcome: 'verified', name: 'Milch' },
    }).name,
  ).toBe('Milch');
});
it('sucht literale Sonderzeichen ohne Berücksichtigung der Grossschreibung', () => {
  expect(matches('Öl 5%_', ' ÖL 5%_ ')).toBe(true);
  expect(matches('Öl', '%')).toBe(false);
  expect(matches('Öl', '_')).toBe(false);
});
it('sortiert datierte Chargen vor unbekannten mit stabilem Namen und ID', () => {
  const rows = ['b', 'a', 'c', 'd'].map(
    (id, index) =>
      ({
        id,
        name: index === 2 ? 'Apfel' : 'Milch',
        expiry_date: index === 3 ? null : '2026-11-27',
      }) as Item,
  );
  expect(sorted(rows).map((i) => i.id)).toEqual(['c', 'a', 'b', 'd']);
});
it('liest 1101 Zeilen mit exklusivem ID-Cursor', async () => {
  const rows = Array.from({ length: 1101 }, (_, i) => ({
    id: String(i).padStart(4, '0'),
  }));
  expect(
    await pages(async (cursor) =>
      rows.filter((i) => i.id > cursor).slice(0, 100),
    ),
  ).toEqual(rows);
});
