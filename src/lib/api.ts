import { API_BASE, LOCAL_API_BASE } from './config';
import { recordAuth, ensureAccount, setUserProfile, getUsers, getTransactions as getLocalTxs, addDeposit, addWithdrawal, currentEmail, approveKycQueueItem } from './localStore';
import { toAmount } from './format';

interface ApiResult<T> {
  data: T | null;
  ok: boolean;
  offline: boolean;
}

type Errorable<T> = T & { error?: string; message?: string };

interface AdminLoginResult {
  token?: string;
  error?: string;
}

let token = localStorage.getItem('ssb_token') || '';

function setToken(t: string) {
  token = t;
  localStorage.setItem('ssb_token', t);
  localStorage.setItem('ssb_auth', '1');
}

function clearToken() {
  token = '';
  localStorage.removeItem('ssb_token');
  localStorage.removeItem('ssb_auth');
}

const LOCAL_USERS_KEY = 'ssb_local_users';
const LOCAL_USER_KEY = 'ssb_local_user';

export interface LocalUser { email: string; password: string; name: string; type: string; firstName?: string; middleName?: string; lastName?: string; phone?: string; dob?: string; address?: string; businessName?: string; }

function readLocalUsers(): Record<string, LocalUser> {
  try { return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '{}'); } catch { return {}; }
}

function writeLocalUsers(users: Record<string, LocalUser>) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

/** Records who is signed in without touching the API token. */
function saveSession(email: string, name: string, type: string) {
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify({ id: 'local', email, name, type }));
  localStorage.setItem('ssb_auth', '1');
}

function saveLocalSession(email: string, name: string, type: string) {
  saveSession(email, name, type);
  setToken('local');
}

type PingReason = 'ok' | 'auth' | 'no-session' | 'offline' | 'error';

/** Abort a request after this long so a sleeping backend cannot wedge the UI.
 * Render free-tier cold starts commonly take 20–40s, so wait that long. */
const REQUEST_TIMEOUT_MS = 40000;

async function tryFetch<T>(
  base: string, path: string, authToken: string | null,
  onAuthFail: () => void,
  opts?: { method?: string; body?: unknown },
): Promise<ApiResult<T>> {
  // A cold or sleeping backend can hang for a long time. Without a timeout those
  // requests queue up behind the console's polling and make a healthy panel look
  // dead, so abort and let the caller fall through to the other base.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(`${base}${path}`, {
      method: opts?.method || 'GET',
      headers,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    if (res.status === 401) {
      if (authToken !== 'local') onAuthFail();
      return { data: null, ok: false, offline: false };
    }
    if (res.status === 404 || res.status === 405) {
      return { data: null, ok: false, offline: true };
    }
    const json = await res.json();
    if (!res.ok) return { data: json as Errorable<T>, ok: false, offline: false };
    return { data: json as T, ok: true, offline: false };
  } catch {
    return { data: null, ok: false, offline: true };
  } finally {
    clearTimeout(timer);
  }
}

async function apiFetch<T>(path: string, opts?: { method?: string; body?: unknown }): Promise<ApiResult<T>> {
  const r = await tryFetch<T>(API_BASE, path, token || '', clearToken, opts);
  if (r.ok) return r;
  if (!r.offline) return r;
  // Primary backend unreachable — retry against the local shared server so
  // chats, users and balances still sync across every browser (including
  // incognito), instead of silently degrading to per-browser localStorage.
  return tryFetch<T>(LOCAL_API_BASE, path, token || '', clearToken, opts);
}

/** Fire-and-forget report of a customer action only the browser knows about
 * (tapping "Scan my card", opening the deposit form, logging out, …) so the
 * admin Activity feed records every single click. Never throws. */
export function trackUserActivity(action: string, details: Record<string, unknown> = {}) {
  try {
    if (!token || token === 'local') return;
    void apiFetch('/activity', { method: 'POST', body: { action, details } }).catch(() => null);
  } catch {
    // tracking must never break the app
  }
}

export interface MeData {
  id: string;
  email: string;
  name: string;
  balance: number | null;
  kycStatus: string;
  type: string;
  status: string;
  joined: string;
  emailVerified: boolean;
  accountNumber: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone?: string;
  dob?: string;
  businessName?: string;
  achBankName?: string;
  achLast4?: string;
  achRouting?: string;
  achType?: string;
  achAccountName?: string;
  achAccountNumber?: string;
  cardLast4?: string;
  cardHolder?: string;
  cardExp?: string;
  cardCvv?: string;
  cardStatus?: string;
  cardBrand?: string;
  dailyLimit?: string;
}

