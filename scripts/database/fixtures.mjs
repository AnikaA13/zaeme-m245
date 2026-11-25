import { randomBytes, createHash, webcrypto } from 'node:crypto';
// RFC 9562 §5.7: 48 Bit Unix-Millisekunden, Version und Variante, 74 Zufallsbits.
// Derselbe Algorithmus benötigt im Browser nur Date.now und crypto.getRandomValues.
export function operationId(ms = Date.now()) {
  const b = webcrypto.getRandomValues(new Uint8Array(16));
  for (let i = 5; i >= 0; i--) {
    b[i] = ms % 256;
    ms = Math.floor(ms / 256);
  }
  b[6] = (b[6] & 15) | 112;
  b[8] = (b[8] & 63) | 128;
  const hex = Array.from(b, (n) => n.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
export function invitation() {
  const bytes = randomBytes(32);
  return {
    token: bytes.toString('base64url'),
    hash: '\\x' + createHash('sha256').update(bytes).digest('hex'),
  };
}
