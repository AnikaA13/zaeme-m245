import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import * as session from '../features/auth/session';

describe('zäme', () => {
  it('führt Gäste von der Startseite zur Haushaltsauswahl', () => {
    const guest = { ...session.snapshot(), phase: 'guest' as const };
    vi.spyOn(session, 'snapshot').mockReturnValue(guest);
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    const main = screen.getByRole('main');
    expect(main).toContainElement(
      screen.getByRole('heading', { name: 'Gemeinsam alles im Blick.' }),
    );
    expect(
      screen.getByRole('link', { name: 'Haushalt erstellen' }),
    ).toHaveAttribute('href', '/auth/register');
    vi.restoreAllMocks();
  });

  it('bietet bei einer unbekannten Adresse einen Weg zur Startseite', () => {
    render(
      <MemoryRouter initialEntries={['/unbekannt']}>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Seite nicht gefunden' }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Zur Startseite' }),
    ).toHaveAttribute('href', '/');
  });
});
