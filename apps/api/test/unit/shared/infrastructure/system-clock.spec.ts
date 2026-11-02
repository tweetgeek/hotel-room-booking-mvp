import { SystemClock } from '../../../../src/shared/infrastructure/time/system-clock';

describe('SystemClock', () => {
  afterEach(() => jest.useRealTimers());

  it('reports today in Europe/Warsaw, which is already the next day at 22:30 UTC in summer', () => {
    jest.useFakeTimers({ now: new Date('2026-07-15T22:30:00Z') });
    expect(new SystemClock().today().value).toBe('2026-07-16');
  });

  it('reports today in Europe/Warsaw, which is the next day at 23:30 UTC in winter', () => {
    jest.useFakeTimers({ now: new Date('2026-12-31T23:30:00Z') });
    expect(new SystemClock().today().value).toBe('2027-01-01');
    expect(new SystemClock().now().toISOString()).toBe('2026-12-31T23:30:00.000Z');
  });
});
