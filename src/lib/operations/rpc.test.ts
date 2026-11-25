import { beforeEach, expect, it, vi } from 'vitest';
import { Operations } from './protocol';
import { mutate, reviewPending } from './rpc';
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  send: vi.fn(),
  refresh: vi.fn(),
  read: vi.fn(),
}));
let controller: AbortController;
let generation: string;
const operations = new Operations();
vi.mock('../../features/auth/session', () => ({
  activeScope: () => ({
    user: 'a',
    epoch: 1,
    revision: 1,
    household: 'h',
    generation,
    jwt: 'test',
    signal: controller.signal,
  }),
  get operations() {
    return operations;
  },
  refresh: mocks.refresh,
  snapshot: () => ({ phase: 'ready' }),
}));
vi.mock('../supabase/client', () => ({
  backend: () => ({
    rpc: mocks.rpc,
    from: () => chain(mocks.read),
  }),
}));
function chain(end: () => unknown) {
  const request = {
    retry: () => request,
    setHeader: () => request,
    abortSignal: end,
    select: () => request,
    eq: () => request,
    order: () => request,
    limit: () => request,
  };
  return request;
}
const id = '00000000-0000-4000-8000-000000000071';
const context = { h: 'h', g: 'g' };
const data = {
  ok: true,
  code: null,
  id,
  version: 2,
  expires_at: null,
  household_name: null,
  invites: null,
  retry_after: null,
};
const reply = (
  fields: Partial<Omit<typeof data, 'id' | 'version'>> & {
    id?: string | null;
    version?: number | null;
  } = {},
) => ({ data: { ...data, ...fields }, error: null, status: 200 });
beforeEach(() => {
  vi.resetAllMocks();
  controller = new AbortController();
  generation = 'g';
  operations.clear();
  mocks.rpc.mockImplementation(() => chain(mocks.send));
  mocks.send.mockResolvedValue(reply());
  mocks.read.mockResolvedValue({ data: [], error: null });
});
it('transportiert fünf öffentliche Vorratsaufrufe mit Dezimalstrings und JSON-Booleans', async () => {
  const fields = { name: 'Mehl', quantity: '1.025' };
  mocks.send.mockResolvedValueOnce(reply({ version: 1 }));
  await mutate('create_item', { ...context, fields, ack: false });
  await mutate('edit_item', { ...context, id, fields, v: 1, ack: true });
  await mutate('set_reservation', { ...context, id, desired: '0.125', v: 2 });
  await mutate('consume_item', {
    ...context,
    id,
    amount: '1.025',
    unit: 'kg',
    confirm_full: true,
    confirmed_v: 2,
  });
  mocks.send.mockResolvedValueOnce(reply({ version: null }));
  await mutate('delete_item', { ...context, id, confirm: true, v: 3 });
  expect(mocks.rpc.mock.calls).toEqual([
    ['create_item', { ...context, op: expect.anything(), fields, ack: false }],
    [
      'edit_item',
      { ...context, op: expect.anything(), id, fields, v: 1, ack: true },
    ],
    [
      'set_reservation',
      { ...context, op: expect.anything(), id, desired: '0.125', v: 2 },
    ],
    [
      'consume_item',
      {
        ...context,
        op: expect.anything(),
        id,
        amount: '1.025',
        unit: 'kg',
        confirm_full: true,
        confirmed_v: 2,
      },
    ],
    [
      'delete_item',
      { ...context, op: expect.anything(), id, confirm: true, v: 3 },
    ],
  ]);
});
it.each([
  { id: null },
  { id: 'falsche ID' },
  { id: '00000000-0000-4000-8000-000000000072' },
  { version: null },
  { version: 0 },
  { version: 1.5 },
])(
  'weist eine unvollständige oder fremde Quittung zurück (%j)',
  async (invalid) => {
    mocks.send.mockResolvedValueOnce(reply(invalid));
    await expect(
      mutate('set_reservation', { ...context, id, v: 1, desired: '1' }),
    ).rejects.toMatchObject({ code: 'TRANSPORT' });
    expect(mocks.read).toHaveBeenCalledOnce();
  },
);
it('bestätigt einen Vollverbrauch ausschliesslich nach neuem Entscheid', async () => {
  mocks.send.mockResolvedValueOnce({
    data: { ...data, ok: false, code: 'CONFIRM_FULL' },
    status: 200,
    error: null,
  });
  await expect(
    mutate('consume_item', {
      ...context,
      id,
      unit: 'kg',
      amount: '1',
      confirm_full: false,
    }),
  ).rejects.toMatchObject({ code: 'CONFIRM_FULL' });
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
it('verwirft den Erfolg, wenn die Nachprüfung eine neue Generation desselben Haushalts liest', async () => {
  mocks.refresh.mockImplementationOnce(async () => {
    controller.abort();
    controller = new AbortController();
    generation = 'wieder-beigetreten';
  });
  const args = { ...context, id, amount: '1', unit: 'kg', confirm_full: false };
  await expect(mutate('consume_item', args)).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  await expect(mutate('consume_item', args)).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  expect(mocks.rpc).toHaveBeenCalledOnce();
});
it('bindet die bewusste Auflösung an den gelesenen Zustand und Kontext', async () => {
  const args = { ...context, id, desired: '1', v: 1 };
  mocks.send.mockRejectedValueOnce(new Error());
  await expect(mutate('set_reservation', args)).rejects.toMatchObject({
    code: 'TRANSPORT',
  });
  const review = await reviewPending('set_reservation', args);
  expect(review.items).toEqual([]);
  controller.abort();
  expect(() => review.resolve()).toThrow();
});
it('hält die Charge bis zum Ende der Nachprüfung gesperrt', async () => {
  let finish!: () => void;
  mocks.refresh.mockImplementationOnce(
    () =>
      new Promise<void>((r) => {
        finish = r;
      }),
  );
  const args = { ...context, id, desired: '1', v: 1 };
  const first = mutate('set_reservation', args);
  await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  await expect(mutate('set_reservation', args)).rejects.toMatchObject({
    code: 'RETRY',
  });
  expect(mocks.rpc).toHaveBeenCalledOnce();
  finish();
  await first;
});
it('ein Antwortverlust bindet die Mengeneingabe, eine andere Charge bleibt unabhängig', async () => {
  const args = { ...context, id, amount: '1', unit: 'kg', confirm_full: false };
  mocks.send.mockRejectedValueOnce(new Error());
  const lost = mutate('consume_item', args);
  args.amount = '2';
  await expect(lost).rejects.toMatchObject({ code: 'TRANSPORT' });
  await expect(mutate('consume_item', args)).rejects.toMatchObject({
    code: 'UNRESOLVED',
  });
  const other = '00000000-0000-4000-8000-000000000073';
  mocks.send.mockResolvedValueOnce(reply({ id: other }));
  await mutate('consume_item', { ...args, id: other });
  const review = await reviewPending('consume_item', args);
  expect(mocks.rpc.mock.calls[0][1].amount).toBe('1');
  expect(mocks.rpc.mock.calls[0][1].op).toBe(review.op);
  expect(mocks.rpc.mock.calls[1][1].op).not.toBe(review.op);
  review.resolve();
  await mutate('consume_item', args);
  expect(mocks.rpc.mock.calls[2][1].op).not.toBe(review.op);
});
