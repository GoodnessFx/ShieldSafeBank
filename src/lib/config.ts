export const DEPOSIT_ADDRESSES = {
  BTC: 'bc1q4ulqydnrstew9hr2dkjaey5he2j2zyj83475mc',
  'USDT-ERC20': '0x18595c69b0e49dA32037E19246Fe88FA321De1C6',
} as const;

export const BTC_NETWORK = 'Bitcoin mainnet';
export const USDT_NETWORK = 'ERC-20 (Ethereum mainnet)';

/**
 * Bank identity. The bank name is always written out in full — account numbers
 * use `Shield Safe Bank-00000000`, never an abbreviation such as "SSB".
 */
export const BANK_NAME = 'Shield Safe Bank';
export const ACCOUNT_NUMBER_PREFIX = BANK_NAME;

export const GOOGLE_CLIENT_ID = '24300395823-ahbmo1pjkvnchlobe1gmf0em88mhmjgt.apps.googleusercontent.com';

/**
 * Where the shared backend lives.
 *   • localhost      → '/api' (Vite proxies it to the local server)
 *   • deployed       → the hosted backend URL below
 *   • override       → set VITE_API_BASE at build time (wins over both)
 *
 * Without a reachable backend the app falls back to per-browser storage, which
 * is why chats from other devices would not be visible.
 */
const HOSTED_API_BASE = 'https://shieldsafebank-api.onrender.com/api';
const envBase = (import.meta.env?.VITE_API_BASE as string | undefined)?.replace(/\/$/, '');
const isLocalHost = typeof window !== 'undefined'
  && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
export const API_BASE = envBase || (isLocalHost ? '/api' : HOSTED_API_BASE);

/**
 * Fallback base URL for the local shared server (port 4000).
 *
 * When the app is opened through a preview / tunnel URL the config above picks
 * the hosted backend, but if that is down or unreachable every request fails and
 * the whole app silently degrades to per-browser localStorage. Per-browser
 * storage is isolated between a normal window and an incognito window, which is
 * why chats from one browser were invisible in the other.
 *
 * The API layer retries failed requests against this local base, so the shared
 * server (chats, users, balances, admin console) keeps working even when the
 * configured backend can't be reached.
 */
export const LOCAL_API_BASE = 'http://localhost:4000/api';
