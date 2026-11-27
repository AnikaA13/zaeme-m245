import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createDecoder } from './decoder';
import { startScanner } from './scanner';
import { validateScan } from './ean';
vi.mock('./decoder', () => ({ createDecoder: vi.fn() }));

const acquire = vi.fn<() => Promise<MediaStream>>();
let owner: AbortController;
let video: HTMLVideoElement;
let tracks: (EventTarget & { stop: ReturnType<typeof vi.fn> })[];
let media: MediaStream;
const state = vi.fn();
const decode = vi.fn<ReturnType<typeof createDecoder>>();
const scan = () => startScanner(video, owner.signal, state);

beforeEach(() => {
  owner = new AbortController();
  video = document.createElement('video');
  tracks = [
    Object.assign(new EventTarget(), { stop: vi.fn() }),
    Object.assign(new EventTarget(), { stop: vi.fn() }),
  ];
  media = {
    getVideoTracks: () => tracks,
    getTracks: () => tracks,
  } as unknown as MediaStream;
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: acquire } });
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.spyOn(video, 'play').mockResolvedValue();
  state.mockClear();
  acquire.mockReset().mockResolvedValue(media);
  decode.mockReset().mockReturnValue(null);
  vi.mocked(createDecoder).mockReturnValue(decode);
});
afterEach(() => {
  owner.abort();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it.each([
  ['NotAllowedError', 'permission-denied'],
  ['NotFoundError', 'no-camera'],
  ['NotReadableError', 'unavailable'],
])('ordnet %s zu', async (name, kind) => {
  acquire.mockRejectedValue(new DOMException('', name));
  expect(await scan()).toEqual({ kind });
  expect(acquire).toHaveBeenCalledTimes(1);
});
it('erkennt unsicheren Kontext vor der Freigabe', async () => {
  vi.stubGlobal('isSecureContext', false);
  expect(await scan()).toEqual({ kind: 'unsupported' });
  expect(acquire).not.toHaveBeenCalled();
});
it('erkennt fehlende Videoschiene', async () => {
  acquire.mockResolvedValue({
    ...media,
    getVideoTracks: () => [],
  } as MediaStream);
  expect(await scan()).toEqual({ kind: 'no-camera' });
  expect(tracks[0].stop).toHaveBeenCalledOnce();
});
it('beendet spät gewährte Tracks und sperrt zusätzliche Anfragen bis zur Antwort', async () => {
  let grant!: (s: MediaStream) => void;
  acquire.mockReturnValueOnce(
    new Promise((resolve) => {
      grant = resolve;
    }),
  );
  const first = scan();
  owner.abort();
  expect(await first).toEqual({ kind: 'stopped' });
  owner = new AbortController();
  expect(await scan()).toEqual({ kind: 'unavailable' });
  expect(acquire).toHaveBeenCalledOnce();
  grant(media);
  await Promise.resolve();
  for (const track of tracks) expect(track.stop).toHaveBeenCalledOnce();
  expect(video.play).not.toHaveBeenCalled();
  acquire.mockRejectedValue(new DOMException('', 'NotAllowedError'));
  expect(await scan()).toEqual({ kind: 'permission-denied' });
});
it('akzeptiert nur eine Kamera und beendet sie vor dem einmaligen Lookup', async () => {
  vi.useFakeTimers();
  const first = scan();
  expect(await scan()).toEqual({ kind: 'unavailable' });
  const lookup = vi.fn();
  const selected = first.then((result) => {
    if (result.kind === 'detected') lookup(result.barcode);
  });
  decode.mockReturnValue(validateScan('EAN_13', '0034000470693'));
  await selected;
  await vi.advanceTimersByTimeAsync(4000);
  expect(lookup).toHaveBeenCalledExactlyOnceWith('0034000470693');
  expect(decode).toHaveBeenCalledOnce();
  expect(video.playsInline && video.muted).toBe(true);
  expect(video.srcObject).toBeNull();
  for (const track of tracks) expect(track.stop).toHaveBeenCalledOnce();
  expect(acquire).toHaveBeenCalledExactlyOnceWith({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
  });
});
it.each([
  'pagehide',
  'popstate',
  'visibilitychange',
  'freeze',
  'ended',
  'session',
])('beendet Vorschau bei %s', async (event) => {
  const pending = scan();
  await vi.waitFor(() => expect(state).toHaveBeenCalledWith('active'));
  if (event === 'session') owner.abort();
  else if (event === 'ended') tracks[0].dispatchEvent(new Event(event));
  else if (event === 'visibilitychange' || event === 'freeze') {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event(event));
  } else window.dispatchEvent(new Event(event));
  expect(await pending).toEqual({
    kind: event === 'ended' ? 'unavailable' : 'stopped',
  });
  for (const track of tracks) expect(track.stop).toHaveBeenCalledOnce();
});
it('räumt beim Unmount eines integrierenden Components auf', async () => {
  function View() {
    useEffect(() => {
      void scan();
      return () => owner.abort();
    }, []);
    return null;
  }
  const view = render(<View />);
  await vi.waitFor(() => expect(state).toHaveBeenCalledWith('active'));
  view.unmount();
  expect(video.srcObject).toBeNull();
  expect(tracks[0].stop).toHaveBeenCalledOnce();
});
it('beendet einen technischen Decoderfehler und erlaubt manuellen Neustart', async () => {
  decode.mockImplementationOnce(() => {
    throw new Error();
  });
  expect(await scan()).toEqual({ kind: 'decode-failure' });
  expect(tracks[0].stop).toHaveBeenCalledOnce();
  decode.mockReturnValue({ kind: 'invalid' });
  expect(await scan()).toEqual({ kind: 'invalid' });
});

it('fordert ohne Benutzeraktion keine Berechtigung an', async () => {
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: acquire },
    userActivation: { isActive: false },
  });
  expect(await scan()).toEqual({ kind: 'activation-required' });
  expect(acquire).not.toHaveBeenCalled();
});

it('liest nach einem Hinweis auf einen unlesbaren Frame weiter', async () => {
  vi.useFakeTimers();
  const pending = scan();
  await vi.waitFor(() => expect(state).toHaveBeenCalledWith('active'));
  await vi.advanceTimersByTimeAsync(3300);
  expect(state).toHaveBeenCalledWith('unreadable');
  decode.mockReturnValue(validateScan('EAN_13', '3017620422003'));
  await vi.advanceTimersByTimeAsync(200);
  expect(await pending).toEqual({ kind: 'detected', barcode: '3017620422003' });
});