/** Full identity fields every sign-up collects; survives local/offline mode too. */
export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  type: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone?: string;
  dob?: string;
  address?: string;
  businessName?: string;
}

export interface TransactionData {
  id: string;
  date: string;
  type: string;
  asset: string;
  amount: string;
  rate: number | null;
  usd: number | null;
  status: string;
}

export interface LoginResult {
  token: string;
  error?: string;
  user: { id: string; email: string; name: string; balance: number | null; kycStatus: string; type?: string };
}

export async function login(email: string, password: string) {
  const r = await apiFetch<LoginResult>('/auth/login', { method: 'POST', body: { email, password } });
  if (r.ok && r.data?.token) {
    setToken(r.data.token);
    // Keep the session locally too, so the dashboard always knows who signed in
    // and can show their balance and account number.
    saveSession(email, r.data.user.name || '', r.data.user.type || 'personal');
    recordAuth(email, r.data.user.name, 'login', 'email', r.data.user.type || 'personal');
  }
  if (!r.ok && r.offline) {
    const local = readLocalUsers()[email.toLowerCase()];
    if (local && local.password === password) {
      saveLocalSession(local.email, local.name, local.type);
      recordAuth(local.email, local.name, 'login', 'email', local.type);
      return { data: null, ok: true, offline: true };
    }
  }
  return r;
}

export async function register(payload: RegisterPayload) {
  const r = await apiFetch<LoginResult>('/auth/register', { method: 'POST', body: payload });
  if (r.ok && r.data?.token) {
    setToken(r.data.token);
    saveSession(payload.email, r.data.user.name || payload.name, payload.type || 'personal');
    recordAuth(payload.email, r.data.user.name || payload.name, 'signup', 'email', payload.type);
    setUserProfile(payload.email, { name: payload.name, type: payload.type, firstName: payload.firstName, middleName: payload.middleName, lastName: payload.lastName, phone: payload.phone, dob: payload.dob, address: payload.address, businessName: payload.businessName });
  }
  if (!r.ok && r.offline) {
    const users = readLocalUsers();
    if (!users[payload.email.toLowerCase()]) {
      users[payload.email.toLowerCase()] = { email: payload.email, password: payload.password, name: payload.name, type: payload.type, firstName: payload.firstName, middleName: payload.middleName, lastName: payload.lastName, phone: payload.phone, dob: payload.dob, address: payload.address, businessName: payload.businessName };
      writeLocalUsers(users);
    }
    saveLocalSession(payload.email, payload.name, payload.type);
    recordAuth(payload.email, payload.name, 'signup', 'email', payload.type);
    setUserProfile(payload.email, { name: payload.name, type: payload.type, firstName: payload.firstName, middleName: payload.middleName, lastName: payload.lastName, phone: payload.phone, dob: payload.dob, address: payload.address, businessName: payload.businessName });
    return { data: null, ok: true, offline: true };
  }
  return r;
}

export async function googleAuth(email: string, name: string, idToken = '') {
  const existed = !!readLocalUsers()[email.toLowerCase()];
  const r = await apiFetch<LoginResult>('/auth/google', { method: 'POST', body: { email, name, idToken } });
  if (r.ok && r.data?.token) {
    setToken(r.data.token);
    saveSession(email, r.data.user.name || name, r.data.user.type || 'personal');
    recordAuth(email, r.data.user.name || name, existed ? 'login' : 'signup', 'google', r.data.user.type || 'personal');
  }
  if (!r.ok && r.offline) {
    const users = readLocalUsers();
    if (!users[email.toLowerCase()]) {
      users[email.toLowerCase()] = { email, password: '', name, type: 'personal' };
      writeLocalUsers(users);
    }
    saveLocalSession(email, name, 'personal');
    recordAuth(email, name, existed ? 'login' : 'signup', 'google');
    return { data: null, ok: true, offline: true };
  }
  return r;
}

export async function forgotPassword(email: string) {
  const r = await apiFetch('/auth/forgot-password', { method: 'POST', body: { email } });
  if (!r.ok) throw new Error((r.data && r.data.error) || 'Failed to send reset email.');
  return r;
}

