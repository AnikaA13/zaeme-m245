import type { CompositeTypes } from '../../database.types';
export class FormError extends Error {}
export function nameValue(input: string) {
  const name = input.replace(/^[\s\u0085]+|[\s\u0085]+$/gu, '');
  if (!name || [...name].length > 100 || name.includes('\0'))
    throw new FormError('Gib einen Namen mit 1 bis 100 Zeichen ein.');
  return name;
}
export function passwordValid(value: string) {
  return [...value].length >= 8;
}
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (n) => n.toString(16).padStart(2, '0')).join('');
export function operationId(ms = Date.now()) {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ms % 256;
    ms = Math.floor(ms / 256);
  }
  bytes[6] = (bytes[6] & 15) | 112;
  bytes[8] = (bytes[8] & 63) | 128;
  const id = hex(bytes);
  return [
    id.slice(0, 8),
    id.slice(8, 12),
    id.slice(12, 16),
    id.slice(16, 20),
    id.slice(20),
  ].join('-');
}
export const validToken = (token: string) =>
  /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(token);
export async function invitation(
  bytes = crypto.getRandomValues(new Uint8Array(32)),
) {
  const token = btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  return {
    token,
    hash:
      '\\x' + hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))),
  };
}
const messages: Record<string, string> = {
  AUTH_REQUIRED: 'Deine Sitzung ist abgelaufen. Melde dich erneut an.',
  FORBIDDEN: 'Dir fehlt die Berechtigung. Der Zugang wird neu geprüft.',
  NOT_FOUND: 'Dieser Eintrag ist nicht mehr verfügbar.',
  INVALID: 'Bitte überprüfe deine Eingabe.',
  STALE:
    'Die Daten wurden geändert. Prüfe den aktuellen Stand und bestätige erneut.',
  CONFIRM_REQUIRED: 'Bitte bestätige diesen Vorgang.',
  OWNER_BOUND: 'Der Haushalt kann so nicht verlassen oder aufgelöst werden.',
  ALREADY_MEMBER: 'Du gehörst bereits zu einem Haushalt.',
  INVITE_INVALID:
    'Diese Einladung ist ungültig, abgelaufen oder widerrufen. Bitte die Person, die den Haushalt verwaltet, um eine neue Einladung.',
  RATE_LIMITED: 'Zu viele Versuche.',
  HASH_EXISTS: 'Erstelle eine neue Einladung.',
  OP_MISMATCH:
    'Die Anfrage passt nicht zur ursprünglichen Aktion. Prüfe den aktuellen Stand.',
  OP_EXPIRED: 'Die Anfrage ist abgelaufen. Prüfe den aktuellen Stand.',
  RETRY: 'Bitte versuche dieselbe Aktion erneut.',
  TRANSPORT:
    'Die Antwort fehlt. Prüfe die Verbindung und versuche dieselbe Aktion erneut.',
};
export class FlowError extends FormError {
  constructor(
    readonly code: string,
    readonly seconds = 0,
  ) {
    super(
      (messages[code] ?? 'Die Aktion konnte nicht bestätigt werden.') +
        (seconds ? ' Versuche es in ' + seconds + ' Sekunden erneut.' : ''),
    );
  }
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const optional = (value: unknown, kind: 'number' | 'string') =>
  value === null || typeof value === kind;
function result(value: unknown): value is CompositeTypes<'rpc_result'> {
  return (
    record(value) &&
    typeof value.ok === 'boolean' &&
    (value.ok ? value.code === null : typeof value.code === 'string') &&
    ['id', 'expires_at', 'household_name'].every((k) =>
      optional(value[k], 'string'),
    ) &&
    ['version', 'retry_after'].every((k) => optional(value[k], 'number')) &&
    (value.invites === null ||
      (Array.isArray(value.invites) &&
        value.invites.every(
          (i) =>
            record(i) &&
            ['id', 'created_at', 'expires_at'].every(
              (k) => typeof i[k] === 'string',
            ) &&
            optional(i.revoked_at, 'string'),
        )))
  );
}
export function interpret(reply: {
  data: unknown;
  error: unknown;
  status: number;
}) {
  if (reply.error)
    throw new FlowError(
      reply.status === 401
        ? 'AUTH_REQUIRED'
        : reply.status === 403
          ? 'FORBIDDEN'
          : 'TRANSPORT',
    );
  const r = reply.data;
  if (!result(r)) throw new FlowError('TRANSPORT');
  if (!r.ok)
    throw new FlowError(
      r.code!,
      typeof r.retry_after === 'number' ? Math.max(0, r.retry_after) : 0,
    );
  return r;
}
export class Operations {
  private pending = new Map<
    string,
    { key: string; id: string; busy: boolean }
  >();
  clear() {
    this.pending.clear();
  }
  async execute<T>(
    action: string,
    payload: unknown,
    send: (id: string) => Promise<T>,
  ) {
    const key = JSON.stringify(payload);
    let entry = this.pending.get(action);
    if (entry?.busy) throw new FlowError('RETRY');
    if (!entry || entry.key !== key) {
      entry = { key, id: operationId(), busy: false };
      this.pending.set(action, entry);
    }
    entry.busy = true;
    try {
      const result = await send(entry.id);
      if (this.pending.get(action) === entry) this.pending.delete(action);
      return result;
    } catch (e) {
      if (
        e instanceof FlowError &&
        !['TRANSPORT', 'RETRY', 'RATE_LIMITED'].includes(e.code) &&
        this.pending.get(action) === entry
      )
        this.pending.delete(action);
      throw e;
    } finally {
      entry.busy = false;
    }
  }
}
