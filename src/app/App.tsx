import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router';
import { snapshot, subscribe } from '../features/auth/session';
import { Application } from './Application';
const paths = [
  '/',
  '/welcome',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/confirm',
  '/auth/callback',
  '/auth/reset-password',
  '/profile/setup',
  '/household/create',
  '/join',
  '/household',
  '/inventory',
  '/inventory/:id',
  '/inventory/:id/edit',
  '/inventory/:id/consume',
  '/inventory/:id/reserve',
  '/inventory/:id/shopping',
  '/capture',
  '/capture/manual',
  '/capture/scan',
  '/shopping',
  '/shopping/add',
  '/shopping/edit/:id',
];
export function App() {
  const { key, state } = useLocation();
  const session = useSyncExternalStore(subscribe, snapshot);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const id = state?.captureFocus;
    const target =
      typeof id === 'string' &&
      ['nav-add', 'list-add', 'manual-add', 'scan-add'].includes(id)
        ? document.getElementById(id)
        : null;
    (target ?? main.current)?.focus({ preventScroll: true });
  }, [key, state]);
  return (
    <main className="app-shell" ref={main} tabIndex={-1}>
      <div className="app-panel">
        <header>
          <img
            className="brand"
            src="/Gruppe23_ProjektlogoGross.svg"
            alt="zäme"
          />
          {session.phase === 'ready' &&
            session.account?.home &&
            !session.recovery && (
              <span className="household-name">
                {session.account.home.name}
              </span>
            )}
        </header>
        <Routes>
          {paths.map((path) => (
            <Route key={path} path={path} element={<Application />} />
          ))}
          <Route
            path="*"
            element={
              <section>
                <h1>Seite nicht gefunden</h1>
                <p>Diese Adresse führt zu keiner Seite in zäme.</p>
                <Link to="/">Zur Startseite</Link>
              </section>
            }
          />
        </Routes>
      </div>
    </main>
  );
}
