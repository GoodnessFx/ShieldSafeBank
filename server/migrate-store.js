/**
 * One-time migration: store.json (and/or the currently live API) → Postgres.
 *
 * Usage (from server/):
 *   DATABASE_URL="postgresql://..." node migrate-store.js
 *   DATABASE_URL="postgresql://..." node migrate-store.js ./data/store.json
 *   DATABASE_URL="postgresql://..." node migrate-store.js --from-live https://shieldsafebank-api.onrender.com
 *   node migrate-store.js --from-live https://shieldsafebank-api.onrender.com --dry-run
 *
 * --from-live pulls users, threads, messages, KYC and transactions from the
 * running API (so chats that only exist in the live process are not lost) and
 * merges passwords from store.json / the demo seed.
 *
 * --dry-run prints exactly what would be written and exits without needing
 * DATABASE_URL — it never connects to Postgres.
 */
import pg from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Loads KEY=VALUE pairs from a git-ignored .env next to this script (or in the
 * working directory) when the variable is not already in the environment, so the
 * Supabase URI never has to be pasted into the shell (or into a chat window).
 */
function loadEnvFile() {
  for (const candidate of [join(__dirname, '.env'), join(process.cwd(), '.env')]) {
    if (!existsSync(candidate)) continue;
    for (const line of readFileSync(candidate, 'utf-8').split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const value = m[2].trim().replace(/^["']|["']$/g, '');
      if (value && !process.env[m[1]]) process.env[m[1]] = value;
    }
    return candidate;
  }
  return '';
}

const envFile = loadEnvFile();

const args = process.argv.slice(2);
const FLAGS = new Set(['--from-live', '--dry-run']);
const DRY_RUN = args.includes('--dry-run');
const fromLiveIdx = args.indexOf('--from-live');
const DATABASE_URL = (process.env.DATABASE_URL || '').trim();

if (!DATABASE_URL && !DRY_RUN) {
  console.error('DATABASE_URL is required. Set it to your Supabase Postgres URI:');
  console.error(`  • in the environment, or`);
  console.error(`  • in ${envFile || join(__dirname, '.env')} as DATABASE_URL=postgresql://...`);
  console.error('That .env file is git-ignored, so the URI is never committed.');
  console.error('Use --dry-run to preview what would be migrated without a database.');
  process.exit(1);
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS kyc_queue (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS threads (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS messages (thread_id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS support_messages (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
`;

const liveBase = fromLiveIdx >= 0
  ? String(args[fromLiveIdx + 1] || 'https://shieldsafebank-api.onrender.com').replace(/\/$/, '')
  : '';
const fileArg = args.find((a, i) => !FLAGS.has(a) && (fromLiveIdx < 0 || i !== fromLiveIdx + 1));
const filePath = fileArg
  || process.env.STORE_PATH
  || join(process.env.DATA_DIR || join(__dirname, 'data'), 'store.json');

function emptyStore() {
  return {
    users: [],
    transactions: [],
    kycQueue: [],
    threads: [],
    messages: {},
    supportMessages: [],
    counters: { user: 0, tx: 0, thread: 0, kyc: 0, support: 0 },
  };
}

function readStoreFile(path) {
  if (!existsSync(path)) return null;
  const parsed = JSON.parse(readFileSync(path, 'utf-8'));
  return {
    ...emptyStore(),
    ...parsed,
    users: Array.isArray(parsed.users) ? parsed.users : [],
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    kycQueue: Array.isArray(parsed.kycQueue) ? parsed.kycQueue : [],
    threads: Array.isArray(parsed.threads) ? parsed.threads : [],
    messages: parsed.messages && typeof parsed.messages === 'object' ? parsed.messages : {},
    supportMessages: Array.isArray(parsed.supportMessages) ? parsed.supportMessages : [],
    counters: parsed.counters && typeof parsed.counters === 'object' ? parsed.counters : {},
  };
}

function mergeById(baseList, extraList) {
  const byId = new Map();
  for (const item of baseList || []) if (item && item.id) byId.set(item.id, { ...item });
  for (const item of extraList || []) {
    if (!item || !item.id) continue;
    const prev = byId.get(item.id) || {};
    const merged = { ...prev, ...item };
    if (!item.password && prev.password) merged.password = prev.password;
    byId.set(item.id, merged);
  }
  return Array.from(byId.values());
}

const DEMO_PASSWORDS = {
  'demo@shieldsafebank.com': 'demo1234',
  'elena@example.com': 'demo1234',
  'james.o@example.com': 'demo1234',
  'linwei@example.com': 'demo1234',
  'amara.d@example.com': 'demo1234',
  'mbellini@example.com': 'demo1234',
};

function fillMissingPasswords(users, fileUsers) {
  const byEmail = new Map();
  for (const u of fileUsers || []) if (u && u.email) byEmail.set(String(u.email).toLowerCase(), u.password || '');
  for (const u of users) {
    if (u.password) continue;
    const fromFile = byEmail.get(String(u.email || '').toLowerCase());
    u.password = fromFile || DEMO_PASSWORDS[String(u.email || '').toLowerCase()] || '';
  }
  return users;
}

function stripAdminTxFields(tx) {
  const { user, statusLabel, hold, ...rest } = tx || {};
  return rest;
}

async function fetchLive(base) {
  const login = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL || 'admin@shieldsafebank.com',
      password: process.env.ADMIN_PASSWORD || 'admin1234',
    }),
  });
  const loginJson = await login.json();
  if (!login.ok || !loginJson.token) {
    throw new Error(`Live admin login failed: ${JSON.stringify(loginJson)}`);
  }
  const token = loginJson.token;
  const get = async (path) => {
    const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`${path} → ${res.status}`);
    return res.json();
  };
  const users = await get('/api/admin/users');
  const threads = await get('/api/admin/threads');
  const kycQueue = await get('/api/admin/kyc');
  const transactions = (await get('/api/admin/transactions')).map(stripAdminTxFields);
  const messages = {};
  for (const thread of threads) {
    messages[thread.id] = await get(`/api/admin/threads/${thread.id}/messages`);
  }
  const mappedUsers = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    status: u.status === 'Suspended' ? 'suspended' : 'active',
    balance: Number(String(u.balance || '0').replace(/[^0-9.-]/g, '')) || 0,
    kycStatus: u.kyc === 'Approved' ? 'approved' : u.kyc === 'Rejected' ? 'rejected' : 'pending',
    joined: u.joined || '',
    lastLogin: u.lastLogin || '',
    accountNumber: u.accountNumber || '',
    firstName: u.firstName || '',
    middleName: u.middleName || '',
    lastName: u.lastName || '',
    phone: u.phone || '',
    dob: u.dob || '',
    address: u.address || '',
    businessName: u.businessName || '',
    type: u.type || 'personal',
    emailVerified: true,
    totpEnabled: false,
    password: '',
  }));
  const counters = {
    user: mappedUsers.reduce((n, u) => Math.max(n, parseInt(String(u.id).replace(/\D/g, ''), 10) || 0), 0),
    tx: transactions.reduce((n, t) => Math.max(n, parseInt(String(t.id).replace(/\D/g, ''), 10) || 0), 0),
    thread: threads.reduce((n, t) => Math.max(n, parseInt(String(t.id).replace(/\D/g, ''), 10) || 0), 0),
    kyc: kycQueue.reduce((n, k) => Math.max(n, parseInt(String(k.id).replace(/\D/g, ''), 10) || 0), 0),
    support: 1,
  };
  return { users: mappedUsers, threads, messages, kycQueue, transactions, supportMessages: [], counters };
}

function mergeStores(fileStore, liveStore) {
  const out = emptyStore();
  out.users = mergeById(fileStore.users, liveStore.users);
  out.transactions = mergeById(fileStore.transactions, liveStore.transactions);
  out.kycQueue = mergeById(fileStore.kycQueue, liveStore.kycQueue);
  out.threads = mergeById(fileStore.threads, liveStore.threads);
  out.supportMessages = mergeById(fileStore.supportMessages, liveStore.supportMessages);
  out.messages = { ...(fileStore.messages || {}), ...(liveStore.messages || {}) };
  const counters = { ...(fileStore.counters || {}), ...(liveStore.counters || {}) };
  for (const key of Object.keys(counters)) {
    counters[key] = Math.max(Number(fileStore.counters?.[key]) || 0, Number(liveStore.counters?.[key]) || 0);
  }
  out.counters = counters;
  out.users = fillMissingPasswords(out.users, fileStore.users);
  return out;
}

async function persist(store) {
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    await client.query(SCHEMA_SQL);
    await client.query('BEGIN');
    const upsert = async (table, idCol, id, data) => {
      await client.query(
        `INSERT INTO ${table} (${idCol}, data) VALUES ($1, $2::jsonb)
         ON CONFLICT (${idCol}) DO UPDATE SET data = EXCLUDED.data`,
        [id, JSON.stringify(data)],
      );
    };
    for (const u of store.users) await upsert('users', 'id', u.id, u);
    for (const t of store.transactions) await upsert('transactions', 'id', t.id, t);
    for (const k of store.kycQueue) await upsert('kyc_queue', 'id', k.id, k);
    for (const t of store.threads) await upsert('threads', 'id', t.id, t);
    for (const [threadId, msgs] of Object.entries(store.messages || {})) {
      await upsert('messages', 'thread_id', threadId, msgs);
    }
    for (const s of store.supportMessages) await upsert('support_messages', 'id', s.id, s);
    for (const [name, value] of Object.entries(store.counters || {})) {
      await client.query(
        `INSERT INTO counters (name, value) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET value = GREATEST(counters.value, EXCLUDED.value)`,
        [name, Number(value) || 0],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* already failed */ }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

const fileStore = readStoreFile(filePath) || emptyStore();
if (!readStoreFile(filePath)) {
  console.warn(`No store.json at ${filePath} — using an empty file store (live/seed data still imported if requested).`);
}

let store = fileStore;
if (liveBase) {
  console.log(`Fetching live data from ${liveBase} …`);
  const live = await fetchLive(liveBase);
  store = mergeStores(fileStore, live);
}

if (store.users.length === 0 && Object.keys(store.messages).length === 0) {
  console.error('Nothing to migrate. Pass a store.json path or --from-live <api-origin>.');
  process.exit(1);
}

const messageCount = Object.values(store.messages).reduce((n, list) => n + (Array.isArray(list) ? list.length : 0), 0);

if (DRY_RUN) {
  // Previews exactly what the real run would write, without needing the
  // connection string and without touching the database.
  const withPassword = store.users.filter(u => u.password).length;
  console.log('\nDRY RUN — nothing was written.');
  console.log(`  Source:   ${liveBase ? `live API ${liveBase} merged with ${filePath}` : filePath}`);
  console.log(`  Users:    ${store.users.length} (${withPassword} with a password)`);
  console.log(`  Threads:  ${store.threads.length}  Messages: ${messageCount}`);
  console.log(`  Txs:      ${store.transactions.length}  KYC: ${store.kycQueue.length}`);
  console.log(`  Counters: ${JSON.stringify(store.counters)}`);
  for (const u of store.users) console.log(`    user ${u.id}  ${u.email}  "${u.name}"${u.password ? '' : '  (no password)'}`);
  for (const t of store.threads) {
    const msgs = store.messages[t.id] || [];
    console.log(`    thread ${t.id}  ${t.email || '(no email)'}  ${msgs.length} message(s)`);
  }
  console.log('\nRe-run without --dry-run, with DATABASE_URL set, to apply this.');
  process.exit(0);
}

await persist(store);
console.log(`Migrated ${store.users.length} users, ${store.threads.length} threads, ${messageCount} messages, ${store.transactions.length} transactions, ${store.kycQueue.length} KYC items.`);
