import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types';

export function configuration(url?: string, key?: string) {
  if (!url || !key || key.endsWith('Beispiel')) return null;
  try {
    const endpoint = new URL(url);
    if (
      endpoint.origin !== url ||
      !(
        endpoint.protocol === 'https:' ||
        (endpoint.protocol === 'http:' &&
          ['127.0.0.1', 'localhost'].includes(endpoint.hostname))
      )
    )
      return null;
    if (!key.startsWith('sb_publishable_')) {
      const payload = JSON.parse(
        atob(key.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')),
      );
      if (payload.role !== 'anon') return null;
    }
    return { url, key };
  } catch {
    return null;
  }
}

const config = configuration(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export const storageKey =
  'zaeme-auth-' + (config ? new URL(config.url).host : 'local');
export const client = config
  ? createClient<Database>(config.url, config.key, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
        storageKey,
      },
    })
  : null;
export function backend() {
  if (!client) throw new Error('Die öffentliche Supabase-Konfiguration fehlt.');
  return client;
}
