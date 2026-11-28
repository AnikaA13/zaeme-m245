import BarcodeFormat from '@zxing/library/esm/core/BarcodeFormat';
import BinaryBitmap from '@zxing/library/esm/core/BinaryBitmap';
import HybridBinarizer from '@zxing/library/esm/core/common/HybridBinarizer';
import EAN13Reader from '@zxing/library/esm/core/oned/EAN13Reader';
import NotFoundException from '@zxing/library/esm/core/NotFoundException';
import RGBLuminanceSource from '@zxing/library/esm/core/RGBLuminanceSource';
import { validateScan } from './ean';

export function createDecoder() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Kein Bildkontext verfügbar.');
  const reader = new EAN13Reader();
  return (video: HTMLVideoElement) => {
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight)
      return null;
    const scale = Math.min(
      1,
      1280 / Math.max(video.videoWidth, video.videoHeight),
    );
    const w = Math.max(1, Math.round(video.videoWidth * scale));
    const h = Math.max(1, Math.round(video.videoHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.drawImage(video, 0, 0, w, h);
    const rgba = ctx.getImageData(0, 0, w, h).data;
    const luminance = new Uint8ClampedArray(w * h);
    for (let i = 0; i < luminance.length; i++) {
      const p = i * 4;
      luminance[i] = (rgba[p] + 2 * rgba[p + 1] + rgba[p + 2]) >>> 2;
    }
    const bitmap = new BinaryBitmap(
      new HybridBinarizer(new RGBLuminanceSource(luminance, w, h)),
    );
    try {
      const result = reader.decode(bitmap);
      return validateScan(
        BarcodeFormat[result.getBarcodeFormat()],
        result.getText(),
      );
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  };
}
