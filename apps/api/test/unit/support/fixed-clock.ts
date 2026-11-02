import { CalendarDate } from '../../../src/shared/domain/calendar-date';
import type { Clock } from '../../../src/shared/application/ports/clock';

export class FixedClock implements Clock {
  constructor(
    private current: Date,
    private readonly todayValue?: string,
  ) {}

  static at(iso: string, today?: string): FixedClock {
    return new FixedClock(new Date(iso), today);
  }

  now(): Date {
    return new Date(this.current);
  }

  today(): CalendarDate {
    return CalendarDate.parse(this.todayValue ?? this.current.toISOString().slice(0, 10));
  }

  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
}
