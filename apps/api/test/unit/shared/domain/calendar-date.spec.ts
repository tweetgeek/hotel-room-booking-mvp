import { CalendarDate } from '../../../../src/shared/domain/calendar-date';
import { DomainError } from '../../../../src/shared/domain/domain-error';

describe('CalendarDate', () => {
  it('parses an ISO calendar date without time', () => {
    expect(CalendarDate.parse('2026-11-10').value).toBe('2026-11-10');
  });

  it.each(['2026-02-30', '2026-13-01', '2026-1-1', '10.11.2026', '2026-11-10T00:00:00Z', ''])(
    'rejects %p',
    (raw) => {
      expect(() => CalendarDate.parse(raw)).toThrow(DomainError);
    },
  );

  it('adds days across month and year boundaries', () => {
    expect(CalendarDate.parse('2026-12-31').addDays(1).value).toBe('2027-01-01');
    expect(CalendarDate.parse('2026-03-01').addDays(-1).value).toBe('2026-02-28');
  });

  it('counts days between two dates', () => {
    expect(CalendarDate.parse('2026-11-10').daysUntil(CalendarDate.parse('2026-11-13'))).toBe(3);
    expect(CalendarDate.parse('2026-11-13').daysUntil(CalendarDate.parse('2026-11-10'))).toBe(-3);
  });

  it('orders dates', () => {
    const earlier = CalendarDate.parse('2026-11-10');
    const later = CalendarDate.parse('2026-11-11');
    expect(earlier.isBefore(later)).toBe(true);
    expect(later.isBefore(earlier)).toBe(false);
    expect(earlier.equals(CalendarDate.parse('2026-11-10'))).toBe(true);
  });
});
