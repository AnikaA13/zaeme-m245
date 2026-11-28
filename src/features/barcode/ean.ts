declare const validated: unique symbol;
export type Ean13 = string & { readonly [validated]: true };

export function isEan13(value: unknown): value is Ean13 {
  if (typeof value !== 'string' || value.length !== 13 || /[^0-9]/.test(value))
    return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(value[i]) * (i % 2 === 0 ? 1 : 3);
  return sum % 10 === 0;
}

export type ScanResult =
  { kind: 'detected'; barcode: Ean13 } | { kind: 'invalid' };
export function validateScan(format: string, text: string): ScanResult {
  return format === 'EAN_13' && isEan13(text)
    ? { kind: 'detected', barcode: text }
    : { kind: 'invalid' };
}
