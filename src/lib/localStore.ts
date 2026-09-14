export interface StoreUser {
  email: string;
  name: string;
  type: string;
  joined: string;
  lastLogin: string;
  status: 'pending' | 'verified';
  balance: number;
}

export interface ActivityEvent {
  id: string;
  email: string;
  name: string;
  action: 'signup' | 'login' | 'verified';
  via: 'email' | 'google' | 'admin';
  at: string;
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

export interface ChatMessage {
  from: 'user' | 'admin';
  text: string;
  time: string;
  at: string;
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

const USERS_KEY = 'ssb_live_users';
const ACTIVITY_KEY = 'ssb_live_activity';
const THREADS_KEY = 'ssb_live_threads';
const MESSAGES_KEY = 'ssb_live_messages';
const GUEST_KEY = 'ssb_live_guest';
const TXS_KEY = 'ssb_live_txs';

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

export function recordAuth(email: string, name: string, action: 'signup' | 'login', via: 'email' | 'google', type = 'personal') {
  const users = read<Record<string, StoreUser>>(USERS_KEY, {});
  const oid = email.toLowerCase();
  const prev = users[oid];
  users[oid] = {
    email,
    name: prev ? prev.name : name,
    type: prev ? prev.type : type,
    joined: prev ? prev.joined : nowIso(),
    lastLogin: nowIso(),
    status: prev ? prev.status : 'pending',
    balance: prev ? prev.balance : 0,
  };
  write(USERS_KEY, users);

  const activity = read<ActivityEvent[]>(ACTIVITY_KEY, []);
  activity.unshift({ id: uid('a'), email, name, action, via, at: nowIso() });
  write(ACTIVITY_KEY, activity.slice(0, 300));

  return users[oid];
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

export function pushChatMessage(id: string, user: string, email: string, text: string, from: 'user' | 'admin') {
  ensureThread(id, user, email);
  const threads = read<ChatThread[]>(THREADS_KEY, []);
  const messages = read<Record<string, ChatMessage[]>>(MESSAGES_KEY, {});
  const time = nowTime();
  const at = nowIso();

  threads.forEach(t => {
    if (t.id === id) {
      t.preview = text;
      t.time = time;
      t.at = at;
      if (from === 'user') t.unread = true;
      else t.unread = false;
    }
  });
  write(THREADS_KEY, threads);

  const list = messages[id] || [];
  list.push({ from, text, time, at });
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

export function getUser(email: string): StoreUser | null {
  const users = read<Record<string, StoreUser>>(USERS_KEY, {});
  return users[email.toLowerCase()] || null;
}

export function currentEmail(): string {
  const lu = read<{ email?: string } | null>('ssb_local_user', null);
  return lu && lu.email ? lu.email.toLowerCase() : '';
}

export function verifyUser(email: string) {
  const users = read<Record<string, StoreUser>>(USERS_KEY, {});
  const oid = email.toLowerCase();
  const user = users[oid];
  if (!user) return;
  user.status = 'verified';
  users[oid] = user;
  write(USERS_KEY, users);

  const activity = read<ActivityEvent[]>(ACTIVITY_KEY, []);
  activity.unshift({ id: uid('a'), email: user.email, name: user.name, action: 'verified', via: 'admin', at: nowIso() });
  write(ACTIVITY_KEY, activity.slice(0, 300));
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
  const iso = nowIso();
  const date = new Date(iso).toLocaleString([], { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const tx: LocalTx = {
    id: uid('t'), date, type: 'deposit', asset,
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
  if (usd > user.balance) return { ok: false, error: `Amount exceeds your available balance of $${user.balance.toFixed(2)}.` };
  user.balance = Math.round((user.balance - usd) * 100) / 100;
  users[oid] = user;
  write(USERS_KEY, users);
  const iso = nowIso();
  const date = new Date(iso).toLocaleString([], { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const tx: LocalTx = {
    id: uid('t'), date, type: 'withdrawal', asset: 'USD',
    amount: '', rate: 0, usd,
    status: 'Pending',
  };
  pushTx(oid, tx);
  return { ok: true, balance: user.balance, tx };
}