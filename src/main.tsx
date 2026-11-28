import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app/App';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import './styles/global.css';
import { startSession } from './features/auth/session';

const sessionCleanup = startSession();
if (import.meta.hot)
  import.meta.hot.dispose(async () => (await sessionCleanup)?.());

const root = document.getElementById('root');

if (!root) {
  throw new Error('Das Wurzelelement der Anwendung fehlt.');
}

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Bei gesperrter Registrierung bleibt die Online-App bedienbar.
    void navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .catch(() => {});
  });
}
