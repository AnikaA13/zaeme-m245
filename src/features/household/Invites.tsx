import { useEffect, useState } from 'react';
import type { CompositeTypes } from '../../database.types';
import { useAction } from '../../components/ui/Forms';
import { invitation, FlowError } from '../../lib/operations/protocol';
import { query, mutate } from '../../lib/operations/rpc';
import { activeScope } from '../auth/session';
const date = (s: string | null) =>
  s ? new Date(s).toLocaleString('de-CH') : '–';
const drafts = new WeakMap<AbortSignal, ReturnType<typeof invitation>>();
export function Invites({ h, g }: { h: string; g: string }) {
  const [items, setItems] = useState<
      CompositeTypes<'invite_metadata'>[] | null
    >(null),
    [failed, setFailed] = useState(false),
    [revision, reload] = useState(0);
  const [token, setToken] = useState(''),
    [notice, setNotice] = useState('');
  const action = useAction();
  useEffect(() => {
    let active = true;
    query('list_invites', { h }).then(
      (r) => {
        if (active) {
          setItems(r.invites);
          setFailed(!Array.isArray(r.invites));
        }
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [h, revision]);
  const link = location.origin + '/join#invite=' + token;
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice('Kopiert.');
    } catch {
      setNotice('Markiere den Text im Feld und kopiere ihn manuell.');
    }
  }
  return (
    <section>
      <h2>Einladungen</h2>
      {token ? (
        <>
          <p>
            Teile den Link oder den Code. Nach dem Schliessen brauchst du für
            einen neuen Link eine neue Einladung.
          </p>
          <label>
            Einladungslink
            <input readOnly value={link} onFocus={(e) => e.target.select()} />
          </label>
          <button onClick={() => void copy(link)}>Link kopieren</button>
          <label>
            Einladungscode
            <input readOnly value={token} onFocus={(e) => e.target.select()} />
          </label>
          <button onClick={() => void copy(token)}>Code kopieren</button>
          {typeof navigator.share === 'function' && (
            <button
              onClick={async () => {
                try {
                  await navigator.share({ url: link });
                } catch {
                  setNotice('Du kannst den Link manuell kopieren.');
                }
              }}
            >
              Link teilen
            </button>
          )}
          <button
            className="secondary"
            onClick={() => {
              setToken('');
              setNotice('');
            }}
          >
            Link schliessen
          </button>
          {notice && <p role="status">{notice}</p>}
        </>
      ) : (
        <button
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              const scope = activeScope();
              try {
                const draft = drafts.get(scope.signal) ?? invitation();
                drafts.set(scope.signal, draft);
                const secret = await draft;
                if (scope.signal.aborted) return;
                const r = await mutate('create_invite', {
                  h,
                  g,
                  hash: secret.hash,
                });
                if (!r.id) throw new FlowError('TRANSPORT');
                if (!scope.signal.aborted) {
                  setToken(secret.token);
                  drafts.delete(scope.signal);
                  reload((n) => n + 1);
                }
              } catch (e) {
                if (
                  !(e instanceof FlowError) ||
                  !['TRANSPORT', 'RETRY', 'RATE_LIMITED'].includes(e.code)
                )
                  drafts.delete(scope.signal);
                throw e;
              }
            })
          }
        >
          Einladung erstellen
        </button>
      )}
      {action.feedback}
      {failed ? (
        <>
          <p role="alert">Einladungen konnten nicht geladen werden.</p>
          <button onClick={() => reload((n) => n + 1)}>
            Liste erneut laden
          </button>
        </>
      ) : items === null ? (
        <p role="status">Einladungen werden geladen …</p>
      ) : !items.length ? (
        <p>Es gibt noch keine Einladungen.</p>
      ) : (
        <ul>
          {items.map((i) => {
            const expired = Date.parse(i.expires_at ?? '') <= Date.now();
            return (
              <li key={i.id}>
                <strong>
                  {i.revoked_at
                    ? 'Widerrufen'
                    : expired
                      ? 'Abgelaufen'
                      : 'Gültig'}
                </strong>
                <small>{i.id}</small>
                <span>
                  Erstellt am {date(i.created_at)} · gültig bis{' '}
                  {date(i.expires_at)}
                </span>
                {!i.revoked_at && !expired && i.id && (
                  <button
                    className="secondary"
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(async () => {
                        if (
                          !window.confirm(
                            'Diese Einladung für weitere Beitritte widerrufen?',
                          )
                        )
                          return;
                        await mutate('revoke_invite', { h, g, id: i.id! });
                        setToken('');
                        reload((n) => n + 1);
                      })
                    }
                  >
                    Einladung widerrufen
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
