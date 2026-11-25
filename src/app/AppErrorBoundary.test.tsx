import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AppErrorBoundary } from './AppErrorBoundary';

it('zeigt bei einem Renderfehler die Fehleransicht mit Neuladeaktion', () => {
  const error = new Error('Absichtlicher Renderfehler im Test');
  const onCaughtError = vi.fn();

  function FailingChild(): never {
    throw error;
  }

  render(
    <AppErrorBoundary>
      <FailingChild />
    </AppErrorBoundary>,
    { onCaughtError },
  );

  expect(onCaughtError.mock.calls[0]?.[0]).toBe(error);
  expect(
    screen.getByRole('heading', { name: 'zäme konnte nicht geladen werden' }),
  ).toBeVisible();
  expect(screen.getByText('Versuche, die Seite neu zu laden.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Seite neu laden' })).toBeEnabled();
});
