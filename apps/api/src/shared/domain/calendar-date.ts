import { InvalidValueError } from './domain-error';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/**
 * A calendar date without time or zone, kept as `YYYY-MM-DD`.
 * Stays and nights are dates, not instants, so this type deliberately avoids `Date` (research R-05).
 */
export class CalendarDate {
  private constructor(readonly value: string) {}

  static parse(raw: string): CalendarDate {
    const match = ISO_DATE.exec(raw);
    if (!match) {
      throw new InvalidValueError(`Calendar date must be YYYY-MM-DD, got "${raw}"`);
    }
    const [, year, month, day] = match.map(Number);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    const roundTrips =
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day;
    if (!roundTrips) {
      throw new InvalidValueError(`Calendar date does not exist: "${raw}"`);
    }
    return new CalendarDate(raw);
  }

  static fromUtc(date: Date): CalendarDate {
    return new CalendarDate(date.toISOString().slice(0, 10));
  }

  addDays(days: number): CalendarDate {
    return CalendarDate.fromUtc(new Date(this.epochMs() + days * MS_PER_DAY));
  }

  daysUntil(other: CalendarDate): number {
    return Math.round((other.epochMs() - this.epochMs()) / MS_PER_DAY);
  }

  isBefore(other: CalendarDate): boolean {
    return this.value < other.value;
  }

  isAfter(other: CalendarDate): boolean {
    return this.value > other.value;
  }

  equals(other: CalendarDate): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  private epochMs(): number {
    return Date.parse(`${this.value}T00:00:00Z`);
  }
}
