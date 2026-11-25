import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, it, vi } from 'vitest';
import { AuthForm } from './AuthPages';

const auth = vi.hoisted(() => ({ signUp: vi.fn() }));
const identity = new AbortController();
vi.mock('../../lib/supabase/client', () => ({ backend: () => ({ auth }) }));
vi.mock('./session', () => ({
  activeScope: () => ({ signal: identity.signal }),
}));

it('eine verspätete Registrierung öffnet nach Kontowechsel keine Bestätigungsseite', async () => {
  let finish!: () => void;
  auth.signUp.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => resolve({ error: null });
      }),
  );
  render(
    <MemoryRouter initialEntries={['/auth/register']}>
      <Routes>
        <Route path="/auth/register" element={<AuthForm mode="register" />} />
        <Route path="/auth/confirm" element={<h1>E-Mail bestätigen</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText('E-Mail-Adresse'), {
    target: { value: 'wechsel@example.invalid' },
  });
  fireEvent.change(screen.getByLabelText('Passwort', { exact: true }), {
    target: { value: 'acht-zeichen' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Konto erstellen' }));
  expect(auth.signUp).toHaveBeenCalledOnce();
  identity.abort();
  await act(async () => finish());
  expect(screen.queryByText('E-Mail bestätigen')).toBeNull();
  expect(
    screen.getByRole('heading', { name: 'Konto erstellen' }),
  ).toBeVisible();
});
