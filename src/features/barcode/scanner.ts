import type { ScanResult } from './ean';
import type { createDecoder } from './decoder';

type CameraError =
  | 'activation-required'
  | 'permission-denied'
  | 'no-camera'
  | 'unavailable'
  | 'unsupported'
  | 'decode-failure';
export type ScannerOutcome = ScanResult | { kind: 'stopped' | CameraError };
export type ScannerState =
  ScannerOutcome['kind'] | 'idle' | 'requesting' | 'active' | 'unreadable';

let occupied = false;
function cameraError(error: unknown): CameraError {
  switch ((error as { name?: string } | null)?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'permission-denied';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'no-camera';
    default:
      return 'unavailable';
  }
}

/** Im Klick-Handler starten. Der Aufrufer beendet den Versuch mit seinem Signal. */
export function startScanner(
  video: HTMLVideoElement,
  signal: AbortSignal,
  onState: (state: ScannerState) => void,
): Promise<ScannerOutcome> {
  function immediate(kind: CameraError | 'stopped'): Promise<ScannerOutcome> {
    onState(kind);
    return Promise.resolve({ kind });
  }
  if (signal.aborted || document.hidden) return immediate('stopped');
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
    return immediate('unsupported');
  if (occupied) return immediate('unavailable');
  if (navigator.userActivation?.isActive === false)
    return immediate('activation-required');
  occupied = true;

  return new Promise((resolve) => {
    let done = false;
    let requesting = true;
    let stream: MediaStream | undefined;
    let timer: number | undefined;
    const listeners = new AbortController();

    function finish(outcome: ScannerOutcome) {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      listeners.abort();
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }
      // Eine offene Systemabfrage kann nicht abgebrochen werden.
      if (!requesting) occupied = false;
      resolve(outcome);
      onState(outcome.kind);
    }
    const stop = () => finish({ kind: 'stopped' });
    const options = { signal: listeners.signal };
    signal.addEventListener('abort', stop, options);
    window.addEventListener('pagehide', stop, options);
    window.addEventListener('popstate', stop, options);
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) stop();
      },
      options,
    );
    document.addEventListener('freeze', stop, options);

    async function run() {
      try {
        onState('requesting');
        if (done) {
          requesting = false;
          occupied = false;
          return;
        }
        const granted = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
          },
        });
        requesting = false;
        if (done) {
          granted.getTracks().forEach((track) => track.stop());
          occupied = false;
          return;
        }
        stream = granted;
        const tracks = stream.getVideoTracks();
        if (!tracks.length) {
          finish({ kind: 'no-camera' });
          return;
        }
        for (const track of tracks)
          track.addEventListener(
            'ended',
            () => finish({ kind: 'unavailable' }),
            options,
          );
        if (tracks.every((track) => track.readyState === 'ended')) {
          finish({ kind: 'unavailable' });
          return;
        }
        video.playsInline = true;
        video.muted = true;
        video.srcObject = stream;
        await video.play();
      } catch (error) {
        // Nur der noch wartende Versuch besitzt die Sperre nach Abbruch.
        if (done && requesting) occupied = false;
        requesting = false;
        finish({ kind: cameraError(error) });
        return;
      }
      if (done) return;
      let decode: ReturnType<typeof createDecoder>;
      try {
        const module = await import('./decoder');
        if (done) return;
        decode = module.createDecoder();
      } catch {
        finish({ kind: 'decode-failure' });
        return;
      }
      onState('active');
      const started = performance.now();
      let hinted = false;
      function tick() {
        if (done) return;
        try {
          const result = decode(video);
          if (result) {
            finish(result);
            return;
          }
        } catch {
          finish({ kind: 'decode-failure' });
          return;
        }
        if (!hinted && performance.now() - started >= 3000) {
          hinted = true;
          onState('unreadable');
        }
        if (!done) timer = window.setTimeout(tick, 160);
      }
      tick();
    }
    void run();
  });
}
