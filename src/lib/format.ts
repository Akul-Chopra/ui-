import dayjs from 'dayjs';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const inrNumber = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

/** Formats an amount as ₹12,34,567.00 in the Indian numbering system. */
export function currency(amount: number | undefined | null): string {
  return inr.format(amount ?? 0);
}

/**
 * Condenses an amount for KPI tiles: ₹1.25 Cr, ₹12.50 L, ₹9,500. Mirrors the backend's
 * IndianFormat.Compact so a tile and a report of the same figure read consistently.
 */
export function compactCurrency(amount: number | undefined | null): string {
  const value = amount ?? 0;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 10_000_000) return `${sign}₹${inrNumber.format(abs / 10_000_000)} Cr`;
  if (abs >= 100_000) return `${sign}₹${inrNumber.format(abs / 100_000)} L`;
  return currency(value);
}

export function number(value: number | undefined | null): string {
  return inrNumber.format(value ?? 0);
}

export function date(value?: string | null): string {
  return value ? dayjs(value).format('DD MMM YYYY') : '—';
}

export function dateTime(value?: string | null): string {
  return value ? dayjs(value).format('DD MMM YYYY, HH:mm') : '—';
}

export function relativeTime(value?: string | null): string {
  if (!value) return '—';
  const then = dayjs(value);
  const now = dayjs();
  const mins = now.diff(then, 'minute');
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = now.diff(then, 'hour');
  if (hours < 24) return `${hours}h ago`;
  const days = now.diff(then, 'day');
  if (days < 30) return `${days}d ago`;
  return then.format('DD MMM YYYY');
}
