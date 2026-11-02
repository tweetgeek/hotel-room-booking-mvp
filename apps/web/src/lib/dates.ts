const MS_PER_DAY = 86_400_000;
const warsawFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' });

export type IsoDate = string;

export function todayInWarsaw(now: Date = new Date()): IsoDate {
  return warsawFormatter.format(now);
}

function toUtc(date: IsoDate): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function fromUtc(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtc(toUtc(date) + days * MS_PER_DAY);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / MS_PER_DAY);
}

/** Nights of a stay: check-in inclusive, check-out exclusive. */
export function nightsBetween(checkIn: IsoDate, checkOut: IsoDate): IsoDate[] {
  const count = daysBetween(checkIn, checkOut);
  return Array.from({ length: Math.max(count, 0) }, (_, i) => addDays(checkIn, i));
}

/** Days of a month preceded by `null` cells so the first day lands on its weekday (Monday first). */
export function monthGrid(year: number, month: number): Array<IsoDate | null> {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const mondayFirstIndex = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<IsoDate | null> = Array.from({ length: mondayFirstIndex }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(fromUtc(Date.UTC(year, month - 1, day)));
  }
  return cells;
}

export interface YearMonth {
  year: number;
  month: number;
}

export function threeMonthsFrom(today: IsoDate): YearMonth[] {
  const [year, month] = today.split('-').map(Number);
  return [0, 1, 2].map((offset) => {
    const d = new Date(Date.UTC(year, month - 1 + offset, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  });
}

export function formatDate(date: IsoDate): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Warsaw',
  }).format(new Date(iso));
}
