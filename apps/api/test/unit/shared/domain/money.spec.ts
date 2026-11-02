import { Money } from '../../../../src/shared/domain/money';
import { DomainError } from '../../../../src/shared/domain/domain-error';

describe('Money', () => {
  it('holds a non-negative integer amount of grosze in PLN', () => {
    const money = Money.of(32000);
    expect(money.amount).toBe(32000);
    expect(money.currency).toBe('PLN');
  });

  it.each([-1, 1.5, Number.NaN])('rejects %p as an amount', (amount) => {
    expect(() => Money.of(amount)).toThrow(DomainError);
  });

  it('multiplies by a number of nights', () => {
    expect(Money.of(32000).multiply(3)).toEqual(Money.of(96000));
  });

  it('compares by value', () => {
    expect(Money.of(100).equals(Money.of(100))).toBe(true);
    expect(Money.of(100).equals(Money.of(101))).toBe(false);
  });
});