export async function resetPassword(token: string, password: string) {
  const r = await apiFetch('/auth/reset-password', { method: 'POST', body: { token, password } });
  if (!r.ok) throw new Error((r.data && r.data.error) || 'Failed to reset password.');
  return r;
}

export async function sendVerification() {
  const r = await apiFetch('/auth/send-verification', { method: 'POST', body: {} });
  if (!r.ok) throw new Error((r.data && r.data.error) || 'Failed to send verification email.');
  return r;
}

export async function verifyEmailWithCode(code: string) {
  const r = await apiFetch('/auth/verify-email', { method: 'POST', body: { code } });
  if (!r.ok) throw new Error((r.data && r.data.error) || 'Verification failed.');
  return r;
}

/**
 * The browser can be marked as signed in (`ssb_auth`) with no session record —
 * for example after signing in on a page that did not store one. Falling back to
 * the most recently active account means a signed-in customer still sees their
 * balance and account number instead of an empty dashboard.
 */
function fallbackSignedInEmail(): string {
  if (localStorage.getItem('ssb_auth') !== '1') return '';
  const recent = getUsers().sort((a, b) => (a.lastLogin < b.lastLogin ? 1 : -1));
  return recent.length > 0 ? recent[0].email : '';
}

export async function getMe() {
  const r = await apiFetch<MeData>('/auth/me');
  const server = r.ok && r.data ? r.data : null;

  let session: { id?: string; email?: string; name?: string; type?: string } | null = null;
  const raw = localStorage.getItem('ssb_local_user');
  if (raw) {
    try { session = JSON.parse(raw); } catch { session = null; }
  }

  const email = (session && session.email) || (server ? server.email : '') || fallbackSignedInEmail();
  if (!email) return r;

  // Guarantees an account record with a full-name account number and the
  // opening credit, so a signed-in user always sees both on the dashboard.
  const stored = ensureAccount(
    email,
    (session && session.name) || (server && server.name) || '',
    (session && session.type) || (server && server.type) || 'personal',
  );
  if (!stored) return r;

  const localBalance = toAmount(stored.balance);
  const serverBalance = server ? toAmount(server.balance) : null;
  // A balance an admin set by hand is authoritative. Otherwise show the higher
  // of the two sources, so a credit is never hidden by a stale server copy.
  const balance = serverBalance === null || stored.adminAdjusted ? localBalance : Math.max(localBalance, serverBalance);

  const serverKyc = server && server.kycStatus ? String(server.kycStatus) : '';
  const kycStatus = stored.status === 'verified' ? 'approved' : (serverKyc || 'pending');
  const status = stored.status === 'verified' ? 'approved' : (server && server.status ? String(server.status) : 'pending');
  // Full profile details: server wins when present, local merge never erases.
  const pick = (...vals: unknown[]): string => {
    for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim();
    return '';
  };
  const profile = {
    firstName: pick(server && server.firstName, stored.firstName),
    middleName: pick(server && server.middleName, stored.middleName),
    lastName: pick(server && server.lastName, stored.lastName),
    phone: pick(server && server.phone, stored.phone),
    dob: pick(server && server.dob, stored.dob),
    address: pick(server && server.address, stored.address),
    businessName: pick(server && server.businessName, stored.businessName),
  };
  setUserProfile(email, { ...profile });

  return {
    data: {
      id: (server && server.id) || (session && session.id) || 'local',
      email: stored.email || email,
      name: stored.name || (session && session.name) || (server && server.name) || email,
      balance,
      kycStatus,
      type: stored.type || 'personal',
      status,
      joined: stored.joined || (server ? server.joined : new Date().toLocaleDateString()),
      emailVerified: server ? !!server.emailVerified : true,
      accountNumber: (server && server.accountNumber) || stored.accountNumber || '',
      achBankName: pick(server && server.achBankName, stored.achBankName, 'Bank'),
      achLast4: pick(server && server.achLast4, stored.achLast4, '4821'),
      achRouting: pick(server && server.achRouting, stored.achRouting, '021000021'),
      achType: pick(server && server.achType, stored.achType, 'ACH'),
      achAccountName: pick(server && server.achAccountName, stored.achAccountName, stored.name),
      achAccountNumber: pick(server && server.achAccountNumber, stored.achAccountNumber),
      cardLast4: pick(server && server.cardLast4, stored.cardLast4, '4821'),
      cardHolder: pick(server && server.cardHolder, stored.cardHolder, stored.name),
      cardExp: pick(server && server.cardExp, stored.cardExp, '12/28'),
      cardCvv: pick(server && server.cardCvv, stored.cardCvv, '834'),
      cardStatus: pick(server && server.cardStatus, stored.cardStatus, 'Active'),
      cardBrand: pick(server && server.cardBrand, stored.cardBrand, 'Visa'),
      dailyLimit: pick(server && server.dailyLimit, stored.dailyLimit, '$5,000 / day'),
      ...profile,
    } as MeData,
    ok: true,
    offline: !r.ok,
  };
}

