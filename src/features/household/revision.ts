import { backend } from '../../lib/supabase/client';
import { checked, requestSignal, type Scope } from '../inventory/read';

export async function readRevision(scope: Scope) {
  const row = checked(
    scope,
    await backend()
      .from('household_signals')
      .select('revision::text')
      .eq('id', scope.household)
      .setHeader('Authorization', 'Bearer ' + scope.jwt)
      .abortSignal(requestSignal(scope))
      .single()
      .overrideTypes<{ revision: string }, { merge: false }>(),
  );
  if (!row) throw new Error('Haushaltssignal nicht verfügbar.');
  return BigInt(row.revision);
}

// Im montierten Haushalt prüfen alle sichtbaren Teilabfragen dieselbe Revision.
export const synchronizedScopes = new WeakSet<AbortSignal>();
export async function consistentRead<T>(
  scope: Scope,
  load: (scope: Scope) => Promise<T>,
) {
  if (!synchronizedScopes.has(scope.signal)) return load(scope);
  for (let attempt = 0; attempt < 4; attempt++) {
    const before = await readRevision(scope);
    const value = await load(scope);
    if ((await readRevision(scope)) === before) return value;
  }
  throw new Error('Der Haushalt hat sich während des Ladens geändert.');
}
