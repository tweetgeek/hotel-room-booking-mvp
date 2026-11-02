import { InvalidValueError } from './domain-error';

export type Currency = 'PLN';

export class Money {
  private constructor(
    readonly amount: number,
    readonly currency: Currency,
  ) {}

  static of(amount: number, currency: Currency = 'PLN'): Money {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new InvalidValueError(`Money amount must be a non-negative integer of grosze, got ${amount}`);
    }
    return new Money(amount, currency);
  }

  multiply(factor: number): Money {
    return Money.of(this.amount * factor, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}
