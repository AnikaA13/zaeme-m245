import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Form, Password, useAction } from '../../components/ui/Forms';
import { backend } from '../../lib/supabase/client';
import { FormError, passwordValid } from '../../lib/operations/protocol';
import { activeScope, completeRecovery } from './session';
import { intent } from './intent';

const confirmUrl = () => location.origin + '/auth/callback';
function authFailure(error: { code?: string; status?: number }) {
  if (error.status === 429)
    return new FormError(
      'Zu viele Anfragen. Warte kurz und versuche es erneut.',
    );
  if (error.code === 'email_not_confirmed')
    return new FormError(
      'Bestätige zuerst deine E-Mail-Adresse. Öffne dazu die Nachricht von zäme.',
    );
  if (error.code === 'invalid_credentials')
    return new FormError('E-Mail-Adresse oder Passwort stimmen nicht.');
  if (error.code === 'weak_password')
    return new FormError('Verwende ein längeres Passwort.');
  if (error.code === 'same_password')
    return new FormError('Wähle ein anderes Passwort als bisher.');
  return new FormError(
    'Die Anfrage ist fehlgeschlagen. Prüfe deine Eingabe und die Verbindung und versuche es erneut.',
  );
}
export function AuthForm({ mode }: { mode: 'login' | 'register' | 'forgot' }) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [sent, setSent] = useState(false);
  const action = useAction(),
    navigate = useNavigate();
  const register = mode === 'register',
    forgot = mode === 'forgot';
  async function submit() {
    const scope = activeScope();
    const auth = backend().auth;
    const address = email.trim();
    if (register && !passwordValid(password))
      throw new FormError(
        'Verwende mindestens acht Zeichen für dein Passwort.',
      );
    if (forgot) {
      const { error } = await auth.resetPasswordForEmail(address, {
        redirectTo: location.origin + '/auth/reset-password',
      });
      if (scope.signal.aborted) return;
      if (error && error.status !== 422) throw authFailure(error);
      setSent(true);
      return;
    }
    if (register) {
      intent.forEmail(address);
      const { error } = await auth.signUp({
        email: address,
        password,
        options: { emailRedirectTo: confirmUrl() },
      });
      if (scope.signal.aborted) return;
      if (
        error &&
        !['user_already_exists', 'email_exists'].includes(error.code ?? '')
      )
        throw authFailure(error);
      setPassword('');
      navigate('/auth/confirm', { replace: true, state: { email: address } });
      return;
    }
    const { error } = await auth.signInWithPassword({
      email: address,
      password,
    });
    if (scope.signal.aborted) return;
    if (error?.code === 'email_not_confirmed') {
      navigate('/auth/confirm', { state: { email: address } });
      return;
    }
    if (error) throw authFailure(error);
  }
  const title = register
    ? 'Konto erstellen'
    : forgot
      ? 'Passwort vergessen?'
      : 'Anmelden';
  return (
    <>
      <h1>{title}</h1>
      {sent ? (
        <p role="status">
          Falls ein Konto zu dieser Adresse besteht, erhältst du eine E-Mail.
          Öffne den Link in diesem Browser.
        </p>
      ) : (
        <Form submit={() => void action.run(submit)}>
          <label>
            E-Mail-Adresse
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {!forgot && (
            <Password
              value={password}
              fresh={register}
              onChange={setPassword}
            />
          )}
          {register && <p>Verwende mindestens acht Zeichen.</p>}
          {action.feedback}
          <button disabled={action.busy}>
            {forgot ? 'Link anfordern' : title}
          </button>
        </Form>
      )}
      {!forgot && (
        <Link to={register ? '/auth/login' : '/auth/register'}>
          {register ? 'Bereits registriert? Anmelden' : 'Konto erstellen'}
        </Link>
      )}
      {!register && !forgot && (
        <Link to="/auth/forgot-password">Passwort vergessen?</Link>
      )}
      {forgot && <Link to="/auth/login">Zur Anmeldung</Link>}
      <Link to="/welcome" onClick={() => intent.clear()}>
        Abbrechen
      </Link>
    </>
  );
}
export function ConfirmPage() {
  const loc = useLocation(),
    email = typeof loc.state?.email === 'string' ? loc.state.email : '';
  const action = useAction(),
    [remaining, setRemaining] = useState(30),
    [resent, setResent] = useState(false);
  useEffect(() => {
    if (!remaining) return;
    const id = setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);
  return (
    <>
      <h1>E-Mail bestätigen</h1>
      <p>
        Prüfe deinen Posteingang und öffne den Bestätigungslink in diesem
        Browser. Prüfe auch den Spamordner.
      </p>
      {email && (
        <button
          disabled={remaining > 0 || action.busy}
          onClick={() =>
            void action.run(async () => {
              intent.forEmail(email);
              const { error } = await backend().auth.resend({
                type: 'signup',
                email,
                options: { emailRedirectTo: confirmUrl() },
              });
              setRemaining(30);
              if (error) throw authFailure(error);
              setResent(true);
            })
          }
        >
          Erneut senden{remaining > 0 ? ' (' + remaining + ' s)' : ''}
        </button>
      )}
      {resent && (
        <p role="status">
          Falls eine Bestätigung aussteht, erhältst du eine weitere Nachricht.
        </p>
      )}
      {action.feedback}
      <Link to="/auth/login">Zur Anmeldung</Link>
    </>
  );
}
export function ResetPage() {
  const [password, setPassword] = useState(''),
    [repeat, setRepeat] = useState('');
  const action = useAction();
  return (
    <>
      <h1>Neues Passwort setzen</h1>
      <Form
        submit={() =>
          void action.run(async () => {
            if (!passwordValid(password))
              throw new FormError(
                'Verwende mindestens acht Zeichen für dein Passwort.',
              );
            if (password !== repeat)
              throw new FormError('Die Passwörter stimmen nicht überein.');
            const scope = activeScope();
            const { error } = await backend().auth.updateUser({ password });
            if (scope.signal.aborted) return;
            if (error) throw authFailure(error);
            completeRecovery();
          })
        }
      >
        <Password
          fresh
          label="Neues Passwort"
          value={password}
          onChange={setPassword}
        />
        <Password
          fresh
          label="Passwort bestätigen"
          value={repeat}
          onChange={setRepeat}
        />
        {action.feedback}
        <button disabled={action.busy}>Passwort speichern</button>
      </Form>
    </>
  );
}