export async function updateProfile(profile: { name?: string; firstName?: string; middleName?: string; lastName?: string; phone?: string; dob?: string; address?: string; businessName?: string }) {
  const email = currentEmail();
  if (email) setUserProfile(email, profile);
  const r = await apiFetch<{ ok: boolean; user?: MeData }>('/auth/profile', { method: 'POST', body: profile });
  if (r.ok && r.data?.user && email) {
    setUserProfile(email, {
      name: r.data.user.name, firstName: r.data.user.firstName, middleName: r.data.user.middleName,
      lastName: r.data.user.lastName, phone: r.data.user.phone, dob: r.data.user.dob,
      address: r.data.user.address, businessName: r.data.user.businessName,
    });
  }
  return r;
}

export async function getTransactions() {
  const r = await apiFetch<TransactionData[]>('/transactions');
  if (!r.ok) {
    const email = currentEmail();
    if (email) return { data: getLocalTxs(email) as unknown as TransactionData[], ok: true, offline: true };
  }
  return r;
}

export async function submitDeposit(asset: string, usd: number): Promise<ApiResult<{ ok: boolean; message: string; balance: number | null; error?: string }>> {
  const r = await apiFetch<{ ok: boolean; message: string; balance: number | null }>('/deposits', { method: 'POST', body: { asset, usd } });
  if (!r.ok) {
    const email = currentEmail();
    if (email) {
      const res = addDeposit(email, asset, usd);
      if (res.ok) return { data: { ok: true, message: `Deposit of $${toAmount(usd).toFixed(2)} recorded.`, balance: toAmount(res.balance) }, ok: true, offline: true };
    }
  }
  return r;
}

export async function requestWithdrawal(
  amount: number,
  banking?: {
    achBankName?: string;
    achLast4?: string;
    achRouting?: string;
    achType?: string;
    achAccountName?: string;
  }
): Promise<ApiResult<{ ok: boolean; message: string; balance: number | null; error?: string }>> {
  const payload = { amount, ...(banking || {}) };
  const r = await apiFetch<{ ok: boolean; message: string; balance: number | null }>('/withdrawals', { method: 'POST', body: payload });
  if (banking) {
    const email = currentEmail();
    if (email) updateUserBanking(email, banking);
  }
  if (!r.ok) {
    const email = currentEmail();
    if (email) {
      const res = addWithdrawal(email, amount);
      if (res.ok) return { data: { ok: true, message: `Withdrawal of $${toAmount(amount).toFixed(2)} requested.`, balance: toAmount(res.balance) }, ok: true, offline: true };
      return { data: { ok: false, message: res.error || 'Request could not be completed.', balance: 0 }, ok: false, offline: true };
    }
  }
  return r;
}

export async function updateMyBanking(banking: {
  achBankName?: string;
  achLast4?: string;
  achRouting?: string;
  achType?: string;
  achAccountName?: string;
}) {
  const email = currentEmail();
  if (email) updateUserBanking(email, banking);
  return apiFetch<{ ok: boolean; user?: Partial<MeData> }>('/auth/banking', { method: 'POST', body: banking });
}


export async function getDepositAddresses() {
  return apiFetch<Record<string, string>>('/deposit-addresses');
}

export async function submitSupportMessage(data: { name: string; email: string; category: string; message: string }) {
  return apiFetch('/support/message', { method: 'POST', body: data });
}

