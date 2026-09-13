import { API_BASE } from './config';

interface ApiResult<T> {
  data: T | null;
  ok: boolean;
  offline: boolean;
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
      clearToken();
      return { data: null, ok: false, offline: false };
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
  balance: number;
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
  rate: number;
  usd: number;
  status: string;
}

export interface LoginResult {
  token: string;
  user: { id: string; email: string; name: string; balance: number; kycStatus: string; type?: string };
}

export async function login(email: string, password: string) {
  const r = await apiFetch<LoginResult>('/auth/login', { method: 'POST', body: { email, password } });
  if (r.ok && r.data?.token) setToken(r.data.token);
  return r;
}

export async function register(payload: { email: string; password: string; name: string; type: string }) {
  const r = await apiFetch<LoginResult>('/auth/register', { method: 'POST', body: payload });
  if (r.ok && r.data?.token) setToken(r.data.token);
  return r;
}

export async function googleAuth(email: string, name: string) {
  const r = await apiFetch<LoginResult>('/auth/google', { method: 'POST', body: { email, name } });
  if (r.ok && r.data?.token) setToken(r.data.token);
  return r;
}

export async function forgotPassword(email: string) {
  return apiFetch('/auth/forgot-password', { method: 'POST', body: { email } });
}

export async function getMe() {
  return apiFetch<MeData>('/auth/me');
}

export async function getTransactions() {
  return apiFetch<TransactionData[]>('/transactions');
}

export async function requestWithdrawal(amount: number) {
  return apiFetch<{ ok: boolean; message: string; balance: number }>('/withdrawals', { method: 'POST', body: { amount } });
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
    const json = await res.json();
    if (!res.ok) return { data: json as T, ok: false, offline: false };
    return { data: json as T, ok: true, offline: false };
  } catch {
    return { data: null, ok: false, offline: true };
  }
}

export async function adminLogin(email: string, password: string, totp: string) {
  const r = await adminFetch<{ token: string }>('/admin/login', { method: 'POST', body: { email, password, totp } });
  if (r.ok && r.data?.token) setAdminToken(r.data.token);
  return r;
}

export async function getAdminUsers() {
  return adminFetch<{ id: string; name: string; email: string; status: string; balance: string; joined: string; kyc: string }[]>('/admin/users');
}

export async function getAdminKyc() {
  return adminFetch<{ id: string; name: string; email: string; type: string; submitted: string; docs: string; status: string }[]>('/admin/kyc');
}

export async function decideKyc(id: string, action: 'approve' | 'reject') {
  return adminFetch(`/admin/kyc/${id}/${action}`, { method: 'POST' });
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
