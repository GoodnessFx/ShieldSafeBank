/**
 * Safe number and date formatting helpers.
 *
 * Every formatter here accepts `unknown` and never throws. Values that are
 * missing, null, non numeric, NaN or Infinity render as 0 (or "n/a" for dates)
 * instead of crashing the page. API responses and locally stored records are
 * not guaranteed to carry every field, so formatting must not assume they do.
 */

export function toAmount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function fmtUSD(value: unknown): string {
  return toAmount(value).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtNumber(value: unknown, digits = 2): string {
  return toAmount(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtMoney(value: unknown, symbol: string, digits = 2): string {
  return symbol + fmtNumber(value, digits);
}

export function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function fmtDateTime(value: unknown): string {
  const date = toDate(value);
  return date ? date.toLocaleString() : 'n/a';
}

export function fmtDateTimeShort(value: unknown): string {
  const date = toDate(value);
  if (!date) return 'n/a';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtDateLong(value: unknown): string {
  const date = toDate(value);
  if (!date) return 'n/a';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function fmtTimeShort(value: unknown): string {
  const date = toDate(value);
  if (!date) return 'n/a';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function fmtText(value: unknown, fallback = 'n/a'): string {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text === '' ? fallback : text;
}