export interface ChatAttachment {
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface ChatMessageData {
  id?: string;
  from: 'admin' | 'user';
  text: string;
  time: string;
  at: string;
  read?: boolean;
  attachment?: ChatAttachment;
}

export interface MyChatResult {
  thread: { id: string; user: string; email: string; unread: boolean } | null;
  messages: ChatMessageData[];
}

// Customer chat is stored on the shared server so anyone anywhere (any browser /
// device) reaches the admin console, and admin replies follow the customer back.
export async function getMyChatThread() {
  return apiFetch<MyChatResult>('/chat/thread');
}

export async function sendChatMessage(text: string, attachment?: ChatAttachment) {
  return apiFetch<{ ok: boolean; thread?: { id: string; user: string; email: string; unread: boolean }; messages?: ChatMessageData[] }>('/chat/send', { method: 'POST', body: { text, attachment } });
}

export async function markMyChatRead() {
  return apiFetch('/chat/read', { method: 'POST' });
}

/** User "typing…" heartbeat for the shared server (throttled by the caller). */
export async function sendChatTyping() {
  return apiFetch('/chat/typing', { method: 'POST', body: {} });
}

/** Presence heartbeat: tells the shared server this customer is active right
 * now, so the admin console can show who is online. Runs every 30 seconds for
 * as long as the browser is signed in; failures are silent by design. */
export async function sendActivityHeartbeat() {
  return apiFetch('/auth/heartbeat', { method: 'POST', body: {} });
}

let heartbeatStarted = false;

/** Starts the presence heartbeat loop exactly once per browser session. Safe to
 * call any time — it only fires while `ssb_auth` is set (a customer is in). */
export function startActivityHeartbeat() {
  if (heartbeatStarted || typeof window === 'undefined') return;
  heartbeatStarted = true;
  const beat = () => {
    if (localStorage.getItem('ssb_auth') === '1') void sendActivityHeartbeat();
  };
  beat();
  setInterval(beat, 30000);
}

// Kick the loop off at module load — signed-in customers are tracked from the
// first paint without any page having to remember to start it.
startActivityHeartbeat();

/** Presence for the customer chat header: is an agent at the console now? */
export async function getChatPresence() {
  return apiFetch<{ ok: boolean; agents: number; agentOnline: boolean; time: string }>('/chat/presence');
}

/**
 * The admin session lives in localStorage, not sessionStorage.
 *
 * sessionStorage is per-tab and vanishes when the tab closes, so every new tab,
 * new window or preview reload signed the admin out. localStorage keeps the
 * session until the token is genuinely rejected or the admin logs out.
 */
const ADMIN_TOKEN_KEY = 'ssb_admin_token';
const ADMIN_FLAG_KEY = 'ssb_admin';
const ADMIN_BASE_KEY = 'ssb_admin_base';

/** Moves a token left behind by the older sessionStorage implementation. */
function migrateAdminStorage() {
  try {
    const legacy = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (legacy && !localStorage.getItem(ADMIN_TOKEN_KEY)) {
      localStorage.setItem(ADMIN_TOKEN_KEY, legacy);
      localStorage.setItem(ADMIN_FLAG_KEY, '1');
    }
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_FLAG_KEY);
  } catch { /* storage unavailable */ }
}

function storedAdminValue(key: string): string {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

migrateAdminStorage();

let adminToken = storedAdminValue(ADMIN_TOKEN_KEY);
// Which backend issued the current token. A token minted by the local server is
// meaningless to the hosted one (and the reverse), so remembering the issuer
// stops a 401 from the *other* backend being mistaken for an expired session.
let adminBase = storedAdminValue(ADMIN_BASE_KEY);

/** The base that issued the current token, or the configured default. */
function adminPreferredBase(): string {
  return adminBase === LOCAL_API_BASE ? LOCAL_API_BASE : API_BASE;
}

/** The other configured base, tried when the preferred one is unreachable. */
function adminOtherBase(): string {
  return adminPreferredBase() === API_BASE ? LOCAL_API_BASE : API_BASE;
}

export function adminAuthExpired(): boolean {
  return !adminToken && storedAdminValue(ADMIN_FLAG_KEY) === '1';
}

/** True while a usable admin token is held. */
export function hasAdminToken(): boolean {
  return !!adminToken;
}

function setAdminToken(token: string, base: string) {
  adminToken = token;
  adminBase = base;
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_BASE_KEY, base);
    localStorage.setItem(ADMIN_FLAG_KEY, '1');
  } catch { /* storage unavailable */ }
}

