import type { CalendarDate } from '../../domain/calendar-date';

export const CLOCK = Symbol('Clock');

export interface Clock {
  now(): Date;
  /** The calendar date in Europe/Warsaw; "today" for stay rules is defined in the property's zone. */
  today(): CalendarDate;
}
