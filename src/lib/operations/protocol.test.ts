import { describe, it, expect, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { configuration } from '../supabase/client';
import {
  nameValue,
  invitation,
  operationId,
  interpret,
  FlowError,
  Operations,
  passwordValid,
  validToken,
} from './protocol';
import { intent, captureEntry } from '../../features/auth/intent';

describe('Konfiguration und Eingaben', () => {
  it('akzeptiert öffentliche Schlüssel auf Loopback und HTTPS', () => {
    expect(
      configuration('http://127.0.0.1:54321', 'sb_publishable_test'),
    ).toBeTruthy();
    for (const url of [
      undefined,
      'http://example.org',
      'https://example.org/?key=x',
    ])
      expect(configuration(url, 'sb_publishable_test')).toBeNull();
    expect(configuration('https://example.org', 'sb_secret_test')).toBeNull();
    expect(
      configuration(
        'https://example.org',
        'header.' + btoa('{"role":"service_role"}') + '.sign',
      ),
    ).toBeNull();
  });
  it('prüft Profil und Haushalt gemäss Unicode-Vertrag', () => {
    const long = '🍐'.repeat(100);
    expect(nameValue('\u0085 ' + long + '\ufeff')).toBe(long);
    for (const bad of ['\t', long + 'a', 'a\0'])
      expect(() => nameValue(bad)).toThrow();
  });
  it('prüft die Mindestlänge ohne Komplexitätsregeln', () => {
    expect(passwordValid('1234567')).toBe(false);
    expect(passwordValid('🍐'.repeat(8))).toBe(true);
  });
});
describe('RPC-Protokoll', () => {
  it('kodiert UUIDv7 mit 48-Bit-Zeit und RFC-Variante', () => {
    const id = operationId(0x019a0123abcd);
    expect(id).toMatch(
      /^019a0123-abcd-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(id).not.toBe(operationId(0x019a0123abcd));
  });
  it('hashiert Originalbytes und sendet kanonisches bytea', async () => {
    vi.stubGlobal('crypto', webcrypto);
    try {
      const value = await invitation(new Uint8Array(32));
      expect(value.token).toBe('A'.repeat(43));
      expect(validToken(value.token)).toBe(true);
      expect(validToken('A'.repeat(42) + 'B')).toBe(false);
      expect(value.hash).toBe(
        '\\x66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
  const data = {
    ok: true,
    code: null,
    id: null,
    expires_at: null,
    version: null,
    retry_after: null,
    household_name: null,
    invites: null,
  };
  it('trennt HTTP-Erfolg, Fachfehler, Transportfehler und ungültige Antworten', () => {
    expect(interpret({ data, error: null, status: 200 })).toEqual(data);
    expect(() =>
      interpret({
        data: { ...data, ok: false, code: 'RATE_LIMITED', retry_after: 19 },
        error: null,
        status: 200,
      }),
    ).toThrow('19 Sekunden');
    expect(() => interpret({ data, error: {}, status: 401 })).toThrow(
      'Sitzung',
    );
    for (const invalid of [
      null,
      [],
      { ok: true },
      { ...data, invites: [{ token: 'x' }] },
    ])
      expect(() =>
        interpret({ data: invalid, error: null, status: 200 }),
      ).toThrow('Antwort');
  });
  it('behält die op nach Verbindungsabbruch und blockiert Doppelklicks', async () => {
    const ops = new Operations();
    let id = '',
      finish!: () => void;
    const pending = ops.execute('a', 'b', async (op) => {
      id = op;
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      throw new FlowError('TRANSPORT');
    });
    await expect(ops.execute('a', 'b', async () => 1)).rejects.toThrow();
    finish();
    await expect(pending).rejects.toThrow();
    expect(await ops.execute('a', 'b', async (op) => op)).toBe(id);
    expect(await ops.execute('a', 'b', async (op) => op)).not.toBe(id);
  });
});
describe('Einladungsabsicht', () => {
  it('übernimmt das Fragment nur auf der Beitrittsroute', () => {
    intent.clear();
    captureEntry(new URL('https://app.test/#invite=' + 'A'.repeat(43)));
    expect(intent.get()).toBeNull();
    captureEntry(new URL('https://app.test/join#invite=' + 'A'.repeat(43)));
    expect(intent.get()?.token).toHaveLength(43);
    intent.forEmail('A@B.CH');
    intent.restore();
    expect(sessionStorage.length).toBe(0);
    intent.bind('u', 'a@b.ch');
    expect(intent.get()?.user).toBe('u');
    intent.bind('v', 'a@b.ch');
    expect(intent.get()).toBeNull();
  });
  it('verwirft abgelaufene und fremde Absichten', () => {
    vi.useFakeTimers();
    try {
      intent.set('create');
      intent.forEmail('a@b.ch');
      intent.restore();
      intent.bind('u', 'b@b.ch');
      expect(intent.get()).toBeNull();
      intent.set('join');
      vi.advanceTimersByTime(900001);
      expect(intent.get()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
  it('weist unerwartete oder mehrfache Callback-Parameter zurück', () => {
    expect(
      captureEntry(
        new URL('https://app.test/auth/reset-password?type=recovery'),
      )?.code,
    ).toBe('');
    expect(
      captureEntry(new URL('https://app.test/auth/callback?code=a&next=/'))
        ?.code,
    ).toBe('');
  });
});