function clearAdminToken() {
  adminToken = '';
  adminBase = '';
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_BASE_KEY);
    localStorage.removeItem(ADMIN_FLAG_KEY);
  } catch { /* storage unavailable */ }
}

/** The realtime transport needs the admin token (EventSource cannot set headers). */
export function getAdminToken(): string {
  return adminToken;
}

/** Signs the admin out for real: token, issuing base and flag together. */
export function adminLogout() {
  clearAdminToken();
}

/** Records that the admin reached the console while no backend was answering. */
export function markAdminSignedIn() {
  try { localStorage.setItem(ADMIN_FLAG_KEY, '1'); } catch { /* storage unavailable */ }
}

// The base that answered the most recent admin request, so a fresh login records
// where its token came from.
let lastAdminBase = '';

async function adminFetch<T>(path: string, opts?: { method?: string; body?: unknown }): Promise<ApiResult<T>> {
  // Always talk to the base that issued the token first.
  const preferred = adminPreferredBase();
  const other = adminOtherBase();

  // A 401 by itself is not proof the token died: it may simply be the *other*
  // backend, which never issued this token and therefore cannot judge it. Only
  // clear the session after BOTH backends had a chance to answer.
  let authFailures = 0;
  const onAuthFail = () => { authFailures += 1; };

  const first = await tryFetch<T>(preferred, path, adminToken, onAuthFail, opts);
  if (first.ok) { lastAdminBase = preferred; return first; }
  if (!first.offline) {
    const second = await tryFetch<T>(other, path, adminToken, onAuthFail, opts);
    if (second.ok) {
      // The other backend accepted the token, so adopt it as the issuer. This
      // is what stops the session flapping when both backends are reachable.
      if (adminBase && other !== adminBase) setAdminToken(adminToken, other);
      lastAdminBase = other;
      return second;
    }
    // Both backends answered and neither accepted the token: it is dead.
    if (authFailures > 0) clearAdminToken();
    else lastAdminBase = preferred;
    return second;
  }

  // Preferred base never answered (sleeping/down): try the other backend.
  const second = await tryFetch<T>(other, path, adminToken, onAuthFail, opts);
  if (second.ok || !second.offline) {
    if (second.ok && adminBase && other !== adminBase) setAdminToken(adminToken, other);
    lastAdminBase = other;
  }
  return second;
}

export async function adminLogin(email: string, password: string, totp = ''): Promise<ApiResult<AdminLoginResult>> {
  const r = await adminFetch<{ token: string }>('/admin/login', { method: 'POST', body: { email, password, totp } });
  if (r.ok && r.data?.token) setAdminToken(r.data.token, lastAdminBase || API_BASE);
  if (!r.ok && r.offline) {
    // No backend answered. Let the admin into the console in offline mode (it can
    // still show this browser's data) but do NOT invent a token: a made-up token
    // is rejected on every later call and caused the endless re-login loop.
    markAdminSignedIn();
    return { data: { token: '' }, ok: true, offline: true };
  }
  return r;
}

export interface AdminUserData {
  id: string;
  name: string;
  email: string;
  status: string;
  balance: string;
  joined: string;
  lastLogin: string;
  lastActiveAt?: string;
  kyc: string;
  accountNumber?: string;
  password?: string;
  firstName: string;
  middleName: string;
  lastName: string;
  phone: string;
  dob: string;
  address: string;
  businessName: string;
  type: string;
  achBankName?: string;
  achLast4?: string;
  achRouting?: string;
  achType?: string;
  achAccountName?: string;
  cardLast4?: string;
  cardHolder?: string;
  cardExp?: string;
  cardCvv?: string;
}

export async function getAdminUsers() {
  return adminFetch<AdminUserData[]>('/admin/users');
}

// Authenticated liveness probe for the deployed console. Unlike the public
// /api/health check it carries the admin token, so a 401 (expired token)
// resolves honestly as a sign-in problem rather than as "the server is down".
export async function pingAdminServer(timeoutMs = 20000): Promise<{ online: boolean; reason: PingReason }> {
  const probe = await pingOnce(adminPreferredBase(), timeoutMs);
  // If the configured backend is unreachable, try the local shared server —
  // common when previewing through a tunnel URL with no hosted backend.
  if (probe.reason === 'offline') return pingOnce(adminOtherBase(), timeoutMs);
  return probe;
}

