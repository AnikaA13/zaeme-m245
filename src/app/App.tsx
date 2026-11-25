import { Link, Route, Routes } from 'react-router';
import { StartPage } from '../features/start/StartPage';

export function App() {
  return (
    <main className="app-shell">
      <Routes>
        <Route index element={<StartPage />} />
        <Route
          path="*"
          element={
            <section className="app-panel" aria-labelledby="missing-page-title">
              <h1 id="missing-page-title">Seite nicht gefunden</h1>
              <p>Diese Adresse führt zu keiner Seite in zäme.</p>
              <Link to="/">Zur Startseite</Link>
            </section>
          }
        />
      </Routes>
    </main>
  );
}
