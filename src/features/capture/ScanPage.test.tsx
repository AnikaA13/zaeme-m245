import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as auth from '../auth/session';
import * as camera from '../barcode/scanner';
import * as provider from '../barcode/lookup';
import { isEan13 } from '../barcode/ean';
import ScanPage from './ScanPage';

const code = '0034000470693';
if (!isEan13(code)) throw new Error('Ungültige Test-EAN.');
const detected = { kind: 'detected', barcode: code } as const;
const found = {
  kind: 'found',
  prefill: { barcode: code, name: 'Haferdrink' },
} as const;
let scope: AbortController;
beforeEach(() => {
  scope = new AbortController();
  vi.spyOn(auth, 'activeScope').mockReturnValue({
    ...auth.activeScope(),
    signal: scope.signal,
    user: 'ich',
    household: 'haus',
    generation: 'neu',
    jwt: 'fixture',
  });
});
afterEach(() => vi.restoreAllMocks());
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const open = () =>
  render(
    <MemoryRouter>
      <ScanPage />
    </MemoryRouter>,
  );
const start = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Kamera starten' }));

it.each(['Sitzungswechsel', 'Unmount'])(
  'verwirft die verspätete Kamerazusage nach %s',
  async (reason) => {
    const late = deferred<camera.ScannerOutcome>();
    const scan = vi.spyOn(camera, 'startScanner').mockReturnValue(late.promise);
    const lookup = vi.spyOn(provider, 'lookupProduct');
    const view = open();
    expect(scan).not.toHaveBeenCalled();
    start();
    if (reason === 'Unmount') view.unmount();
    else act(() => scope.abort());
    expect(scan.mock.calls[0][1].aborted).toBe(true);
    await act(async () => {
      late.resolve(detected);
      await late.promise;
    });
    expect(lookup).not.toHaveBeenCalled();
  },
);
it.each(['Manuell', 'Hintergrund', 'Sitzungswechsel', 'Unmount'])(
  'bricht die Produktabfrage bei %s ab und ignoriert die späte Antwort',
  async (reason) => {
    const late = deferred<provider.LookupResult>();
    vi.spyOn(camera, 'startScanner').mockImplementation(
      async (_video, _signal, notify) => {
        notify('detected');
        return detected;
      },
    );
    const lookup = vi
      .spyOn(provider, 'lookupProduct')
      .mockReturnValue(late.promise);
    const view = open();
    await act(async () => {
      start();
    });
    expect(lookup).toHaveBeenCalledTimes(1);
    if (reason === 'Unmount') view.unmount();
    else if (reason === 'Sitzungswechsel') act(() => scope.abort());
    else if (reason === 'Hintergrund')
      act(() => window.dispatchEvent(new Event('pagehide')));
    else
      fireEvent.click(screen.getByRole('button', { name: /Suche abbrechen/ }));
    expect(lookup.mock.calls[0][1].aborted).toBe(true);
    await act(async () => {
      late.resolve(found);
      await late.promise;
    });
    expect(screen.queryByDisplayValue('Haferdrink')).toBeNull();
    if (reason === 'Manuell' || reason === 'Hintergrund') {
      expect(screen.getByLabelText(/Barcode \(EAN-13\)/)).toHaveValue(code);
      expect(screen.getByLabelText('Produktname')).toHaveValue('');
    }
  },
);
it.each(['incomplete', 'rate-limit'] as const)(
  'zeigt bei %s den editierbaren Originalcode ohne Namensvorschlag',
  async (kind) => {
    vi.spyOn(camera, 'startScanner').mockResolvedValue(detected);
    vi.spyOn(provider, 'lookupProduct').mockResolvedValue(
      kind === 'incomplete'
        ? { kind, prefill: { barcode: detected.barcode } }
        : {
            kind: 'failed',
            reason: kind,
            prefill: { barcode: detected.barcode },
          },
    );
    open();
    start();
    expect(await screen.findByLabelText('Produktname')).toHaveValue('');
    expect(screen.getByLabelText(/Barcode \(EAN-13\)/)).toHaveValue(code);
    expect(screen.getByRole('status')).toHaveTextContent(
      kind === 'incomplete' ? 'Barcode erkannt' : 'zu viele Anfragen',
    );
  },
);
