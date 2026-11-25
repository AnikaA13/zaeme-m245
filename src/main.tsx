import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app/App';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import './styles/global.css';

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
