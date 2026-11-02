import { Stay } from '../../../../src/booking/domain/stay';
import { CalendarDate } from '../../../../src/shared/domain/calendar-date';
import { InvalidStayError } from '../../../../src/booking/domain/errors';

const d = CalendarDate.parse;
const today = d('2026-11-03');

describe('Stay', () => {
  it('covers the nights from check-in inclusive to check-out exclusive', () => {
    const stay = Stay.create(d('2026-11-10'), d('2026-11-13'), today);
    expect(stay.nightCount).toBe(3);
    expect(stay.nights().map((n) => n.value)).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']);
  });

  it('allows a stay starting today', () => {
    expect(Stay.create(today, d('2026-11-04'), today).nightCount).toBe(1);
  });

  it('rejects a check-in before today', () => {
    expect(() => Stay.create(d('2026-11-02'), d('2026-11-04'), today)).toThrow(InvalidStayError);
    expect(() => Stay.create(d('2026-11-02'), d('2026-11-04'), today)).toThrow(
      expect.objectContaining({ extras: { details: [{ field: 'checkIn', code: 'CHECK_IN_IN_PAST' }] } }),
    );
  });

  it('rejects a check-out that is not after the check-in', () => {
    expect(() => Stay.create(d('2026-11-10'), d('2026-11-10'), today)).toThrow(
      expect.objectContaining({
        extras: { details: [{ field: 'checkOut', code: 'CHECK_OUT_NOT_AFTER_CHECK_IN' }] },
      }),
    );
  });

  it('allows 30 nights and rejects 31', () => {
    expect(Stay.create(d('2026-11-10'), d('2026-12-10'), today).nightCount).toBe(30);
    expect(() => Stay.create(d('2026-11-10'), d('2026-12-11'), today)).toThrow(
      expect.objectContaining({ extras: { details: [{ field: 'checkOut', code: 'TOO_MANY_NIGHTS' }] } }),
    );
  });

  it('rehydrates from history without re-checking the "today" rule', () => {
    const stay = Stay.fromHistory('2026-01-01', '2026-01-03');
    expect(stay.nightCount).toBe(2);
  });
});
