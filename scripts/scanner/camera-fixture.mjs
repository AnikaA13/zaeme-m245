import { Buffer } from 'node:buffer';
import { mkdtemp, writeFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const barcode = '0034000470693';

export async function cameraFixture(partialFrames = 0) {
  // EAN-13 mit erster Ziffer 0: alle sechs linken Zeichen verwenden L-Parität.
  const left = [
    '0001101',
    '0011001',
    '0010011',
    '0111101',
    '0100011',
    '0110001',
    '0101111',
    '0111011',
    '0110111',
    '0001011',
  ];
  const right = left.map((pattern) =>
    [...pattern].map((bit) => (bit === '1' ? '0' : '1')).join(''),
  );
  const bits =
    '101' +
    [...barcode.slice(1, 7)].map((n) => left[n]).join('') +
    '01010' +
    [...barcode.slice(7)].map((n) => right[n]).join('') +
    '101';
  const width = 640,
    height = 480;
  const frame = Buffer.alloc(width * height * 1.5, 128);
  frame.fill(235, 0, width * height);
  for (let y = 150; y < 330; y++)
    for (let x = 0; x < bits.length; x++) {
      if (bits[x] === '1')
        frame.fill(16, y * width + 130 + x * 4, y * width + 134 + x * 4);
    }

  const partial = Buffer.from(frame);
  // Zunächst liegt nur der linke Teil des Codes im Bild.
  for (let y = 150; y < 330; y++)
    partial.fill(235, y * width + 320, (y + 1) * width);
  const marker = Buffer.from('FRAME\n');
  const dir = await mkdtemp(join(tmpdir(), 'zaeme-ean-'));
  const file = join(dir, 'ean.y4m');
  const close = async () => {
    await rm(file, { force: true });
    await rmdir(dir);
  };
  try {
    await writeFile(
      file,
      Buffer.concat([
        Buffer.from('YUV4MPEG2 W640 H480 F10:1 Ip A1:1 C420jpeg\n'),
        ...Array.from({ length: partialFrames }, () => [
          marker,
          partial,
        ]).flat(),
        ...Array.from({ length: 8 }, () => [marker, frame]).flat(),
      ]),
    );
  } catch (error) {
    await close();
    throw error;
  }
  return {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-file-for-fake-video-capture=' + file,
    ],
    close,
  };
}
