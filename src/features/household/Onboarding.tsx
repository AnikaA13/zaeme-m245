import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Form, useAction } from '../../components/ui/Forms';
import {
  nameValue,
  validToken,
  FlowError,
  FormError,
} from '../../lib/operations/protocol';
import { mutate, query } from '../../lib/operations/rpc';
import { intent } from '../auth/intent';
import { activeScope, announce } from '../auth/session';
import type { Account } from './load';

export function ProfileForm({ account }: { account: Account }) {
  const [base, setBase] = useState(account.profile),
    [name, setName] = useState(base?.display_name ?? '');
  const action = useAction();
  const stale = base?.version !== account.profile?.version;
  return (
    <Form
      submit={() =>
        void action.run(async () => {
          if (stale) return;
          const home = account.home;
          const scope = activeScope();
          const receipt = await mutate('save_profile', {
            name: nameValue(name),
            v: base?.version ?? 0,
            ...(home ? { h: home.id, g: home.g } : {}),
          });
          if (!scope.signal.aborted && receipt.version) {
            setBase({
              display_name: nameValue(name),
              version: receipt.version,
            });
            announce('Dein Anzeigename ist gespeichert.');
          }
        })
      }
    >
      <label>
        Anzeigename
        <input
          required
          autoComplete="nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {action.feedback}
      {stale && (
        <p role="status">
          Aktuell gespeicherter Anzeigename: {account.profile?.display_name}.
          <button type="button" onClick={() => setBase(account.profile)}>
            Aktuellen Namen als Grundlage übernehmen
          </button>
        </p>
      )}
      <button disabled={action.busy || stale}>Namen speichern</button>
    </Form>
  );
}
export function CreatePage() {
  const [name, setName] = useState('');
  const action = useAction();
  return (
    <>
      <h1>Haushalt erstellen</h1>
      <Form
        submit={() =>
          void action.run(async () => {
            await mutate('create_household', { name: nameValue(name) });
          })
        }
      >
        <label>
          Haushaltsname
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {action.feedback}
        <button disabled={action.busy}>Haushalt erstellen</button>
      </Form>
      <Link to="/" onClick={() => intent.clear()}>
        Abbrechen
      </Link>
    </>
  );
}
export function JoinPage({ guest = false }: { guest?: boolean }) {
  const navigate = useNavigate();
  const [token, setToken] = useState(intent.get()?.token ?? ''),
    [preview, setPreview] = useState('');
  const action = useAction();
  return (
    <>
      <h1>Haushalt beitreten</h1>
      <p>
        {guest
          ? 'Melde dich an, um eine Einladung zu prüfen.'
          : 'Öffne deinen Einladungslink oder füge den Einladungscode ein.'}
      </p>
      <Form
        submit={() =>
          void action.run(async () => {
            if (!validToken(token)) throw new FlowError('INVITE_INVALID');
            if (guest) return;
            const scope = activeScope();
            if (intent.get()?.token !== token)
              throw new FormError(
                'Die lokale Einladung ist abgelaufen. Öffne den Einladungslink erneut oder gib den Code neu ein.',
              );
            if (preview) {
              const receipt = await mutate('join_household', { token });
              const current = activeScope();
              if (
                current.epoch === scope.epoch &&
                current.household === receipt.id &&
                current.revision === scope.revision + 1
              )
                navigate('/', { replace: true });
              return;
            }
            intent.bind(scope.user!, scope.email);
            const response = await query('preview_invite', { token });
            if (!response.household_name) throw new FlowError('TRANSPORT');
            if (!scope.signal.aborted) setPreview(response.household_name);
          })
        }
      >
        {!preview && (
          <label>
            Einladungscode
            <input
              autoComplete="off"
              spellCheck={false}
              disabled={action.busy}
              value={token}
              onChange={(e) => {
                const v = e.target.value.trim();
                setToken(v);
                intent.set('join', validToken(v) ? v : '');
              }}
            />
          </label>
        )}
        {preview && (
          <p>
            Möchtest du dem Haushalt <strong>{preview}</strong> beitreten?
          </p>
        )}
        {action.feedback}
        {!guest && (
          <button disabled={action.busy}>
            {preview ? 'Beitritt bestätigen' : 'Einladung prüfen'}
          </button>
        )}
      </Form>
      {guest && (
        <>
          <Link
            className="primary"
            to="/auth/register"
            onClick={() => {
              if (!intent.get()) intent.set('join');
            }}
          >
            Konto erstellen
          </Link>
          <Link
            to="/auth/login"
            onClick={() => {
              if (!intent.get()) intent.set('join');
            }}
          >
            Anmelden
          </Link>
        </>
      )}
      <Link to={guest ? '/welcome' : '/'} onClick={() => intent.clear()}>
        Abbrechen
      </Link>
    </>
  );
}
