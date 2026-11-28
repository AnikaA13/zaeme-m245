import { describe, expect, it } from 'vitest';
import { isEan13, validateScan } from './ean';

describe('EAN-13', () => {
  it.each(['3017620422003', '0034000470693', '2999999876544'])(
    'behält gültigen Code %s',
    (code) => {
      expect(validateScan('EAN_13', code)).toEqual({
        kind: 'detected',
        barcode: code,
      });
    },
  );
  it.each([
    '3017620422004',
    '301762042200',
    '03017620422003',
    '３０１７６２０４２２００３',
    '3017620422003\n',
    '30176204220A3',
    3017620422003,
  ])('verwirft %s', (code) => expect(isEan13(code)).toBe(false));
  it.each(['QR_CODE', 'UPC_A', 'EAN_8'])('verwirft Format %s', (format) =>
    expect(validateScan(format, '3017620422003')).toEqual({ kind: 'invalid' }),
  );
});
