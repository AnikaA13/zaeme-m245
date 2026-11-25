import { useSyncExternalStore } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { AuthForm, ConfirmPage, ResetPage } from '../features/auth/AuthPages';
import { intent } from '../features/auth/intent';
import {
  dismissCallback,
  logout,
  refresh,
  snapshot,
  subscribe,
} from '../features/auth/session';
import { Welcome, Choices } from '../features/start/Welcome';
import {
  ProfileForm,
  CreatePage,
  JoinPage,
} from '../features/household/Onboarding';
import { HouseholdPage } from '../features/household/HouseholdPage';
function subscribeConnection(fn: () => void) {
  window.addEventListener('online', fn);
  window.addEventListener('offline', fn);
  return () => {
    window.removeEventListener('online', fn);
    window.removeEventListener('offline', fn);
  };
}
export function Application() {
  const online = useSyncExternalStore(
    subscribeConnection,
    () => navigator.onLine,
  );
  const state = useSyncExternalStore(subscribe, snapshot);
  const { pathname: path } = useLocation();
  const { phase, account, user } = state;
  const target = (to: string) => <Navigate replace to={to} />;
  function page() {
    if (!online)
      return (
        <>
          <h1>Keine Netzwerkverbindung</h1>
          <p role="status">
            Sobald du wieder online bist, prüfen wir deinen Zugang erneut.
          </p>
        </>
      );
    if (phase === 'config')
      return (
        <>
          <h1>Konfiguration fehlt</h1>
          <p role="alert">
            Setze die öffentliche Supabase-URL und den öffentlichen
            Client-Schlüssel in der lokalen Entwicklungsumgebung.
          </p>
        </>
      );
    if (phase === 'initial' || phase === 'loading')
      return (
        <p role="status">
          {phase === 'initial'
            ? 'Sitzung wird geprüft …'
            : 'Profil und Haushalt werden geladen …'}
        </p>
      );
    if (state.callbackError)
      return (
        <>
          <h1>Link nicht mehr gültig</h1>
          <p>
            Öffne den neuesten Link im Browser, in dem du ihn angefordert hast.
            Bei einem Gerätewechsel kannst du dich nach der E-Mail-Bestätigung
            anmelden und den ursprünglichen Einladungslink erneut öffnen.
          </p>
          <Link onClick={dismissCallback} to="/auth/login">
            Zur Anmeldung
          </Link>
          <Link onClick={dismissCallback} to="/auth/forgot-password">
            Neuen Passwortlink anfordern
          </Link>
        </>
      );
    if (!user) {
      switch (path) {
        case '/welcome':
          return <Welcome />;
        case '/join':
          return <JoinPage guest key={state.inviteRevision} />;
        case '/auth/login':
          return <AuthForm key="login" mode="login" />;
        case '/auth/register':
          return <AuthForm key="register" mode="register" />;
        case '/auth/confirm':
          return <ConfirmPage />;
        case '/auth/forgot-password':
          return <AuthForm key="forgot" mode="forgot" />;
        case '/household/create':
          return <CreateAuthRedirect />;
        case '/household':
        case '/profile/setup':
          return target('/auth/login');
        default:
          return target('/welcome');
      }
    }
    if (state.recovery) return <ResetPage />;
    if (phase === 'error' || !account)
      return (
        <>
          <h1>Laden fehlgeschlagen</h1>
          <p role="alert">
            Prüfe deine Verbindung, um dein Profil und deinen Haushalt zu laden.
          </p>
          <button onClick={() => void refresh()}>Erneut laden</button>
        </>
      );
    if (!account.profile)
      return path === '/profile/setup' ? (
        <>
          <h1>Wie heisst du?</h1>
          <p>Dein Haushalt sieht diesen Namen.</p>
          <ProfileForm account={account} />
        </>
      ) : (
        target('/profile/setup')
      );
    if (!account.home) {
      if (path === '/join') return <JoinPage key={state.inviteRevision} />;
      if (path === '/household/create') return <CreatePage />;
      const choice = intent.get();
      if (choice)
        return target(
          choice.purpose === 'join' ? '/join' : '/household/create',
        );
      if (path !== '/') return target('/');
      return (
        <>
          <h1>Dein Haushalt</h1>
          <p>
            Erstelle einen Haushalt oder tritt mit einer Einladung bei. Falls du
            das Gerät gewechselt hast, öffne den ursprünglichen Einladungslink
            erneut.
          </p>
          <Choices />
          <details>
            <summary>Anzeigenamen bearbeiten</summary>
            <ProfileForm key={account.profile.version} account={account} />
          </details>
        </>
      );
    }
    if (path === '/household')
      return <HouseholdPage user={user} account={account} />;
    if (path === '/join')
      return (
        <>
          <h1>Du gehörst bereits zu einem Haushalt.</h1>
          <Link to="/household" onClick={() => intent.clear()}>
            Zum Haushalt
          </Link>
        </>
      );
    if (path !== '/') return target('/');
    return (
      <>
        <h1>Hallo {account.profile.display_name}</h1>
        <p>
          Dein Haushalt heisst <strong>{account.home.name}</strong>.
        </p>
        <Link className="primary" to="/household">
          Haushalt öffnen
        </Link>
        <p>Der gemeinsame Vorrat folgt in einer späteren Version.</p>
      </>
    );
  }
  return (
    <div key={state.epoch + '-' + (account?.home?.g ?? '')} className="content">
      {state.notice && <p role="status">{state.notice}</p>}
      {page()}
      {user && (
        <button className="text-button" onClick={() => void logout()}>
          Abmelden
        </button>
      )}
    </div>
  );
}
function CreateAuthRedirect() {
  intent.set('create');
  return <Navigate replace to="/auth/register" />;
}
