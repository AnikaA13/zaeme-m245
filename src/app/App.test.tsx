import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('zäme', () => {
  it('zeigt den Entwicklungsstand auf der Startseite', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    const main = screen.getByRole('main');
    expect(main).toContainElement(
      screen.getByRole('heading', { name: 'zäme' }),
    );
    expect(screen.getByText('zäme ist in Entwicklung.')).toBeVisible();
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
