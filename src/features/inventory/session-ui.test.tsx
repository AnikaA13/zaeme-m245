import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as auth from '../auth/session';
import * as rpc from '../../lib/operations/rpc';
import { FlowError } from '../../lib/operations/protocol';
import * as reads from './read';
import { PendingWrites, useWrite } from './writes';
import { useResource } from './resource';

let controller: AbortController;
const scope = () => ({
  ...original,
  signal: controller.signal,
  user: 'person',
  jwt: 'synthetisch',
  household: 'haus',
  generation: 'generation',
});
const original = auth.activeScope();
beforeEach(() => {
  controller = new AbortController();
  vi.spyOn(auth, 'activeScope').mockImplementation(scope);
  sessionStorage.clear();
});
afterEach(() => {
  act(() => controller.abort());
  vi.restoreAllMocks();
});
function Action() {
  const action = useWrite();
  return (
    <>
      <PendingWrites />
      <button
        disabled={action.blocked('create_item')}
        onClick={() =>
          void action.submit(
            'create_item',
            {
              h: 'haus',
              g: 'generation',
              fields: { name: 'Reis' },
              ack: false,
            },
            'Reis',
            'Gespeichert',
            () => {},
          )
        }
      >
        Anlegen
      </button>
    </>
  );
}
it('liest nach einer quittierten Änderung nur erneut', async () => {
  const mutation = vi
    .spyOn(rpc, 'mutate')
    .mockRejectedValueOnce(new FlowError('REFRESH_FAILED'));
  vi.spyOn(auth, 'refresh').mockResolvedValue();
  const read = vi.spyOn(reads, 'readInventory').mockResolvedValue([]);
  render(
    <MemoryRouter>
      <Action />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText('Anlegen'));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Gespeicherten Stand laden' }),
  );
  await waitFor(() => expect(screen.getByText('Anlegen')).toBeEnabled());
  expect(mutation).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledOnce();
});
it('sperrt einen verlorenen Anlageauftrag nach neuem Dokument bis zum Abgleich', () => {
  sessionStorage.setItem('zaeme-pruefung-offen', '1');
  render(
    <MemoryRouter>
      <Action />
    </MemoryRouter>,
  );
  expect(screen.getByText('Anlegen')).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('ursprüngliche Anfrage');
});
it('verwirft einen verspäteten Leseerfolg beim Generationswechsel', async () => {
  let complete!: (s: string) => void;
  const read = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<string>((r) => {
          complete = r;
        }),
    )
    .mockResolvedValue('Neuer Vorrat');
  function View() {
    const r = useResource<string>('vorrat', read);
    return <p>{r.data ?? 'Lädt'}</p>;
  }
  const ui = render(<View />);
  expect(screen.getByText('Lädt')).toBeVisible();
  controller.abort();
  controller = new AbortController();
  ui.rerender(<View />);
  await screen.findByText('Neuer Vorrat');
  await act(async () => complete('Frühere private Daten'));
  expect(screen.queryByText('Frühere private Daten')).toBeNull();
});
it('bindet die identische Wiederholung über Formularwechsel an den alten Inhalt', async () => {
  const mutation = vi
    .spyOn(rpc, 'mutate')
    .mockRejectedValueOnce(new FlowError('TRANSPORT'))
    .mockResolvedValueOnce({
      ok: true,
      code: null,
      id: 'id',
      version: 1,
      retry_after: null,
      invites: null,
      expires_at: null,
      household_name: null,
    });
  const ui = render(
    <MemoryRouter>
      <Action />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText('Anlegen'));
  await screen.findByText('Ursprüngliche Anfrage identisch wiederholen');
  ui.unmount();
  render(
    <MemoryRouter>
      <Action />
    </MemoryRouter>,
  );
  expect(screen.getByText('Anlegen')).toBeDisabled();
  fireEvent.click(
    screen.getByText('Ursprüngliche Anfrage identisch wiederholen'),
  );
  await waitFor(() => expect(screen.getByText('Anlegen')).toBeEnabled());
  expect(mutation.mock.calls[0]).toEqual(mutation.mock.calls[1]);
});
