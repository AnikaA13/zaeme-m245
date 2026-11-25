import type { Database } from '../../database.types';
import { backend } from '../supabase/client';
import {
  activeScope,
  logout,
  operations,
  refresh,
} from '../../features/auth/session';
import { FlowError, interpret } from './protocol';
type Functions = Database['public']['Functions'];
type Query = 'list_invites' | 'preview_invite';
type Mutation = Exclude<keyof Functions, Query | 'set_warning_days'>;
const inviteBudget = new WeakMap<AbortSignal, number>();
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
  try {
    return await call(name, args);
  } catch (e) {
    if (
      e instanceof FlowError &&
      ['FORBIDDEN', 'AUTH_REQUIRED'].includes(e.code)
    )
      await refresh(true);
    throw e;
  }
}
export async function mutate<K extends Mutation>(
  name: K,
  args: Omit<Functions[K]['Args'], 'op'>,
) {
  const scope = activeScope();
  try {
    const result = await operations.execute(name, args, (op) =>
      call(name, { ...args, op } as Functions[K]['Args']),
    );
    await refresh(true);
    return result;
  } catch (e) {
    if (!scope.signal.aborted) await refresh(true);
    throw e;
  }
}
