import { CalendarDate } from '../../shared/domain/calendar-date';
import { InvalidStayError } from './errors/invalid-stay.error';

export const MAX_NIGHTS = 30;

export class Night {
  constructor(readonly date: CalendarDate) {}

  get value(): string {
    return this.date.value;
  }
}

/** Check-in inclusive to check-out exclusive; 1 to 30 nights; check-in not before today (FR-003). */
export class Stay {
  private constructor(
    readonly checkIn: CalendarDate,
    readonly checkOut: CalendarDate,
  ) {}

  static create(checkIn: CalendarDate, checkOut: CalendarDate, today: CalendarDate): Stay {
    if (checkIn.isBefore(today)) {
      throw new InvalidStayError('checkIn', 'CHECK_IN_IN_PAST', 'Check-in must not be before today.');
    }
    if (!checkOut.isAfter(checkIn)) {
      throw new InvalidStayError(
        'checkOut',
        'CHECK_OUT_NOT_AFTER_CHECK_IN',
        'Check-out must be after check-in.',
      );
    }
    if (checkIn.daysUntil(checkOut) > MAX_NIGHTS) {
      throw new InvalidStayError(
        'checkOut',
        'TOO_MANY_NIGHTS',
        `A stay may cover at most ${MAX_NIGHTS} nights.`,
      );
    }
    return new Stay(checkIn, checkOut);
  }

  // History is never re-validated against "today": a past stay must still rehydrate
  static fromHistory(checkIn: string, checkOut: string): Stay {
    return new Stay(CalendarDate.parse(checkIn), CalendarDate.parse(checkOut));
  }

  get nightCount(): number {
    return this.checkIn.daysUntil(this.checkOut);
  }

  nights(): Night[] {
    return Array.from({ length: this.nightCount }, (_, i) => new Night(this.checkIn.addDays(i)));
  }
}
