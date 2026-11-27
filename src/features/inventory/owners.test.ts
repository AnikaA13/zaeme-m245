import { afterEach, expect, it, vi } from 'vitest';
import * as auth from '../auth/session';
import * as client from '../../lib/supabase/client';
import { inventoryScope, readOwners, type Item } from './read';
afterEach(() => vi.restoreAllMocks());
function setup(version: number) {
  const scope = {
    ...auth.activeScope(),
    user: 'a',
    household: 'h',
    generation: 'g',
    jwt: 'fixture',
  };
  vi.spyOn(auth, 'activeScope').mockReturnValue(scope);
  const reservations = Array.from({ length: 205 }, (_, i) => ({
    id: String(i).padStart(3, '0'),
    inventory_item_id: 'batch',
    user_id: 'p' + i,
    quantity: 1,
  }));
  const cursors: string[] = [];
  function from(table: string) {
    let cursor = '',
      ids: string[] = [];
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      setHeader: () => builder,
      gt: (_k: string, v: string) => {
        cursor = v;
        return builder;
      },
      in: (_k: string, v: string[]) => {
        ids = v;
        return builder;
      },
      abortSignal: async () => {
        if (table === 'reservations') {
          cursors.push(cursor);
          return {
            data: reservations.filter((r) => r.id > cursor).slice(0, 100),
            error: null,
          };
        }
        if (table === 'profiles')
          return {
            data: ids.map((id) => ({ id, display_name: 'Person ' + id })),
            error: null,
          };
        return { data: [{ id: 'batch', version }], error: null };
      },
    };
    return builder;
  }
  // Isolierter Test-Adapter bildet ausschliesslich die verwendeten PostgREST-Filter nach.
  vi.spyOn(client, 'backend').mockReturnValue({ from } as unknown as ReturnType<
    typeof client.backend
  >);
  return {
    scope: inventoryScope(),
    cursors,
    item: { id: 'batch', version: 1, reserved_quantity: 205 } as Item,
  };
}
it('liest alle 205 Reservierungen mit exklusiven Cursorn und gruppierten Profilen', async () => {
  const { scope, cursors, item } = setup(1);
  const owners = await readOwners(scope, [item]);
  expect(cursors).toEqual(['', '099', '199']);
  expect(owners.batch).toHaveLength(205);
  expect(owners.batch[204].name).toBe('Person p204');
});
it('verwirft alle abhängigen Seiten bei geänderter Version', async () => {
  const { scope, item } = setup(2);
  await expect(readOwners(scope, [item])).rejects.toMatchObject({
    code: 'STALE',
  });
});
