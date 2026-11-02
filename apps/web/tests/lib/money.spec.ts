import { describe, expect, it } from 'vitest';
import { formatMoney } from '../../src/lib/money';

const plain = (s: string) => s.replace(/\u00a0/g, ' ');

describe('formatMoney', () => {
  it('formats grosze as Polish złoty', () => {
    expect(plain(formatMoney(96000, 'PLN'))).toBe('960,00 zł');
    expect(plain(formatMoney(32000, 'PLN'))).toBe('320,00 zł');
    expect(plain(formatMoney(5, 'PLN'))).toBe('0,05 zł');
  });
});
