/**
 * Full transaction ledger for Corery Masibay.
 * Source: website-transaction-history.xlsx (fictional demo data).
 * Data is sorted newest-first (current year downwards to oldest year),
 * which is the correct banking convention.
 *
 * This data is injected into the Dashboard History section only when
 * the signed-in email matches CORERY_EMAIL below.
 */
import _ledger from './corery_ledger.json';

export const CORERY_EMAIL = 'corerymasibay@yahoo.com';

/**
 * Returns true for any email that belongs to this account.
 * Matches the exact email, or any variation containing "corery" or "masibay"
 * so it works even if the account was registered with a slightly different address.
 */
export function isCoreryEmail(email: string): boolean {
  const e = (email || '').toLowerCase().trim();
  return (
    e === 'corerymasibay@yahoo.com' ||
    e.includes('corery') ||
    e.includes('masibay')
  );
}

export interface LedgerRow {
  date: string;
  description: string;
  counterparty: string;
  category: string;
  credit: number;
  debit: number;
  balance: number;
  reference: string;
  status: string;
}

/**
 * Full ledger: 1,990 transactions from Jan 2010 – Oct 2026,
 * sorted newest first (Oct 2026 → Jan 2010).
 */
export const CORERY_LEDGER: LedgerRow[] = _ledger as LedgerRow[];