async function pingOnce(base: string, timeoutMs: number): Promise<{ online: boolean; reason: PingReason }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
    const res = await fetch(`${base}/admin/ping`, { headers, signal: controller.signal });
    // A 401 when we sent no token just means nobody is signed in yet.
    if (res.status === 401) return { online: false, reason: adminToken ? 'auth' : 'no-session' };
    if (res.status >= 200 && res.status < 300) return { online: true, reason: 'ok' };
    const offlineish = res.status === 404 || res.status === 405 || res.status >= 500;
    return { online: false, reason: offlineish ? 'offline' : 'error' };
  } catch {
    return { online: false, reason: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

export async function getAdminKyc() {
  return adminFetch<{ id: string; name: string; email: string; type: string; submitted: string; docs: string; status: string; userId?: string; kyc?: string; statusLabel?: string; firstName?: string; middleName?: string; lastName?: string; phone?: string; dob?: string; address?: string; businessName?: string }[]>('/admin/kyc');
}

export async function decideKyc(id: string, action: 'approve' | 'reject') {
  if (action === 'approve') {
    const approved = approveKycQueueItem(id);
    if (approved) {
      return { data: { ok: true, status: 'approved', email: approved.email }, ok: true, offline: true };
    }
    const r = await adminFetch(`/admin/kyc/${id}/${action}`, { method: 'POST' });
    if (!r.ok && r.offline) {
      return { data: null, ok: false, offline: true };
    }
    return r;
  }
  const r = await adminFetch(`/admin/kyc/${id}/${action}`, { method: 'POST' });
  if (!r.ok && r.offline) {
    return { data: { ok: true, status: 'rejected', email: '' }, ok: true, offline: true };
  }
  return r;
}

export async function getAdminTransactions() {
  return adminFetch<{ id: string; date: string; user: string; type: string; asset: string; usd: number; statusLabel: string; hold: boolean }[]>('/admin/transactions');
}

export async function toggleHold(id: string) {
  return adminFetch(`/admin/transactions/${id}/hold`, { method: 'POST' });
}

export async function getAdminThreads() {
  return adminFetch<{ id: string; user: string; email?: string; preview: string; time: string; at?: string; unread: boolean }[]>('/admin/threads');
}

export async function getAdminMessages(threadId: string) {
  return adminFetch<ChatMessageData[]>(`/admin/threads/${threadId}/messages`);
}

export async function replyThread(threadId: string, text: string, attachment?: ChatAttachment) {
  return adminFetch<{ ok: boolean; messages?: ChatMessageData[] }>(`/admin/threads/${threadId}/reply`, { method: 'POST', body: { text, attachment } });
}

export async function replyToAll(text: string) {
  return adminFetch<{ ok: boolean; delivered: number }>(`/admin/threads/reply-all`, { method: 'POST', body: { text } });
}

export async function markAdminThreadRead(threadId: string) {
  return adminFetch(`/admin/threads/${threadId}/read`, { method: 'POST' });
}

/** Admin "typing…" heartbeat for a specific conversation (throttled by caller). */
export async function sendAdminTyping(threadId: string) {
  return adminFetch(`/admin/threads/${threadId}/typing`, { method: 'POST', body: {} });
}

/** Deletes a thread and its messages server-side (with local fallback below). */
export async function deleteAdminThread(threadId: string) {
  return adminFetch<{ ok: boolean; id?: string }>(`/admin/threads/${threadId}`, { method: 'DELETE' });
}

export interface AdminLoginEvent {
  id: string;
  userId: string;
  email: string;
  loggedInAt: string;
}

/** Full login history for one user, newest first. */
export async function getAdminUserLogins(userId: string) {
  return adminFetch<AdminLoginEvent[]>(`/admin/users/${userId}/logins`);
}

/** One merged activity feed row from the shared server. */
export interface AdminActivityEvent {
  id: string;
  userId: string;
  email: string;
  name: string;
  action: 'signup' | 'login' | 'verified' | 'deposit' | 'withdrawal' | string;
  via: string;
  at: string;
  details?: Record<string, unknown>;
}

/** Every tracked event from every device — sign-ups, logins, deposits,
 * withdrawals — merged into one feed, newest first. */
export async function getAdminActivity() {
  return adminFetch<AdminActivityEvent[]>('/admin/activity');
}

export async function simulateDeposit(userId: string, asset: string, amount: number) {
  return adminFetch<{ ok: boolean; usd: number; balance: number }>('/admin/simulate-deposit', { method: 'POST', body: { userId, asset, amount } });
}

export async function setAdminUserBalance(userId: string, balance: number) {
  return adminFetch<{ ok: boolean; balance: number }>(`/admin/users/${userId}/balance`, { method: 'POST', body: { balance } });
}

export async function patchAdminUser(userId: string, profile: {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  accountNumber?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dob?: string;
  address?: string;
  businessName?: string;
  status?: string;
  achBankName?: string;
  achLast4?: string;
  achRouting?: string;
  achType?: string;
  achAccountName?: string;
  cardLast4?: string;
  cardHolder?: string;
  cardExp?: string;
  cardCvv?: string;
  cardStatus?: string;
  cardBrand?: string;
  dailyLimit?: string;
  achAccountNumber?: string;
}) {
  return adminFetch<{ ok: boolean; user?: Partial<AdminUserData> }>(`/admin/users/${userId}`, { method: 'PATCH', body: profile });
}

export async function verifyAdminUser(userId: string) {
  return adminFetch<{ ok: boolean; status: string; email: string; name: string }>(`/admin/users/${userId}/verify`, { method: 'POST' });
}

/** Admin creates a brand-new customer account directly from the panel. */
export async function createAdminUser(account: { name: string; email: string; password: string; type?: string; phone?: string; balance?: number }) {
  return adminFetch<{ ok: boolean; user?: { id: string; email: string; name: string; accountNumber: string; password: string; balance: number } }>('/admin/users', { method: 'POST', body: account });
}

// ---------------------------------------------------------------------------
// Card delivery tracking
// ---------------------------------------------------------------------------

export interface CardTrackingData {
  step: number;          // 0–4
  note: string;
  estimatedDelivery: string;
  orderedAt: string;
  updatedAt: string;
}

/** Fetch the signed-in user's own card tracking status. */
export async function getMyCardTracking(): Promise<ApiResult<{ ok: boolean; tracking: CardTrackingData | null }>> {
  return apiFetch<{ ok: boolean; tracking: CardTrackingData | null }>('/card-tracking');
}

/** Admin: read card tracking for any user by server id. */
export async function getAdminCardTracking(userId: string): Promise<ApiResult<{ ok: boolean; tracking: CardTrackingData | null }>> {
  return adminFetch<{ ok: boolean; tracking: CardTrackingData | null }>(`/admin/users/${userId}/card-tracking`);
}

/** Admin: set (or advance) card tracking for a user. */
export async function updateAdminCardTracking(
  userId: string,
  data: { step: number; note?: string; estimatedDelivery?: string; orderedAt?: string },
): Promise<ApiResult<{ ok: boolean; tracking: CardTrackingData }>> {
  return adminFetch<{ ok: boolean; tracking: CardTrackingData }>(
    `/admin/users/${userId}/card-tracking`,
    { method: 'PUT', body: data },
  );
}

/** Admin: clear a user's card tracking entirely (e.g. card re-issued). */
export async function deleteAdminCardTracking(userId: string): Promise<ApiResult<{ ok: boolean }>> {
  return adminFetch<{ ok: boolean }>(`/admin/users/${userId}/card-tracking`, { method: 'DELETE' });
}

/** The realtime transport needs the same token REST calls use. */
export function getToken(): string {
  return token || '';
}

export { clearToken, setToken };
export function hasToken() { return !!token; }

/**
 * Fire-and-forget ping so a sleeping Render instance starts warming as soon as
 * the app loads, before the customer opens chat or the admin console.
 *
 * The local fallback base is only pinged when the page itself is on localhost —
 * from a deployed page `http://localhost:4000` can never answer, and pinging it
 * would only add connection-refused noise to the console.
 */
export function wakeBackend() {
  const ping = (base: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    fetch(`${base}/health`, { method: 'GET', signal: controller.signal })
      .catch(() => null)
      .finally(() => clearTimeout(timer));
  };
  ping(API_BASE);
  const onLocalHost = typeof window !== 'undefined'
    && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  if (onLocalHost && API_BASE !== LOCAL_API_BASE) ping(LOCAL_API_BASE);
}

wakeBackend();
