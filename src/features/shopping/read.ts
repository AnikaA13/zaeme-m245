import { backend } from '../../lib/supabase/client';
import { checked, pages, requestSignal, type Scope } from '../inventory/read';

export async function readShopping(scope: Scope) {
  const groups = await Promise.all(
    [false, true].map((checkedState) =>
      pages(async (after) => {
        let query = backend()
          .from('shopping_items')
          .select(
            'id,household_id,name,quantity,unit,checked,version,created_at,updated_at',
          )
          .eq('household_id', scope.household)
          .eq('checked', checkedState);
        if (after) query = query.gt('id', after);
        return checked(
          scope,
          await query
            .order('id')
            .limit(100)
            .setHeader('Authorization', 'Bearer ' + scope.jwt)
            .abortSignal(requestSignal(scope)),
        );
      }),
    ),
  );
  return groups.flat();
}
export type ShoppingItem = Awaited<ReturnType<typeof readShopping>>[number];
