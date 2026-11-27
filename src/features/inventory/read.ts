import { activeScope, refresh } from '../auth/session';
import { backend } from '../../lib/supabase/client';
import { FlowError } from '../../lib/operations/protocol';
import { compatible } from './domain';
export function inventoryScope(requestSignal?: AbortSignal) {
  const scope = activeScope();
  const { household, generation, user, jwt } = scope;
  if (!household || !generation || !user || !jwt || scope.signal.aborted)
    throw new FlowError('FORBIDDEN');
  return { ...scope, household, generation, user, jwt, requestSignal };
}
export type Scope = ReturnType<typeof inventoryScope>;
export function isCurrent(s: Scope) {
  const now = activeScope();
  return (
    !s.signal.aborted &&
    !s.requestSignal?.aborted &&
    now.signal === s.signal &&
    now.household === s.household &&
    now.generation === s.generation &&
    now.user === s.user
  );
}
function checked<T>(
  s: Scope,
  result: { data: T | null; error: unknown; status?: number },
): T {
  if (!isCurrent(s)) throw new FlowError('FORBIDDEN');
  if (result.status === 401 || result.status === 403) {
    void refresh(true);
    throw new FlowError('FORBIDDEN');
  }
  if (result.error || result.data === null)
    throw new Error('Daten konnten nicht geladen werden.');
  return result.data;
}
const columns =
  'id,household_id,name,quantity,unit,category,location,expiry_date,date_type,barcode,version,reserved_quantity,own_quantity,free_quantity,consumable_quantity';
const inventory = (s: Scope) =>
  backend()
    .from('active_inventory')
    .select(columns)
    .eq('household_id', s.household);
type InventoryRows = NonNullable<Awaited<ReturnType<typeof inventory>>['data']>;
function item(s: Scope, row: InventoryRows[number]) {
  const {
    reserved_quantity,
    own_quantity,
    free_quantity,
    consumable_quantity,
  } = row;
  if (
    row.household_id !== s.household ||
    !row.id ||
    !row.name ||
    !compatible(row.category, row.unit) ||
    !Number.isSafeInteger(row.version) ||
    reserved_quantity === null ||
    own_quantity === null ||
    free_quantity === null ||
    consumable_quantity === null
  )
    throw new Error('Unvollständiger Vorratseintrag.');
  return {
    ...row,
    reserved_quantity,
    own_quantity,
    free_quantity,
    consumable_quantity,
  };
}
export type Item = ReturnType<typeof item>;
export async function pages<T extends { id: string }>(
  load: (after: string) => Promise<T[]>,
) {
  const all: T[] = [];
  let last = '';
  for (;;) {
    const rows = await load(last);
    all.push(...rows);
    if (rows.length < 100) return all;
    const next = rows[rows.length - 1].id;
    if (next <= last) throw new Error('Ungültige Seitenfolge.');
    last = next;
  }
}
const signal = (s: Scope) =>
  AbortSignal.any([
    s.signal,
    s.requestSignal ?? s.signal,
    AbortSignal.timeout(12000),
  ]);
export async function readInventory(s: Scope) {
  return pages(async (after) => {
    let q = inventory(s);
    if (after) q = q.gt('id', after);
    return checked(
      s,
      await q
        .order('id')
        .limit(100)
        .setHeader('Authorization', 'Bearer ' + s.jwt)
        .abortSignal(signal(s)),
    ).map((r) => item(s, r));
  });
}
export async function readItem(s: Scope, id: string) {
  if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) return null;
  const rows = checked(
    s,
    await inventory(s)
      .eq('id', id)
      .limit(1)
      .setHeader('Authorization', 'Bearer ' + s.jwt)
      .abortSignal(signal(s)),
  );
  return rows.length ? item(s, rows[0]) : null;
}
export type Owner = { name: string; quantity: number; user: string };
export async function readOwners(s: Scope, items: Item[]) {
  const owners: Record<string, Owner[]> = {};
  // Pro sichtbarer Gruppe bündeln. Alle abhängigen Seiten vor der Versionsprüfung laden.
  if (items.length > 40) {
    for (let start = 0; start < items.length; start += 40)
      Object.assign(
        owners,
        await readOwners(s, items.slice(start, start + 40)),
      );
    return owners;
  }
  const ids = items.filter((i) => i.reserved_quantity > 0).map((i) => i.id);
  if (!ids.length) return owners;
  const rows = await pages(async (after) => {
    let q = backend()
      .from('reservations')
      .select('id,inventory_item_id,user_id,quantity')
      .eq('household_id', s.household)
      .in('inventory_item_id', ids);
    if (after) q = q.gt('id', after);
    return checked(
      s,
      await q
        .order('id')
        .limit(100)
        .setHeader('Authorization', 'Bearer ' + s.jwt)
        .abortSignal(signal(s)),
    );
  });
  const users = [...new Set(rows.map((r) => r.user_id))],
    names = new Map<string, string>();
  for (let i = 0; i < users.length; i += 100) {
    const profiles = checked(
      s,
      await backend()
        .from('profiles')
        .select('id,display_name')
        .in('id', users.slice(i, i + 100))
        .setHeader('Authorization', 'Bearer ' + s.jwt)
        .abortSignal(signal(s)),
    );
    for (const p of profiles) names.set(p.id, p.display_name);
  }
  const versions = checked(
    s,
    await backend()
      .from('active_inventory')
      .select('id,version')
      .eq('household_id', s.household)
      .in('id', ids)
      .setHeader('Authorization', 'Bearer ' + s.jwt)
      .abortSignal(signal(s)),
  );
  if (
    ids.some(
      (id) =>
        !versions.some(
          (v) =>
            v.id === id &&
            v.version === items.find((i) => i.id === id)?.version,
        ),
    )
  )
    throw new FlowError('STALE');
  for (const r of rows) {
    const name = names.get(r.user_id);
    if (!name) throw new Error('Anzeigename fehlt.');
    (owners[r.inventory_item_id] ??= []).push({
      name,
      user: r.user_id,
      quantity: r.quantity,
    });
  }
  if (ids.some((id) => !owners[id])) throw new FlowError('STALE');
  return owners;
}
export const sorted = (rows: Item[]) =>
  [...rows].sort(
    (a, b) =>
      (a.expiry_date ?? '99999').localeCompare(b.expiry_date ?? '99999') ||
      a.name.localeCompare(b.name, 'de-CH') ||
      a.id.localeCompare(b.id),
  );
export const matches = (name: string, query: string) =>
  name
    .toLocaleLowerCase('de-CH')
    .includes(query.trim().toLocaleLowerCase('de-CH'));
