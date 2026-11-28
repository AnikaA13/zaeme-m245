import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useCapture } from '../../components/navigation/Navigation';
import { activeScope } from '../auth/session';
import { lookupProduct, type LookupResult } from '../barcode/lookup';
import { startScanner, type ScannerState } from '../barcode/scanner';
import type { Ean13 } from '../barcode/ean';
import type { CaptureInput } from '../inventory/domain';
import { ProductForm } from './ProductForm';
import { ProductSource } from './ProductSource';

const guidance: Record<ScannerState, string> = {
  idle: 'Halte die Verpackung bereit. Beim Start fragt dein Browser nach dem Kamerazugriff.',
  requesting: 'Kamerazugriff wird angefragt …',
  active: 'Halte den Barcode mit senkrechten Strichen in den Rahmen.',
  unreadable:
    'Noch kein lesbarer Barcode. Halte die Kamera ruhig, ändere den Abstand und vermeide Spiegelungen.',
  stopped: 'Die Kamera ist ausgeschaltet.',
  'activation-required': 'Tippe auf «Kamera starten», um die Kamera zu öffnen.',
  'permission-denied':
    'Die Kamera ist gesperrt. Erfasse das Lebensmittel manuell oder erlaube den Kamerazugriff in den Website-Einstellungen.',
  'no-camera': 'Auf diesem Gerät wurde keine Kamera gefunden.',
  unavailable: 'Die Kamera ist gerade nicht verfügbar.',
  unsupported:
    'Die Kamera ist auf dieser Seite nicht verfügbar. Öffne zäme über eine sichere Verbindung oder erfasse das Lebensmittel manuell.',
  'decode-failure':
    'Der Scanner konnte das Bild nicht lesen. Versuche es erneut oder erfasse das Lebensmittel manuell.',
  invalid:
    'Der gelesene Code ist kein gültiger EAN-13. Versuche es erneut oder erfasse das Lebensmittel manuell.',
  detected: 'Barcode erkannt. Produktinformationen werden geladen …',
};
type Review = { seed: CaptureInput; message: string };

function barcodeOnly(barcode: Ean13): Review {
  return {
    seed: { barcode, lookup: { outcome: 'unavailable' } },
    message: 'Barcode erkannt. Ergänze den Produktnamen.',
  };
}
function productReview(
  result: Exclude<LookupResult, { kind: 'invalid' }>,
): Review {
  const { barcode } = result.prefill;
  switch (result.kind) {
    case 'found':
      return {
        seed: {
          barcode,
          lookup: { outcome: 'verified', name: result.prefill.name },
        },
        message: 'Produkt erkannt. Prüfe den vorgeschlagenen Namen.',
      };
    case 'unknown':
      return {
        seed: { barcode, lookup: { outcome: 'unknown' } },
        message: 'Produkt nicht gefunden. Ergänze den Produktnamen.',
      };
    case 'failed':
      return {
        seed: { barcode, lookup: { outcome: 'unavailable' } },
        message:
          'Produktinformationen konnten nicht geladen werden. ' +
          (result.reason === 'timeout'
            ? 'Die Antwort hat zu lange gedauert. '
            : result.reason === 'rate-limit'
              ? 'Es gab zu viele Anfragen. '
              : '') +
          'Ergänze den Produktnamen.',
      };
    default:
      return barcodeOnly(barcode);
  }
}

export default function ScanPage() {
  const navigate = useNavigate();
  const capture = useCapture();
  const scope = activeScope().signal;
  const video = useRef<HTMLVideoElement>(null);
  const attempt = useRef<AbortController | null>(null);
  const code = useRef<Ean13 | null>(null);
  const [state, setState] = useState<ScannerState>('idle');
  const [review, setReview] = useState<Review>();
  const status = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const stop = () => attempt.current?.abort();
    const background = () => {
      if (!attempt.current || attempt.current.signal.aborted || scope.aborted)
        return;
      stop();
      if (code.current) setReview(barcodeOnly(code.current));
      else setState('stopped');
    };
    const visibility = () => {
      if (document.hidden) background();
    };
    scope.addEventListener('abort', stop);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('freeze', background);
    window.addEventListener('pagehide', background);
    return () => {
      stop();
      scope.removeEventListener('abort', stop);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('freeze', background);
      window.removeEventListener('pagehide', background);
    };
  }, [scope]);
  useLayoutEffect(() => {
    if (review) status.current?.focus();
  }, [review]);

  async function start() {
    if (
      !video.current ||
      scope.aborted ||
      (attempt.current && !attempt.current.signal.aborted)
    )
      return;
    const controller = new AbortController();
    attempt.current = controller;
    const valid = () => !scope.aborted && !controller.signal.aborted;
    try {
      const outcome = await startScanner(
        video.current,
        controller.signal,
        (next) => {
          if (valid()) setState(next);
        },
      );
      if (!valid() || outcome.kind !== 'detected') return;
      code.current = outcome.barcode;
      const result = await lookupProduct(outcome.barcode, controller.signal);
      if (!valid()) return;
      if (result.kind === 'invalid') setState('invalid');
      else setReview(productReview(result));
    } finally {
      if (attempt.current === controller) attempt.current = null;
    }
  }
  function manual() {
    attempt.current?.abort();
    if (scope.aborted) return;
    if (code.current) setReview(barcodeOnly(code.current));
    else void navigate('/capture/manual', { replace: true });
  }
  if (review)
    return (
      <ProductForm
        seed={review.seed}
        review={
          <div>
            <p role="status" ref={status} tabIndex={-1}>
              {review.message}
            </p>
            {review.seed.lookup.outcome === 'verified' && (
              <ProductSource barcode={review.seed.barcode} />
            )}
          </div>
        }
      />
    );

  const busy = ['requesting', 'active', 'unreadable', 'detected'].includes(
    state,
  );
  const cameraFailed = !busy && state !== 'idle' && state !== 'stopped';
  return (
    <>
      <h1>Lebensmittel scannen</h1>
      {state !== 'detected' && (
        <div className="scan-window" hidden={cameraFailed}>
          <video
            ref={video}
            muted
            playsInline
            aria-label="Livebild der Kamera"
          />
          <span className="scan-guide" aria-hidden="true" />
        </div>
      )}
      <p role="status">{guidance[state]}</p>
      {!busy && !cameraFailed && (
        <button onClick={() => void start()}>Kamera starten</button>
      )}
      <button
        className={cameraFailed ? undefined : 'secondary'}
        onClick={manual}
      >
        {state === 'detected'
          ? 'Suche abbrechen und manuell ergänzen'
          : 'Manuell hinzufügen'}
      </button>
      {cameraFailed && (
        <button className="secondary" onClick={() => void start()}>
          Kamera erneut versuchen
        </button>
      )}
      <button
        className="text-button"
        onClick={() => {
          attempt.current?.abort();
          capture.cancel();
        }}
      >
        Abbrechen
      </button>
    </>
  );
}
