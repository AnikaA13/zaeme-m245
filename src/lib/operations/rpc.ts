import type { Database } from '../../database.types';
import { inventoryScope } from '../../features/inventory/read';
import { readShopping } from '../../features/shopping/read';
import { backend } from '../supabase/client';
import {
  activeScope,
  logout,
  operations,
  refresh,
  snapshot,
} from '../../features/auth/session';
import { FlowError, interpret, PendingDecision } from './protocol';
type Functions = Database['public']['Functions'];
type Query = 'list_invites' | 'preview_invite';
type Inventory =
  | 'create_item'
  | 'edit_item'
  | 'set_reservation'
  | 'consume_item'
  | 'delete_item';
export type ShoppingMutation =
  'create_shopping' | 'edit_shopping' | 'check_shopping' | 'delete_shopping';
type Mutation =
  | ShoppingMutation
  | 'set_warning_days'
  | Inventory
  | 'create_household'
  | 'join_household'
  | 'create_invite'
  | 'revoke_invite'
  | 'save_profile'
  | 'remove_member'
  | 'leave_household'
  | 'dissolve_household';
export type Payloads = { [K in Mutation]: Omit<Functions[K]['Args'], 'op'> };
const inventory: ReadonlySet<string> = new Set<Inventory>([
  'create_item',
  'edit_item',
  'set_reservation',
  'consume_item',
  'delete_item',
]);
function operationKey(name: Mutation, args: object) {
  const resource = 'id' in args ? args.id : 'target' in args ? args.target : '';
  return JSON.stringify([name, resource]);
}
const inviteBudget = new WeakMap<AbortSignal, number>();
function mutationScope(args: object) {
  const scope = activeScope();
  if (!scope.user || scope.signal.aborted) throw new FlowError('AUTH_REQUIRED');
  if (
    ('h' in args && args.h !== scope.household) ||
    ('g' in args && args.g !== scope.generation)
  )
    throw new FlowError('FORBIDDEN');
  return scope;
}
async function reconcile(
  name: Mutation,
  args: object,
  scope: ReturnType<typeof activeScope>,
) {
  if (scope.signal.aborted) throw new FlowError('FORBIDDEN');
  await refresh(true);
  if (scope.signal.aborted) throw new FlowError('FORBIDDEN');
  if (snapshot().phase !== 'ready') throw new FlowError('TRANSPORT');
  if (name.endsWith('_shopping')) {
    return readShopping(inventoryScope());
  }
  if (!inventory.has(name)) return [];
  if (!scope.household || !scope.jwt) throw new FlowError('FORBIDDEN');
  let read = backend()
    .from('active_inventory')
    .select('id,quantity,version,own_quantity,free_quantity')
    .eq('household_id', scope.household);
  if ('id' in args && typeof args.id === 'string')
    read = read.eq('id', args.id);
  const { data, error } = await read
    .order('id')
    .limit(100)
    .setHeader('Authorization', 'Bearer ' + scope.jwt)
    .abortSignal(AbortSignal.any([scope.signal, AbortSignal.timeout(12000)]));
  if (scope.signal.aborted) throw new FlowError('FORBIDDEN');
  if (error) throw new FlowError('TRANSPORT');
  return data;
}

