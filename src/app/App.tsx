import { useEffect, useRef } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router';
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
];
export function App() {
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    main.current?.focus({ preventScroll: true });
  }, [pathname]);
  return (
    <main className="app-shell" ref={main} tabIndex={-1}>
      <div className="app-panel">
        <header>
          <img
            className="brand"
            src="/Gruppe23_ProjektlogoGross.svg"
            alt="zäme"
          />
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
