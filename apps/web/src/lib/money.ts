export function formatMoney(amountInGrosze: number, currency: string): string {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(amountInGrosze / 100);
}
