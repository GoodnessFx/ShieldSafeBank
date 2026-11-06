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
}

export const STATIC_USERS: StaticUser[] = [
  {
    email: 'combsholly88@gmail.com',
    password: 'ShieldSafe#2026',
    name: 'Holly Combs',
    balance: 9000,
    accountNumber: 'Shield Safe Bank-88310042',
    kycStatus: 'approved',
    type: 'personal',
    joined: '2026-11-06',
  },
  {
    email: 'sandim2011@gmail.com',
    password: 'ShieldSafe#2026',
    name: 'Sandra Magallanes',
    balance: 60000,
    accountNumber: 'Shield Safe Bank-20115511',
    kycStatus: 'approved',
    type: 'personal',
    joined: '2026-11-06',
  },
  {
    email: 'melimari88@gmail.com',
    password: 'ShieldSafe#2026',
    name: 'Meli Mari',
    balance: 10000,
    accountNumber: 'Shield Safe Bank-88201388',
    kycStatus: 'approved',
    type: 'personal',
    joined: '2026-11-06',
  },
  {
    email: 'loosegun@proton.me',
    password: 'ShieldSafe#2026',
    name: 'Loosegun',
    balance: 980000,
    accountNumber: 'Shield Safe Bank-66420014',
    kycStatus: 'approved',
    type: 'personal',
    joined: '2026-11-06',
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
