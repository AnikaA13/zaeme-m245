import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, onTestFinished, vi } from 'vitest';
import { ProductForm } from '../capture/ProductForm';
import { Detail } from './Detail';
import * as auth from '../auth/session';
import * as rpc from '../../lib/operations/rpc';
import * as reads from './read';
import { invalidateInventory } from './resource';
import { FlowError } from '../../lib/operations/protocol';

const item: reads.Item = {
  id: '00000000-0000-4000-8000-000000000008',
  household_id: 'haus',
  name: 'Birne',
  quantity: 1,
  unit: 'Stück',
  category: 'Sonstiges',
  barcode: null,
  expiry_date: null,
  date_type: null,
  location: null,
  version: 1,
  reserved_quantity: 0,
  own_quantity: 0,
  free_quantity: 1,
  consumable_quantity: 1,
};
const receipt = {
  ok: true,
  code: null,
  id: item.id,
  version: 1,
  retry_after: null,
  invites: null,
  expires_at: null,
  household_name: null,
};
let controller: AbortController;
beforeEach(() => {
  controller = new AbortController();
  const base = auth.activeScope();
  vi.spyOn(auth, 'activeScope').mockReturnValue({
    ...base,
    signal: controller.signal,
    user: 'ich',
    household: 'haus',
    generation: 'neu',
    jwt: 'fixture',
  });
  sessionStorage.clear();
});
afterEach(() => {
  act(() => controller.abort());
  vi.restoreAllMocks();
});
const button = (name: string) => screen.getByRole('button', { name });
it('bindet DATE_ACK an das geprüfte Datum und behält die Eingabe', async () => {
  const mutation = vi
    .spyOn(rpc, 'mutate')
    .mockRejectedValueOnce(new FlowError('DATE_ACK'))
    .mockResolvedValueOnce(receipt);
  render(
    <MemoryRouter>
      <ProductForm />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText('Produktname'), {
    target: { value: 'Birne' },
  });
  const date = screen.getByLabelText('Haltbarkeitsdatum (optional)');
  fireEvent.change(date, { target: { value: '2026-04-15' } });
  fireEvent.change(screen.getByLabelText('Datumsart'), {
    target: { value: 'MHD' },
  });
  fireEvent.click(button('Zum Vorrat hinzufügen'));
  const ack = await screen.findByRole('checkbox', { name: /15.04.2026/ });
  expect(ack).not.toBeChecked();
  fireEvent.click(ack);
  fireEvent.change(date, { target: { value: '2026-04-16' } });
  expect(screen.queryByRole('checkbox')).toBeNull();
  fireEvent.click(button('Zum Vorrat hinzufügen'));
  await screen.findByText('Weiteres Lebensmittel hinzufügen');
  expect(mutation.mock.calls[1][1]).toMatchObject({
    ack: false,
    fields: { name: 'Birne', expiry_date: '2026-04-16' },
  });
});
it('verlangt bei einer veralteten Bearbeitung zuerst den neuen Stand', async () => {
  const mutation = vi.spyOn(rpc, 'mutate').mockResolvedValue(receipt);
  const form = (i: reads.Item) => (
    <MemoryRouter>
      <ProductForm item={i} />
    </MemoryRouter>
  );
  const ui = render(form(item));
  fireEvent.change(screen.getByLabelText('Produktname'), {
    target: { value: 'Birnen' },
  });
  ui.rerender(form({ ...item, version: 2, location: 'Vorratsschrank' }));
  expect(button('Änderungen speichern')).toBeDisabled();
  expect(mutation).not.toHaveBeenCalled();
  fireEvent.click(button('Aktuellen Stand als Grundlage übernehmen'));
  fireEvent.click(button('Änderungen speichern'));
  await waitFor(() =>
    expect(mutation).toHaveBeenCalledWith('edit_item', {
      h: 'haus',
      g: 'neu',
      id: item.id,
      v: 2,
      ack: false,
      fields: {
        name: 'Birnen',
        unit: 'Stück',
        category: 'Sonstiges',
        quantity: '1',
        barcode: null,
        expiry_date: null,
        date_type: null,
        location: 'Vorratsschrank',
      },
    }),
  );
});
it('bindet auch ein Einzelstück an einen separaten bestätigten Vollverbrauch', async () => {
  let row = item;
  vi.spyOn(reads, 'readItem').mockImplementation(async () => row);
  vi.spyOn(reads, 'readOwners').mockResolvedValue({});
  const mutation = vi.spyOn(rpc, 'mutate').mockResolvedValue(receipt);
  // JSDOM bildet das Fokusverhalten des nativen modalen Fensters nicht vollständig ab.
  for (const [method, open] of [
    ['showModal', true],
    ['close', false],
  ] as const) {
    if (typeof HTMLDialogElement.prototype[method] === 'function') continue;
    Object.defineProperty(HTMLDialogElement.prototype, method, {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = open;
      },
    });
    onTestFinished(() => {
      Reflect.deleteProperty(HTMLDialogElement.prototype, method);
    });
  }
  render(
    <MemoryRouter>
      <Detail id={item.id} action="consume" days={3} />
    </MemoryRouter>,
  );
  await screen.findByRole('button', { name: 'Verbrauchen' });
  fireEvent.click(button('Verbrauchen'));
  expect(screen.getByRole('dialog')).toBeVisible();
  fireEvent.click(button('Abbrechen'));
  expect(mutation).not.toHaveBeenCalled();
  fireEvent.click(button('Verbrauchen'));
  row = {
    ...item,
    version: 2,
    quantity: 2,
    free_quantity: 2,
    consumable_quantity: 2,
  };
  act(invalidateInventory);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mutation).not.toHaveBeenCalled();
  expect(button('Verbrauchen')).toBeDisabled();
  fireEvent.click(button('Aktuellen Stand übernehmen'));
  fireEvent.click(button('Verbrauchen'));
  await waitFor(() =>
    expect(mutation).toHaveBeenCalledWith('consume_item', {
      h: 'haus',
      g: 'neu',
      id: item.id,
      amount: '1',
      unit: 'Stück',
      confirm_full: false,
    }),
  );
});
