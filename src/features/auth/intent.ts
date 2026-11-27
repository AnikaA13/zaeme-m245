import { validToken } from '../../lib/operations/protocol';
type Intent = {
  purpose: 'join' | 'create';
  token: string;
  until: number;
  email?: string;
  user?: string;
};
const key = 'zaeme-email-intent';
const lifetime = 15 * 60_000;
let current: Intent | null = null;
export const intent = {
  set(purpose: Intent['purpose'], token = '') {
    this.clear();
    current = {
      purpose,
      token: validToken(token) ? token : '',
      until: Date.now() + lifetime,
    };
  },
  get() {
    if (current && current.until <= Date.now()) this.clear();
    return current;
  },
  bind(user: string, email: string | undefined) {
    const i = this.get();
    if (!i) return;
    if (
      (i.user && i.user !== user) ||
      (i.email && i.email !== email?.toLowerCase())
    )
      this.clear();
    else {
      i.user = user;
      sessionStorage.removeItem(key);
    }
  },
  forEmail(email: string) {
    const i = this.get();
    if (i) {
      i.email = email.trim().toLowerCase();
      sessionStorage.setItem(key, JSON.stringify(i));
    }
  },
  restore() {
    const raw = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    if (!raw) return;
    try {
      const i = JSON.parse(raw);
      if (
        (i.purpose === 'create' || i.purpose === 'join') &&
        typeof i.email === 'string' &&
        typeof i.token === 'string' &&
        (!i.token || validToken(i.token)) &&
        i.until > Date.now() &&
        i.until <= Date.now() + lifetime
      )
        current = i;
    } catch {
      /* Veralteten Eintrag verwerfen. */
    }
  },
  clear() {
    current = null;
    sessionStorage.removeItem(key);
  },
};
export function captureEntry(url: URL) {
  const path = url.pathname;
  if (path === '/join' && url.hash) {
    const value = new URLSearchParams(url.hash.slice(1)).get('invite') ?? '';
    intent.set('join', validToken(value) ? value : '');
  }
  if (path === '/auth/callback' || path === '/auth/reset-password') {
    const codes = url.searchParams.getAll('code');
    const valid =
      codes.length === 1 &&
      [...url.searchParams.keys()].every((k) => k === 'code') &&
      (!url.hash || url.hash === '#' || url.hash === '#_');
    return {
      code: valid ? codes[0] : '',
      recovery: path === '/auth/reset-password',
    };
  }
  return null;
}
