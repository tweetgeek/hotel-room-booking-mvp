import { CalendarDate } from '../../domain/calendar-date';
import type { Clock } from '../../application/ports/clock';

const PROPERTY_TIME_ZONE = 'Europe/Warsaw';
// 'sv-SE' formats as YYYY-MM-DD, which is exactly the CalendarDate wire format
const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: PROPERTY_TIME_ZONE });

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  today(): CalendarDate {
    return CalendarDate.parse(formatter.format(this.now()));
  }
}