// Nach Prüfung des Fachzustands kann der Aufrufer den offenen Versuch bewusst
// abschliessen. Die Rückgabe ist an genau diese ID und Mitgliedschaft gebunden.
export async function reviewPending<K extends Mutation>(
  name: K,
  args: Payloads[K],
) {
  const scope = mutationScope(args),
    key = operationKey(name, args),
    op = operations.unresolved(key);
  if (!op) throw new FlowError('RETRY');
  const items = await reconcile(name, args, scope);
  return {
    op,
    items,
    resolve() {
      if (scope.signal.aborted) throw new FlowError('FORBIDDEN');
      operations.resolve(key, op);
    },
  };
}
async function call<K extends keyof Functions>(
  name: K,
  args: Functions[K]['Args'],
) {
  const scope = activeScope();
  if (!scope.user || !scope.jwt || scope.signal.aborted)
    throw new FlowError('AUTH_REQUIRED');
  const usesBudget = name === 'preview_invite' || name === 'join_household';
  const seconds = Math.ceil(
    ((inviteBudget.get(scope.signal) ?? 0) - Date.now()) / 1000,
  );
  if (usesBudget && seconds > 0) throw new FlowError('RATE_LIMITED', seconds);
  try {
    const reply = await backend()
      .rpc(name, args)
      .retry(false)
      .setHeader('Authorization', 'Bearer ' + scope.jwt)
      .abortSignal(AbortSignal.any([scope.signal, AbortSignal.timeout(12000)]));
    if (scope.signal.aborted) throw new FlowError('FORBIDDEN');
    const result = interpret(reply);
    if (name.endsWith('_shopping') || name === 'set_warning_days') {
      if (
        !result.id ||
        !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(result.id) ||
        ('id' in args && result.id !== args.id) ||
        (name === 'set_warning_days' && result.id !== scope.household) ||
        (name === 'delete_shopping'
          ? result.version !== null
          : !Number.isSafeInteger(result.version) ||
            (result.version ?? 0) < 1) ||
        (name === 'create_shopping' && result.version !== 1) ||
        ('v' in args &&
          name !== 'delete_shopping' &&
          result.version !== args.v + 1 &&
          (name === 'set_warning_days' || result.version !== args.v))
      )
        throw new FlowError('TRANSPORT');
    }
    if (
      inventory.has(name) &&
      (!result.id ||
        !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(result.id) ||
        ('id' in args && result.id !== args.id) ||
        (name === 'create_item' && result.version !== 1) ||
        (name === 'edit_item' &&
          'v' in args &&
          result.version !== args.v + 1) ||
        (name === 'delete_item'
          ? result.version !== null
          : !Number.isSafeInteger(result.version) || (result.version ?? 0) < 1))
    )
      throw new FlowError('TRANSPORT');
    if (
      (name === 'preview_invite' && !result.household_name) ||
      (name === 'list_invites' && !result.invites) ||
      ([
        'create_household',
        'create_invite',
        'join_household',
        'remove_member',
        'revoke_invite',
        'save_profile',
      ].includes(name) &&
        !result.id) ||
      (name === 'create_invite' && !result.expires_at) ||
      (name === 'save_profile' && !result.version)
    )
      throw new FlowError('TRANSPORT');
    return result;
  } catch (e) {
    if (e instanceof FlowError) {
      if (usesBudget && e.code === 'RATE_LIMITED')
        inviteBudget.set(scope.signal, Date.now() + e.seconds * 1000);
      if (e.code === 'AUTH_REQUIRED' && !scope.signal.aborted) {
        const { data, error } = await backend().auth.getUser();
        if (
          !scope.signal.aborted &&
          ((!error && !data.user?.email_confirmed_at) ||
            error?.status === 401 ||
            error?.status === 403 ||
            error?.name === 'AuthSessionMissingError')
        )
          await logout();
      }
      throw e;
    }
    throw new FlowError('TRANSPORT');
  }
}
export async function query<K extends Query>(
  name: K,
  args: Functions[K]['Args'],
) {
  const scope = activeScope();
  try {
    return await call(name, args);
  } catch (e) {
    if (
      e instanceof FlowError &&
      !scope.signal.aborted &&
      ['FORBIDDEN', 'AUTH_REQUIRED'].includes(e.code)
    )
      await refresh(true);
    throw e;
  }
}
export async function mutate<K extends Mutation>(name: K, args: Payloads[K]) {
  const scope = mutationScope(args);
  const payload = structuredClone(args);
  try {
    return await operations.execute(
      operationKey(name, payload),
      payload,
      (op) =>
        // Payloads[K] entfernt ausschliesslich op aus genau dieser generierten
        // Signatur. TypeScript kann Omit bei generischem K nicht zurückführen.
        call(name, { ...payload, op } as Functions[K]['Args']),
      (result) => verifyCompletion(name, scope, result.id),
    );
  } catch (e) {
    if (!scope.signal.aborted) {
      if (
        e instanceof FlowError &&
        ['OP_EXPIRED', 'OP_MISMATCH', 'UNRESOLVED'].includes(e.code)
      ) {
        const review = await reviewPending(name, payload);
        throw new PendingDecision(e.code, review.resolve);
      }
      if (e instanceof FlowError && e.code === 'TRANSPORT') {
        await reconcile(name, payload, scope);
      } else await refresh(true);
    }
    throw e;
  }
}
async function verifyCompletion(
  name: Mutation,
  scope: ReturnType<typeof activeScope>,
  id: string | null,
) {
  if (scope.signal.aborted) throw new FlowError('FORBIDDEN');
  await refresh(true);
  const current = activeScope();
  if (current.epoch !== scope.epoch) throw new FlowError('FORBIDDEN');
  if (snapshot().phase !== 'ready') throw new FlowError('REFRESH_FAILED');
  const entering = name === 'create_household' || name === 'join_household';
  const leaving = name === 'leave_household' || name === 'dissolve_household';
  if (entering || leaving) {
    if (
      current.revision === scope.revision + 1 &&
      (entering
        ? scope.generation === null &&
          current.household === id &&
          current.generation !== null
        : scope.generation !== null && current.generation === null)
    )
      return;
    throw new FlowError('FORBIDDEN');
  }
  if (scope.signal.aborted) throw new FlowError('FORBIDDEN');
  if (name.endsWith('_shopping')) {
    try {
      await readShopping(inventoryScope());
    } catch {
      throw new FlowError(
        scope.signal.aborted ? 'FORBIDDEN' : 'REFRESH_FAILED',
      );
    }
  }
}
