import {
  startScanner,
  type ScannerState,
} from '../src/features/barcode/scanner';
import {
  lookupProduct,
  type LookupFailure,
} from '../src/features/barcode/lookup';

const states: Record<ScannerState, string> = {
  idle: 'Bereit.',
  'activation-required': 'Tippe auf «Kamera starten».',
  requesting: 'Kamerafreigabe angefragt.',
  active: 'Kamera aktiv.',
  detected: 'EAN-13 erkannt.',
  'permission-denied': 'Kamerazugriff verweigert. Du kannst manuell erfassen.',
  'no-camera': 'Keine passende Kamera gefunden.',
  unavailable: 'Die Kamera ist belegt oder nicht verfügbar.',
  unsupported:
    'Für die Kamera brauchst du HTTPS und einen unterstützten Browser.',
  'decode-failure':
    'Das Kamerabild konnte nicht gelesen werden. Starte erneut oder erfasse manuell.',
  unreadable:
    'Noch kein EAN-13 lesbar. Richte die Kamera neu aus oder erfasse manuell.',
  invalid: 'Dieser Barcode wird nicht unterstützt.',
  stopped: 'Scanner beendet.',
};
const failures: Record<LookupFailure, string> = {
  network: 'Produktabfrage nicht erreichbar.',
  timeout: 'Die Produktabfrage hat zu lange gedauert.',
  'rate-limit': 'Zu viele Produktabfragen. Bitte warte.',
  'invalid-response': 'Die Produktantwort ist ungültig.',
};
const el = <T extends HTMLElement>(id: string) =>
  document.querySelector<T>('#' + id)!;
const start = el<HTMLButtonElement>('start'),
  stop = el<HTMLButtonElement>('stop');
const state = el('state'),
  lookup = el('lookup'),
  review = el('review'),
  source = el('source');
const barcode = el<HTMLInputElement>('barcode'),
  name = el<HTMLInputElement>('name');
let attempt: AbortController | undefined;

function cancel() {
  attempt?.abort();
  attempt = undefined;
  start.disabled = false;
  stop.disabled = true;
  lookup.textContent = '';
  state.textContent = states.stopped;
}

if (import.meta.env.DEV) {
  start.onclick = async () => {
    if (attempt) return;
    const owner = new AbortController();
    attempt = owner;
    start.disabled = true;
    stop.disabled = false;
    barcode.value = name.value = lookup.textContent = '';
    source.hidden = review.hidden = true;
    const scan = await startScanner(
      document.querySelector('video')!,
      owner.signal,
      (value) => {
        if (attempt === owner) state.textContent = states[value];
      },
    );
    if (attempt !== owner) return;
    if (scan.kind === 'detected') {
      barcode.value = scan.barcode;
      lookup.textContent = 'Produkt wird gesucht …';
      const result = await lookupProduct(scan.barcode, owner.signal);
      if (attempt !== owner) return;
      review.hidden = false;
      switch (result.kind) {
        case 'found':
          name.value = result.prefill.name;
          source.hidden = false;
          source.querySelector('a')!.href =
            'https://world.openfoodfacts.org/product/' + scan.barcode;
          lookup.textContent = 'Produkt gefunden. Bitte prüfe den Namen.';
          break;
        case 'unknown':
          lookup.textContent = 'Produkt unbekannt. Ergänze den Namen.';
          break;
        case 'incomplete':
          lookup.textContent = 'Produktname fehlt. Ergänze den Namen.';
          break;
        case 'failed':
          lookup.textContent = failures[result.reason] + ' Ergänze den Namen.';
          break;
        case 'cancelled':
        case 'invalid':
          break;
      }
    }
    attempt = undefined;
    start.disabled = false;
    stop.disabled = true;
  };
  stop.onclick = cancel;
  el('manual').onclick = () => {
    cancel();
    review.hidden = false;
    name.focus();
  };
  window.addEventListener('pagehide', cancel);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && attempt) cancel();
  });
  import.meta.hot?.dispose(cancel);
}
