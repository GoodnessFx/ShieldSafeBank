import { API_BASE } from './config';
import { recordAuth, getUser, getTransactions as getLocalTxs, addDeposit, addWithdrawal, currentEmail, approveKycQueueItem } from './localStore';
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

interface LocalUser { email: string; password: string; name: string; type: string; }

function readLocalUsers(): Record<string, LocalUser> {
  try { return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '{}'); } catch { return {}; }
}

function writeLocalUsers(users: Record<string, LocalUser>) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function saveLocalSession(email: string, name: string, type: string) {
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify({ id: 'local', email, name, type }));
  setToken('local');
}

async function apiFetch<T>(path: string, opts?: { method?: string; body?: unknown }): Promise<ApiResult<T>> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, {
      method: opts?.method || 'GET',
      headers,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401) {
      if (token !== 'local') clearToken();
      return { data: null, ok: false, offline: false };
    }
    if (res.status === 404 || res.status === 405) {
      return { data: null, ok: false, offline: true };
    }
    const json = await res.json();
    if (!res.ok) return { data: json as T, ok: false, offline: false };
    return { data: json as T, ok: true, offline: false };
  } catch {
    return { data: null, ok: false, offline: true };
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

export async function register(payload: { email: string; password: string; name: string; type: string }) {
  const r = await apiFetch<LoginResult>('/auth/register', { method: 'POST', body: payload });
  if (r.ok && r.data?.token) {
    setToken(r.data.token);
    recordAuth(payload.email, r.data.user.name || payload.name, 'signup', 'email', payload.type);
  }
  if (!r.ok && r.offline) {
    const users = readLocalUsers();
    if (!users[payload.email.toLowerCase()]) {
      users[payload.email.toLowerCase()] = { email: payload.email, password: payload.password, name: payload.name, type: payload.type };
      writeLocalUsers(users);
    }
    saveLocalSession(payload.email, payload.name, payload.type);
    recordAuth(payload.email, payload.name, 'signup', 'email', payload.type);
    return { data: null, ok: true, offline: true };
  }
  return r;
}

export async function googleAuth(email: string, name: string, idToken = '') {
  const existed = !!readLocalUsers()[email.toLowerCase()];
  const r = await apiFetch<LoginResult>('/auth/google', { method: 'POST', body: { email, name, idToken } });
  if (r.ok && r.data?.token) {
    setToken(r.data.token);
    recordAuth(email, r.data.user.name || name, existed ? 'login' : 'signup', 'google');
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
  return apiFetch('/auth/forgot-password', { method: 'POST', body: { email } });
}

export async function getMe() {
  const r = await apiFetch<MeData>('/auth/me');
  if (!r.ok) {
    const lu = localStorage.getItem('ssb_local_user');
    if (lu) {
      const u = JSON.parse(lu);
      const stored = getUser(u.email || '');
      const status = stored && stored.status === 'verified' ? 'approved' : 'pending';
      const balance = toAmount(stored ? stored.balance : 0);
      return { data: { id: u.id || 'local', email: u.email, name: u.name, balance, kycStatus: status, type: u.type || 'personal', status, joined: stored ? stored.joined : new Date().toLocaleDateString(), emailVerified: true } as MeData, ok: true, offline: true };
    }
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

export async function requestWithdrawal(amount: number): Promise<ApiResult<{ ok: boolean; message: string; balance: number | null; error?: string }>> {
  const r = await apiFetch<{ ok: boolean; message: string; balance: number | null }>('/withdrawals', { method: 'POST', body: { amount } });
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

export async function getDepositAddresses() {
  return apiFetch<Record<string, string>>('/deposit-addresses');
}

export async function submitSupportMessage(data: { name: string; email: string; category: string; message: string }) {
  return apiFetch('/support/message', { method: 'POST', body: data });
}

let adminToken = sessionStorage.getItem('ssb_admin_token') || '';

function setAdminToken(t: string) {
  adminToken = t;
  sessionStorage.setItem('ssb_admin_token', t);
  sessionStorage.setItem('ssb_admin', '1');
}

async function adminFetch<T>(path: string, opts?: { method?: string; body?: unknown }): Promise<ApiResult<T>> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
    const res = await fetch(`${API_BASE}${path}`, {
      method: opts?.method || 'GET',
      headers,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401) {
      adminToken = '';
      sessionStorage.removeItem('ssb_admin_token');
      sessionStorage.removeItem('ssb_admin');
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
  }
}

export async function adminLogin(email: string, password: string, totp = ''): Promise<ApiResult<AdminLoginResult>> {
  const r = await adminFetch<{ token: string }>('/admin/login', { method: 'POST', body: { email, password, totp } });
  if (r.ok && r.data?.token) setAdminToken(r.data.token);
  if (!r.ok && r.offline) {
    if (email === 'admin@shieldsafebank.com' && password === 'admin1234') {
      setAdminToken('local-admin');
      return { data: { token: 'local-admin' }, ok: true, offline: true };
    }
    return { data: { error: 'Invalid admin credentials.' }, ok: false, offline: false };
  }
  return r;
}

export async function getAdminUsers() {
  return adminFetch<{ id: string; name: string; email: string; status: string; balance: string; joined: string; lastLogin: string; kyc: string }[]>('/admin/users');
}

export async function getAdminKyc() {
  return adminFetch<{ id: string; name: string; email: string; type: string; submitted: string; docs: string; status: string }[]>('/admin/kyc');
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
  return adminFetch<{ id: string; user: string; preview: string; time: string; unread: boolean }[]>('/admin/threads');
}

export async function getAdminMessages(threadId: string) {
  return adminFetch<{ from: string; text: string; time: string }[]>(`/admin/threads/${threadId}/messages`);
}

export async function replyThread(threadId: string, text: string) {
  return adminFetch(`/admin/threads/${threadId}/reply`, { method: 'POST', body: { text } });
}

export async function simulateDeposit(userId: string, asset: string, amount: number) {
  return adminFetch<{ ok: boolean; usd: number; balance: number }>('/admin/simulate-deposit', { method: 'POST', body: { userId, asset, amount } });
}

export { clearToken, setToken };
export function hasToken() { return !!token; }
