import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { Application } from './Application';
import * as session from '../features/auth/session';
import * as rpc from '../lib/operations/rpc';
import type { Account } from '../features/household/load';

const account: Account = {
  profile: { display_name: 'Testperson', version: 1 },
  home: {
    id: 'h',
    g: 'g',
    name: 'Testhaushalt',
    owner_id: 'owner',
    version: 1,
    warning_days: 3,
    household_members: [
      {
        user_id: 'actor',
        generation: 'g',
        profiles: { display_name: 'Testperson' },
      },
    ],
  },
};
const initial = session.snapshot();
afterEach(() => vi.restoreAllMocks());
function show(
  path: string,
  change: Partial<ReturnType<typeof session.snapshot>>,
) {
  vi.spyOn(session, 'snapshot').mockReturnValue({ ...initial, ...change });
  render(
    <MemoryRouter initialEntries={[path]}>
      <Application />
    </MemoryRouter>,
  );
}
it('zeigt beim Direktaufruf ohne Anmeldung keine privaten Daten', () => {
  show('/household', { phase: 'guest' });
  expect(screen.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
  expect(screen.queryByText('Testhaushalt')).toBeNull();
});
it('zeigt bei Ladefehler eine Wiederholung und sperrt die Haushaltsgründung', () => {
  show('/household/create', { phase: 'error', user: 'actor' });
  expect(screen.getByRole('button', { name: 'Erneut laden' })).toBeVisible();
  expect(screen.queryByLabelText('Haushaltsname')).toBeNull();
});
it('zeigt Mitgliedern nur ihre Aktionen und verlangt eine Austrittsbestätigung', () => {
  const write = vi.spyOn(rpc, 'mutate'),
    confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  show('/household', { phase: 'ready', user: 'actor', account });
  expect(
    screen.queryByRole('button', { name: 'Haushalt auflösen' }),
  ).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Einladung erstellen' }),
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Haushalt verlassen' }));
  expect(confirm).toHaveBeenCalledOnce();
  expect(write).not.toHaveBeenCalled();
});
