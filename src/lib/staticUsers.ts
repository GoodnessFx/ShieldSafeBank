/**
 * Static user list — no backend required.
 * Anyone with the email + password below can log in and see their balance.
 * To add or change a user, edit this file and redeploy.
 */
export interface StaticUser {
  email: string;
  password: string;
  name: string;
  balance: number;
  accountNumber: string;
  kycStatus: string;
  type: string;
  joined: string;
  cardLast4: string;
  cardHolder: string;
  cardExp: string;
  cardBrand: string;
  cardStatus: string;
  cardOwner: boolean;    // true = shown as a verified card owner on the dashboard
  cardVerified: boolean; // true = card identity confirmed
  achBankName: string;
  achLast4: string;
  achRouting: string;
  achType: string;
  achAccountName: string;
  achAccountNumber: string;
  dailyLimit: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
}

export const STATIC_USERS: StaticUser[] = [
  {
    email: 'combsholly88@gmail.com',
    password: 'ShieldSafe#2026',
    name: 'Holly Combs',
    firstName: 'Holly',
    lastName: 'Combs',
    balance: 9000,
    accountNumber: 'Shield Safe Bank-88310042',
    kycStatus: 'approved',
    type: 'personal',
    joined: '2026-11-06',
    phone: '',
    address: '',
    cardLast4: '4821',
    cardHolder: 'HOLLY COMBS',
    cardExp: '12/28',
    cardBrand: 'Visa',
    cardStatus: 'Active',
    cardOwner: true,
    cardVerified: true,
    achBankName: 'Chase Bank',
    achLast4: '3801',
    achRouting: '021000021',
    achType: 'ACH',
    achAccountName: 'Holly Combs',
    achAccountNumber: '1038013801',
    dailyLimit: '$5,000 / day',
  },
  {
    email: 'sandim2011@gmail.com',
    password: 'ShieldSafe#2026',
    name: 'Sandra Magallanes',
    firstName: 'Sandra',
    lastName: 'Magallanes',
    balance: 60000,
    accountNumber: 'Shield Safe Bank-20115511',
    kycStatus: 'approved',
    type: 'personal',
    joined: '2026-11-06',
    phone: '',
    address: '',
    cardLast4: '5512',
    cardHolder: 'SANDRA MAGALLANES',
    cardExp: '11/27',
    cardBrand: 'Mastercard',
    cardStatus: 'Active',
    cardOwner: true,
    cardVerified: true,
    achBankName: 'Bank of America',
    achLast4: '5511',
    achRouting: '026009593',
    achType: 'ACH',
    achAccountName: 'Sandra Magallanes',
    achAccountNumber: '1055115511',
    dailyLimit: '$10,000 / day',
  },
  {
    email: 'melimari88@gmail.com',
    password: 'ShieldSafe#2026',
    name: 'Meli Mari',
    firstName: 'Meli',
    lastName: 'Mari',
    balance: 10000,
    accountNumber: 'Shield Safe Bank-88201388',
    kycStatus: 'approved',
    type: 'personal',
    joined: '2026-11-06',
    phone: '',
    address: '',
    cardLast4: '8813',
    cardHolder: 'MELI MARI',
    cardExp: '09/27',
    cardBrand: 'Visa',
    cardStatus: 'Active',
    cardOwner: true,
    cardVerified: true,
    achBankName: 'Wells Fargo',
    achLast4: '8813',
    achRouting: '121000247',
    achType: 'ACH',
    achAccountName: 'Meli Mari',
    achAccountNumber: '1088138813',
    dailyLimit: '$5,000 / day',
  },
  {
    email: 'loosegun@proton.me',
    password: 'ShieldSafe#2026',
    name: 'Loosegun',
    firstName: 'Loosegun',
    lastName: '',
    balance: 980000,
    accountNumber: 'Shield Safe Bank-66420014',
    kycStatus: 'approved',
    type: 'personal',
    joined: '2026-11-06',
    phone: '',
    address: '',
    cardLast4: '4201',
    cardHolder: 'LOOSEGUN',
    cardExp: '08/28',
    cardBrand: 'Visa',
    cardStatus: 'Active',
    cardOwner: true,
    cardVerified: true,
    achBankName: 'Citibank',
    achLast4: '4201',
    achRouting: '021000089',
    achType: 'ACH',
    achAccountName: 'Loosegun',
    achAccountNumber: '1042014201',
    dailyLimit: '$50,000 / day',
  },
];

/** Look up a user by email + password. Returns null if not found or wrong password. */
export function staticLogin(email: string, password: string): StaticUser | null {
  const e = email.trim().toLowerCase();
  const user = STATIC_USERS.find(u => u.email.toLowerCase() === e);
  if (!user) return null;
  if (user.password !== password) return null;
  return user;
}

/** Look up a user by email only (for dashboard reload). */
export function staticGetUser(email: string): StaticUser | null {
  const e = email.trim().toLowerCase();
  return STATIC_USERS.find(u => u.email.toLowerCase() === e) || null;
}

export const STATIC_SESSION_KEY = 'ssb_static_user';

// ---------------------------------------------------------------------------
// Admin credentials (hardcoded — no backend needed)
// ---------------------------------------------------------------------------
export interface AdminCredential {
  email: string;
  password: string;
  name: string;
}

export const ADMIN_CREDENTIALS: AdminCredential[] = [
  {
    email: 'admin@shieldsafebank.com',
    password: 'Admin#Shield2026',
    name: 'Shield Safe Admin',
  },
];

/** Verify admin email + password. Returns the credential or null. */
export function staticAdminLogin(email: string, password: string): AdminCredential | null {
  const e = email.trim().toLowerCase();
  return ADMIN_CREDENTIALS.find(a => a.email.toLowerCase() === e && a.password === password) || null;
}

// ---------------------------------------------------------------------------
// Mutable runtime store for admin edits
// (persisted to localStorage so changes survive page reload)
// ---------------------------------------------------------------------------
const STORE_KEY = 'ssb_static_store';

function loadStore(): Record<string, Partial<StaticUser>> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveStore(store: Record<string, Partial<StaticUser>>) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch { /* storage unavailable */ }
}

/** Get a user's current data, merged with any admin edits. */
export function getStaticUser(email: string): StaticUser | null {
  const e = email.trim().toLowerCase();
  const base = STATIC_USERS.find(u => u.email.toLowerCase() === e);
  if (!base) return null;
  const store = loadStore();
  return { ...base, ...(store[e] || {}) };
}

/** Get all users with admin edits applied. */
export function getAllStaticUsers(): StaticUser[] {
  const store = loadStore();
  return STATIC_USERS.map(u => ({ ...u, ...(store[u.email.toLowerCase()] || {}) }));
}

/** Admin updates any field(s) for a user. Persists to localStorage. */
export function updateStaticUser(email: string, patch: Partial<StaticUser>): StaticUser | null {
  const e = email.trim().toLowerCase();
  const base = STATIC_USERS.find(u => u.email.toLowerCase() === e);
  if (!base) return null;
  const store = loadStore();
  store[e] = { ...(store[e] || {}), ...patch };
  saveStore(store);
  // Also update the live session if this is the currently logged-in user
  try {
    const raw = localStorage.getItem(STATIC_SESSION_KEY);
    if (raw) {
      const sess = JSON.parse(raw);
      if (sess && sess.email && sess.email.toLowerCase() === e) {
        localStorage.setItem(STATIC_SESSION_KEY, JSON.stringify({ ...sess, ...patch }));
      }
    }
  } catch { /* ignore */ }
  return getStaticUser(email);
}
