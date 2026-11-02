import { describe, expect, it } from 'vitest';
import { addDays, monthGrid, nightsBetween, threeMonthsFrom, todayInWarsaw } from '../../src/lib/dates';

describe('dates', () => {
  it('computes today in Europe/Warsaw from an instant', () => {
    expect(todayInWarsaw(new Date('2026-07-15T22:30:00Z'))).toBe('2026-07-16');
    expect(todayInWarsaw(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });

  it('adds days across month boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('lists the nights of a stay: check-in inclusive, check-out exclusive', () => {
    expect(nightsBetween('2026-11-10', '2026-11-13')).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']);
    expect(nightsBetween('2026-11-10', '2026-11-10')).toEqual([]);
  });

  it('builds a Monday-first month grid with empty leading cells', () => {
    const november = monthGrid(2026, 11);
    expect(november.slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(november.at(-1)).toBe('2026-11-30');
    expect(november).toHaveLength(36);
    expect(monthGrid(2026, 12).slice(0, 2)).toEqual([null, '2026-12-01']);
  });

  it('returns the current month and the two following ones', () => {
    expect(threeMonthsFrom('2026-11-15')).toEqual([
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
    ]);
  });
});
