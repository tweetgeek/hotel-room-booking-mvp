import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';
import { CalendarDate } from '../../../shared/domain/calendar-date';

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    CalendarDate.parse(value);
    return true;
  } catch {
    return false;
  }
}

/** `YYYY-MM-DD` that exists in the calendar; the message is the field code (ADR-009). */
export function IsCalendarDate(options: ValidationOptions = {}) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isCalendarDate',
      target: object.constructor,
      propertyName,
      options: { message: 'INVALID_DATE', ...options },
      validator: { validate: (value: unknown) => isCalendarDate(value) },
    });
  };
}

/** `to` is on or after `from` and at most `maxDays` days later. */
export function IsRangeEndWithin(fromProperty: string, maxDays: number, options: ValidationOptions = {}) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isRangeEndWithin',
      target: object.constructor,
      propertyName,
      constraints: [fromProperty, maxDays],
      options: { message: 'INVALID_FORMAT', ...options },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const from = (args.object as Record<string, unknown>)[fromProperty];
          if (!isCalendarDate(value) || !isCalendarDate(from)) return false;
          const days = CalendarDate.parse(from).daysUntil(CalendarDate.parse(value));
          return days >= 0 && days <= maxDays;
        },
      },
    });
  };
}
