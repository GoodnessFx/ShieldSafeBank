import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Data directory can be pointed at a mounted persistent disk in production
// (for example Render/Railway), so the store survives restarts and deploys.
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
const DATA_PATH = join(DATA_DIR, 'store.json');
const PORT = process.env.PORT || 4000;
const DATABASE_URL = process.env.DATABASE_URL || '';
const pool = DATABASE_URL
  ? new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
      max: 5,
    })
  : null;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS kyc_queue (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS threads (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS messages (thread_id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS login_events (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS activity_events (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS support_messages (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
`;

const BTC_ADDR = 'bc1q4ulqydnrstew9hr2dkjaey5he2j2zyj83475mc';
const USDT_ADDR = '0x18595c69b0e49dA32037E19246Fe88FA321De1C6';

/** The bank's full name — account numbers never use an abbreviation such as "SSB". */
const BANK_NAME = 'Shield Safe Bank';

const SEED = {
  users: [
    { id:'U001', email:'demo@shieldsafebank.com', password:'demo1234', name:'Demo User', type:'personal', status:'active', balance:17760.94, kycStatus:'approved', joined:'2025-08-10', emailVerified:true, totpEnabled:true },
    { id:'U002', email:'elena@example.com', password:'demo1234', name:'Elena Vasquez', type:'personal', status:'active', balance:24380.00, kycStatus:'approved', joined:'2025-08-02', emailVerified:true, totpEnabled:true },
    { id:'U003', email:'james.o@example.com', password:'demo1234', name:'James Okonkwo', type:'personal', status:'active', balance:7915.50, kycStatus:'approved', joined:'2025-08-14', emailVerified:true, totpEnabled:true },
    { id:'U004', email:'linwei@example.com', password:'demo1234', name:'Lin Wei', type:'personal', status:'active', balance:0, kycStatus:'in_review', joined:'2025-09-11', emailVerified:true, totpEnabled:false },
    { id:'U005', email:'amara.d@example.com', password:'demo1234', name:'Amara Diallo', type:'personal', status:'active', balance:3200.00, kycStatus:'approved', joined:'2025-09-01', emailVerified:true, totpEnabled:true },
    { id:'U006', email:'mbellini@example.com', password:'demo1234', name:'Marco Bellini', type:'personal', status:'suspended', balance:0, kycStatus:'rejected', joined:'2025-08-20', emailVerified:true, totpEnabled:true },
  ],
  transactions: [
    { id:'T001', userId:'U001', date:'2025-09-10', type:'deposit', asset:'BTC', amount:'0.25', rate:67842.50, usd:16875.83, status:'completed' },
    { id:'T002', userId:'U001', date:'2025-09-08', type:'withdrawal', asset:'USD', amount:'', rate:0, usd:5000.00, status:'completed' },
    { id:'T003', userId:'U001', date:'2025-09-05', type:'deposit', asset:'USDT', amount:'2000', rate:0.9998, usd:1999.10, status:'completed' },
    { id:'T004', userId:'U001', date:'2025-09-01', type:'withdrawal', asset:'USD', amount:'', rate:0, usd:2500.00, status:'completed' },
    { id:'T005', userId:'U001', date:'2025-08-28', type:'deposit', asset:'BTC', amount:'0.10', rate:64180.00, usd:6386.01, status:'completed' },
    { id:'T1091', userId:'U002', date:'2025-09-12 14:22', type:'deposit', asset:'BTC', amount:'0.25', rate:67503.32, usd:16875.83, status:'cleared' },
    { id:'T1090', userId:'U003', date:'2025-09-12 11:08', type:'withdrawal', asset:'USD', amount:'', rate:0, usd:5000.00, status:'cleared' },
    { id:'T1089', userId:'U005', date:'2025-09-11 09:44', type:'deposit', asset:'USDT', amount:'3200', rate:1.00, usd:3200.00, status:'on_hold' },
    { id:'T1088', userId:'U002', date:'2025-09-10 18:55', type:'withdrawal', asset:'USD', amount:'', rate:0, usd:9000.00, status:'cleared' },
  ],
  kycQueue: [
    { id:'K001', userId:'U004', name:'Lin Wei', email:'linwei@example.com', type:'Personal', submitted:'2025-09-11', docs:'Passport + Liveness', status:'pending' },
    { id:'K002', name:'Soleil Martin', email:'soleil.m@example.com', type:'Personal', submitted:'2025-09-12', docs:'Driver\'s License + Liveness', status:'pending' },
  ],
  threads: [
    { id:'C001', userId:'U002', user:'Elena Vasquez', preview:'My deposit hasn\'t confirmed yet...', time:'2:14 PM', unread:true },
    { id:'C002', userId:'U003', user:'James Okonkwo', preview:'Can I change my withdrawal bank?', time:'Yesterday', unread:false },
  ],
  messages: {
    C001: [{ from:'user', text:'My deposit hasn\'t confirmed yet. I sent 0.1 BTC two hours ago.', time:'2:14 PM' }],
    C002: [
      { from:'user', text:'Can I change my withdrawal bank account?', time:'Yesterday' },
      { from:'admin', text:'Yes, you can add a new bank from your dashboard under Withdraw > Manage payment methods.', time:'Yesterday' },
    ],
  },
  supportMessages: [],
  loginEvents: [],
  counters: { user:7, tx:1092, thread:3, kyc:3, support:1, login:0 },
};

function readJsonStore() {
  mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DATA_PATH)) return null;
  return normalizeDB(JSON.parse(readFileSync(DATA_PATH, 'utf-8')));
}

function writeJsonStore(store) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_PATH, JSON.stringify(store, null, 2));
}

async function ensureSchema(client) {
  await client.query(SCHEMA_SQL);
}

async function persistToPg(store) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureSchema(client);
    await client.query('DELETE FROM users');
    await client.query('DELETE FROM transactions');
    await client.query('DELETE FROM kyc_queue');
    await client.query('DELETE FROM threads');
    await client.query('DELETE FROM messages');
    await client.query('DELETE FROM login_events');
    await client.query('DELETE FROM activity_events');
    await client.query('DELETE FROM support_messages');
    await client.query('DELETE FROM counters');
    for (const u of store.users) {
      await client.query('INSERT INTO users (id, data) VALUES ($1, $2::jsonb)', [u.id, JSON.stringify(u)]);
    }
    for (const t of store.transactions) {
      await client.query('INSERT INTO transactions (id, data) VALUES ($1, $2::jsonb)', [t.id, JSON.stringify(t)]);
    }
    for (const k of store.kycQueue) {
      await client.query('INSERT INTO kyc_queue (id, data) VALUES ($1, $2::jsonb)', [k.id, JSON.stringify(k)]);
    }
    for (const t of store.threads) {
      await client.query('INSERT INTO threads (id, data) VALUES ($1, $2::jsonb)', [t.id, JSON.stringify(t)]);
    }
    for (const [threadId, msgs] of Object.entries(store.messages || {})) {
      await client.query('INSERT INTO messages (thread_id, data) VALUES ($1, $2::jsonb)', [threadId, JSON.stringify(msgs)]);
    }
    for (const e of store.loginEvents || []) {
      await client.query('INSERT INTO login_events (id, data) VALUES ($1, $2::jsonb)', [e.id, JSON.stringify(e)]);
    }
    for (const s of store.supportMessages) {
      await client.query('INSERT INTO support_messages (id, data) VALUES ($1, $2::jsonb)', [s.id, JSON.stringify(s)]);
    }
    for (const e of store.activityEvents || []) {
      await client.query('INSERT INTO activity_events (id, data) VALUES ($1, $2::jsonb)', [e.id, JSON.stringify(e)]);
    }
    for (const [name, value] of Object.entries(store.counters || {})) {
      await client.query('INSERT INTO counters (name, value) VALUES ($1, $2)', [name, Number(value) || 0]);
    }
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* already failed */ }
    throw err;
  } finally {
    client.release();
  }
}

async function loadFromPg() {
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const [users, transactions, kycQueue, threads, messages, loginEvents, activityEvents, supportMessages, counters] = await Promise.all([
      client.query('SELECT data FROM users'),
      client.query('SELECT data FROM transactions'),
      client.query('SELECT data FROM kyc_queue'),
      client.query('SELECT data FROM threads'),
      client.query('SELECT thread_id, data FROM messages'),
      client.query('SELECT data FROM login_events'),
      client.query('SELECT data FROM activity_events'),
      client.query('SELECT data FROM support_messages'),
      client.query('SELECT name, value FROM counters'),
    ]);
    const msgMap = {};
    for (const row of messages.rows) msgMap[row.thread_id] = row.data;
    const counterMap = {};
    for (const row of counters.rows) counterMap[row.name] = row.value;
    return normalizeDB({
      users: users.rows.map(r => r.data),
      transactions: transactions.rows.map(r => r.data),
      kycQueue: kycQueue.rows.map(r => r.data),
      threads: threads.rows.map(r => r.data),
      messages: msgMap,
      loginEvents: loginEvents.rows.map(r => r.data),
      activityEvents: activityEvents.rows.map(r => r.data),
      supportMessages: supportMessages.rows.map(r => r.data),
      counters: counterMap,
    });
  } finally {
    client.release();
  }
}

async function loadDB() {
  if (pool) {
    const existing = await loadFromPg();
    if (existing.users.length > 0) return existing;
    const fromFile = readJsonStore();
    const store = fromFile || normalizeDB(SEED);
    await persistToPg(store);
    console.log(fromFile
      ? `  Imported ${store.users.length} users from store.json into Postgres.`
      : '  Seeded Postgres from the built-in demo store.');
    return store;
  }
  const fromFile = readJsonStore();
  if (!fromFile) {
    const seed = normalizeDB(SEED);
    writeJsonStore(seed);
    return seed;
  }
  writeJsonStore(fromFile);
  return fromFile;
}

function num(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Issues an account number using the bank's full name, keeping the digits of an
 * existing number (including any legacy "SSB-…" value) so it stays recognisable.
 */
function makeAccountNumber(existing) {
  const digits = String(existing || '').replace(/\D/g, '')
    || Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('');
  return `${BANK_NAME}-${digits}`;
}

function normalizeDB(db) {
  const store = db && typeof db === 'object' ? db : {};
  store.users = Array.isArray(store.users) ? store.users : [];
  store.users.forEach(u => {
    u.balance = num(u.balance);
    u.status = u.status || 'active';
    u.kycStatus = u.kycStatus || 'pending';
    u.joined = u.joined || '';
    u.lastLogin = u.lastLogin || '';
    u.lastActiveAt = u.lastActiveAt || '';
    u.emailVerified = !!u.emailVerified;
    u.totpEnabled = !!u.totpEnabled;
    u.accountNumber = makeAccountNumber(u.accountNumber);
    u.firstName = u.firstName || '';
    u.middleName = u.middleName || '';
    u.lastName = u.lastName || '';
    u.phone = u.phone || '';
    u.dob = u.dob || '';
    u.address = u.address || '';
    u.businessName = u.businessName || '';
  });
  store.transactions = Array.isArray(store.transactions) ? store.transactions : [];
  store.transactions.forEach(t => {
    t.usd = num(t.usd);
    t.rate = num(t.rate);
    t.amount = t.amount === undefined || t.amount === null ? '' : String(t.amount);
    t.date = t.date || '';
    t.type = t.type || '';
    t.asset = t.asset || '';
    t.status = t.status || 'pending';
  });
  store.kycQueue = Array.isArray(store.kycQueue) ? store.kycQueue : [];
  store.threads = Array.isArray(store.threads) ? store.threads : [];
  store.threads.forEach(t => {
    t.user = t.user || '';
    t.email = t.email || '';
    t.preview = t.preview || '';
    t.time = t.time || '';
    t.at = t.at || '';
    t.unread = !!t.unread;
  });
  store.messages = store.messages && typeof store.messages === 'object' ? store.messages : {};
  Object.keys(store.messages).forEach(id => {
    store.messages[id] = Array.isArray(store.messages[id]) ? store.messages[id].map(m => ({
      ...m,
      id: m.id || `legacy${id}${Math.random().toString(36).slice(2, 8)}`,
      time: m.time || '',
      at: m.at || '',
      read: !!m.read,
    })) : [];
  });
  store.supportMessages = Array.isArray(store.supportMessages) ? store.supportMessages : [];
  store.loginEvents = Array.isArray(store.loginEvents) ? store.loginEvents : [];
  store.loginEvents.forEach(e => {
    e.id = e.id || '';
    e.userId = e.userId || '';
    e.email = e.email || '';
    e.loggedInAt = e.loggedInAt || '';
  });
  store.activityEvents = Array.isArray(store.activityEvents) ? store.activityEvents : [];
  store.activityEvents.forEach(e => {
    e.id = e.id || '';
    e.userId = e.userId || '';
    e.email = e.email || '';
    e.action = e.action || 'login';
    e.details = e.details || {};
    e.at = e.at || '';
  });
  store.counters = store.counters && typeof store.counters === 'object' ? store.counters : {};
  return store;
}

let persistChain = Promise.resolve();
function saveDB(store) {
  if (!pool) {
    try { writeJsonStore(store); } catch (err) { console.error('[store] persist failed', err); }
    return Promise.resolve();
  }
  persistChain = persistChain
    .then(() => persistToPg(store))
    .catch(err => { console.error('[store] persist failed', err); });
  return persistChain;
}

/**
 * Sessions are signed, not stored.
 *
 * The previous design kept live tokens in an in-memory Map, so every process
 * restart silently invalidated every admin and customer session. The free-tier
 * host restarts often (and resets its ephemeral data file), which is exactly why
 * the admin console kept demanding a fresh sign-in even though the server was up.
 *
 * Tokens are now a keyed HMAC - of the user id, or of the fixed `admin` scope -
 * so they stay valid across restarts and redeploys with no server-side state.
 *
 * Demo caveat: the key is a constant in an app whose admin credentials are
 * already public (admin@shieldsafebank.com / admin1234). A real deployment should
 * read SESSION_SECRET from the environment and rotate it.
 */
const SESSION_SECRET = process.env.SESSION_SECRET || 'shieldsafebank-demo-session-key-v1';

/* ---------------------------------------------------------------------------
 * Resend email helper
 *
 * Lazy-initialised so the server still starts when RESEND_API_KEY is absent
 * (local development, staging). Every caller receives a structured result
 * { ok: true } or { ok: false, error: string } — never a thrown exception —
 * so endpoints can return a clear 500 instead of silently succeeding.
 * ------------------------------------------------------------------------- */
let _resend = null;
function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (_resend) return _resend;
  // Dynamic import so the module is only loaded when the key is present.
  // We resolve it synchronously after the first async call has cached the instance.
  return null; // resolved on first use via sendMail
}

async function sendMail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[email] RESEND_API_KEY is not set — email not sent.');
    return { ok: false, error: 'Email service is not configured on this server.' };
  }
  try {
    if (!_resend) {
      const { Resend } = await import('resend');
      _resend = new Resend(key);
    }
    const { data, error } = await _resend.emails.send({
      from: 'Shield Safe Bank <no-reply@shieldsafebank.com>',
      to,
      subject,
      html,
    });
    if (error) {
      console.error('[email] Resend error:', error);
      return { ok: false, error: error.message || 'Failed to send email.' };
    }
    console.log('[email] Sent to', to, '| id:', data && data.id);
    return { ok: true };
  } catch (err) {
    console.error('[email] Unexpected error:', err);
    return { ok: false, error: 'Failed to send email. Please try again.' };
  }
}

/* ---------------------------------------------------------------------------
 * Short-lived token / code stores (in-memory Maps)
 *
 * resetTokens  — password-reset tokens, 30-minute TTL.
 *   key: hex token string
 *   val: { userId, expiresAt (ms) }
 *
 * verifyTokens — email-verification codes, 10-minute TTL.
 *   key: email (lower-cased)
 *   val: { code, expiresAt (ms) }
 *
 * Both stores are in-memory only. Tokens are short-lived so a Render free-tier
 * restart (which clears them) is an acceptable tradeoff — the user simply
 * requests a fresh link/code.
 * ------------------------------------------------------------------------- */
const resetTokens = new Map();   // token  → { userId, expiresAt }
const verifyTokens = new Map();  // email  → { code, expiresAt }

/** Purge stale entries (called on every write to avoid unbounded growth). */
function pruneTokens() {
  const now = Date.now();
  for (const [k, v] of resetTokens) if (v.expiresAt < now) resetTokens.delete(k);
  for (const [k, v] of verifyTokens) if (v.expiresAt < now) verifyTokens.delete(k);
}

function sign(scope) {
  return createHmac('sha256', SESSION_SECRET).update(scope).digest('hex');
}

/** Stable bearer token for the single demo admin account. */
function adminToken() {
  return sign('admin');
}

/** Bearer token that carries the user id, so it needs no server-side lookup. */
function userToken(userId) {
  return `${userId}.${sign('user:' + userId)}`;
}

/** Returns the user id a token was issued for, or null when it is not authentic. */
function userIdFromToken(token) {
  const value = String(token || '');
  const dot = value.indexOf('.');
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign('user:' + id));
  if (given.length !== expected.length) return null;
  return timingSafeEqual(given, expected) ? id : null;
}

function nextId(db, type) {
  db.counters[type] = (db.counters[type] || 0) + 1;
  const prefixes = { user:'U', tx:'T', thread:'C', kyc:'K', support:'S', login:'L', activity:'A' };
  return `${prefixes[type] || type.toUpperCase()}${String(db.counters[type]).padStart(4,'0')}`;
}

/** Records every successful email/password login, including repeats. */
function recordLoginEvent(user) {
  if (!user) return null;
  const loggedInAt = new Date().toISOString();
  const event = {
    id: nextId(db, 'login'),
    userId: user.id,
    email: user.email || '',
    loggedInAt,
  };
  db.loginEvents.push(event);
  saveDB(db);
  return event;
}

/** Records a user activity event so the admin Activity panel captures everything
 * that happens across all devices — logins, deposits, withdrawals, sign-ups. */
function recordActivityEvent(user, action, details = {}) {
  if (!user) return;
  const event = {
    id: nextId(db, 'activity'),
    userId: user.id,
    email: user.email || '',
    name: user.name || '',
    action,
    via: details.via || 'email',
    details,
    at: new Date().toISOString(),
  };
  db.activityEvents.push(event);
  saveDB(db);
}

/* ---------------------------------------------------------------------------
 * Realtime chat transport.
 *
 * Provider-agnostic: every chat mutation funnels through `publishChatEvent`,
 * which fans out to all attached Server-Sent-Events subscribers. Swapping to a
 * managed provider (Pusher/Ably/Firebase) later means replacing only this block
 * and the matching client module in src/lib/chatTransport.ts — the UI, the REST
 * endpoints and the data store stay exactly as they are.
 *
 * Auth uses the signed token in the query string because EventSource cannot set
 * headers. Tokens are the same stateless HMAC values the REST API uses.
 * ------------------------------------------------------------------------- */
const chatSubscribers = new Set();
let chatEventId = 0;

function makeMessage(db, threadId, from, text) {
  const at = new Date().toISOString();
  return { id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, from, text, time: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }), at, read: false };
}

/** Fans an SSE frame out to every attached subscriber. Customers only ever get
 * events for their own thread; admins receive everything. */
function broadcastChat(payload, threadId) {
  chatEventId += 1;
  const body = JSON.stringify({ ...payload, eventId: chatEventId });
  for (const sub of chatSubscribers) {
    // Customers only ever receive events for their own thread.
    if (sub.userId && sub.threadId && sub.threadId !== threadId) continue;
    if (sub.userId && !sub.threadId) {
      // Late-created customer stream: adopt its thread on the first event.
      const mine = (db.threads || []).find(t => t.userId === sub.userId);
      if (!mine || mine.id !== threadId) continue;
      sub.threadId = threadId;
    }
    try {
      sub.res.write(`id: ${chatEventId}\nevent: chat\ndata: ${body}\n\n`);
    } catch {
      chatSubscribers.delete(sub);
    }
  }
}

function publishChatEvent(threadId, messages, thread) {
  broadcastChat({ type: 'chat', threadId, messages, thread }, threadId);
}

function publishTyping(threadId, role) {
  broadcastChat({ type: 'typing', threadId, role }, threadId);
}

/** A recipient has opened a thread: broadcast the updated read flags so the
 * sender's UI can flip its ticks to blue instantly. */
function publishRead(threadId, messages) {
  broadcastChat({ type: 'read', threadId, messages }, threadId);
}

function openChatStream(req, res, identity) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  const sub = { res, userId: identity.userId || '', isAdmin: !!identity.isAdmin, threadId: identity.threadId || '' };
  chatSubscribers.add(sub);
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* cleaned up below */ }
  }, 25000);
  req.on('close', () => { clearInterval(heartbeat); chatSubscribers.delete(sub); });
}

/** A customer's own thread, adopted once known so their stream filters to it. */
function threadForUser(user) {
  return (db.threads || []).find(t => t.userId === user.id);
}

const CHAT_MAX_LEN = 2000;
const chatSendLog = new Map();

/** Basic flood guard: 25 messages per 30 seconds per account. */
function chatRateLimited(userId) {
  const now = Date.now();
  const windowStart = now - 30000;
  const stamps = (chatSendLog.get(userId) || []).filter(t => t > windowStart);
  if (stamps.length >= 25) { chatSendLog.set(userId, stamps); return true; }
  stamps.push(now);
  chatSendLog.set(userId, stamps);
  return false;
}

/* ---------------------------------------------------------------------------
 * Chat is a normal, free-flowing conversation.
 *
 * There are no timers, countdowns or automated replies: a customer can send as
 * many messages as they like, whenever they like, and an admin can answer as
 * often as they like. Every message is appended to the thread and persisted
 * (Postgres when DATABASE_URL is set, otherwise store.json), so both sides see
 * the complete history whenever they come back.
 *
 * Presence: the customer-facing "agent online" dot is driven by how many admin
 * consoles currently hold the realtime stream open (see /api/chat/presence).
 * ------------------------------------------------------------------------- */

const app = express();
app.use(cors());
app.use(express.json());

// Public health check for hosting platforms (Render, Railway, uptime monitors).
// Deliberately requires no auth so deploys are never marked unhealthy.
app.get('/api/health', (_, res) => {
  res.json({ ok: true, service: 'shieldsafebank-api', time: new Date().toISOString() });
});

// Readiness probe used by the deployed admin console: resolves green only when
// the API truly answers, so the offline banner cannot lie. Any error (network,
// timeout, 5xx) surfaces as a failed probe.
app.get('/api/admin/ping', adminMiddleware, (_, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

let db = normalizeDB({});

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error:'Missing token' });
  const userId = userIdFromToken(header.slice(7));
  if (!userId) return res.status(401).json({ error:'Invalid token' });
  req.user = db.users.find(u => u.id === userId);
  if (!req.user) return res.status(401).json({ error:'User not found' });
  next();
}

function adminMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error:'Missing token' });
  const given = Buffer.from(String(header.slice(7)));
  const expected = Buffer.from(adminToken());
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return res.status(401).json({ error:'Invalid admin token' });
  }
  next();
}

app.get('/api/rates', (_, res) => res.json({ BTC: 67842.50, USDT: 0.9998 }));

app.post('/api/auth/register', (req, res) => {
  const { email, password, name, type, businessName, firstName, middleName, lastName, phone, dob, address } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error:'Email, password, and name are required.' });
  if (db.users.find(u => u.email === email)) return res.status(409).json({ error:'An account with this email already exists.' });
  const user = {
    id: nextId(db,'user'), email, password, name, type: type || 'personal',
    status:'active', balance:0, kycStatus:'pending', joined: new Date().toISOString().slice(0,10),
    emailVerified:false, totpEnabled:false,
    firstName: (firstName || '').trim(), middleName: (middleName || '').trim(),
    lastName: (lastName || '').trim(), phone: (phone || '').trim(),
    dob: (dob || '').trim(), address: (address || '').trim(),
    businessName: businessName || '',
    accountNumber: makeAccountNumber(),
    lastLogin: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };
  db.users.push(user);
  saveDB(db);
  recordActivityEvent(user, 'signup', { via: 'email' });
  const token = userToken(user.id);
  res.json({ token, user:{ id:user.id, email:user.email, name:user.name, balance:user.balance, kycStatus:user.kycStatus, type:user.type, accountNumber:user.accountNumber } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error:'Email and password are required.' });
  const user = db.users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error:'Invalid credentials.' });
  if (user.password !== password) return res.status(401).json({ error:'Invalid credentials.' });
  if (user.status === 'suspended') return res.status(403).json({ error:'Account is suspended.' });
  const token = userToken(user.id);
  user.lastLogin = new Date().toISOString();
  user.lastActiveAt = user.lastLogin;
  recordLoginEvent(user);
  saveDB(db);
  res.json({ token, user:{ id:user.id, email:user.email, name:user.name, balance:user.balance, kycStatus:user.kycStatus, type:user.type, accountNumber:user.accountNumber } });
});

async function verifyGoogleIdToken(idToken) {
  try {
    const { OAuth2Client } = await import('google-auth-library');
    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    return ticket.getPayload() || null;
  } catch {
    return null;
  }
}

app.post('/api/auth/google', async (req, res) => {
  const { email, name, idToken } = req.body;
  let emailToUse = email;
  let nameToUse = name || 'Google User';
  if (process.env.GOOGLE_CLIENT_ID && idToken) {
    const payload = await verifyGoogleIdToken(idToken);
    if (!payload || !payload.email) return res.status(401).json({ error: 'Invalid Google credential.' });
    emailToUse = payload.email;
    nameToUse = payload.name || nameToUse;
  }
  if (!emailToUse) return res.status(400).json({ error: 'Email is required.' });
  let user = db.users.find(u => u.email === emailToUse);
  if (!user) {
    user = {
      id: nextId(db,'user'), email: emailToUse, password:'', name: nameToUse,
      type:'personal', status:'active', balance:0, kycStatus:'approved',
      joined: new Date().toISOString().slice(0,10), emailVerified:true, totpEnabled:false,
      accountNumber: makeAccountNumber(),
      lastLogin: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    db.users.push(user);
    saveDB(db);
    recordActivityEvent(user, 'signup', { via: 'google' });
  } else {
    user.lastLogin = new Date().toISOString();
    user.lastActiveAt = user.lastLogin;
    recordLoginEvent(user);
    saveDB(db);
  }
  const token = userToken(user.id);
  res.json({ token, user:{ id:user.id, email:user.email, name:user.name, balance:user.balance, kycStatus:user.kycStatus, type:user.type, accountNumber:user.accountNumber } });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const user = email ? db.users.find(u => String(u.email).toLowerCase() === email) : null;

  // Always respond the same way for unknown emails (prevents email enumeration).
  if (!user) {
    return res.json({ ok: true, message: 'If an account exists, a reset link has been sent.' });
  }

  pruneTokens();
  const token = randomBytes(32).toString('hex');
  resetTokens.set(token, { userId: user.id, expiresAt: Date.now() + 30 * 60 * 1000 });

  const appUrl = (process.env.APP_URL || 'https://shieldsafebank.com').replace(/\/$/, '');
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reset your password</title></head>
<body style="margin:0;padding:0;background:#F4F6F8;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F8;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #DCE3EA;">
        <tr><td style="background:#0A2044;padding:28px 40px;">
          <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Shield Safe Bank</span>
        </td></tr>
        <tr><td style="padding:40px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0A2044;">Reset your password</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#4A5568;line-height:1.6;">Hi ${user.name || user.email},</p>
          <p style="margin:0 0 24px;font-size:15px;color:#4A5568;line-height:1.6;">We received a request to reset the password for your Shield Safe Bank account. Click the button below to choose a new password.</p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td style="background:#123C7C;">
            <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Reset Password</a>
          </td></tr></table>
          <p style="margin:0 0 16px;font-size:13px;color:#6B7280;line-height:1.6;">Or paste this link in your browser:<br><a href="${resetUrl}" style="color:#123C7C;word-break:break-all;">${resetUrl}</a></p>
          <p style="margin:0 0 0;font-size:13px;color:#9CA3AF;line-height:1.6;">This link expires in <strong>30 minutes</strong>. If you did not request a password reset, you can safely ignore this email — your password will not change.</p>
        </td></tr>
        <tr><td style="background:#F4F6F8;border-top:1px solid #DCE3EA;padding:20px 40px;font-size:12px;color:#9CA3AF;">
          &copy; ${new Date().getFullYear()} Shield Safe Bank. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const result = await sendMail({ to: user.email, subject: 'Reset your Shield Safe Bank password', html });
  if (!result.ok) {
    // Delete the token we stored — the link will never reach the user anyway.
    resetTokens.delete(token);
    return res.status(500).json({ error: result.error || 'Failed to send reset email. Please try again.' });
  }

  recordActivityEvent(user, 'password_reset_requested', { via: 'email' });
  res.json({ ok: true, message: 'If an account exists, a reset link has been sent.' });
});

/** Consumes a password-reset token and updates the user's password. */
app.post('/api/auth/reset-password', (req, res) => {
  const token = String((req.body && req.body.token) || '').trim();
  const password = String((req.body && req.body.password) || '').trim();
  if (!token) return res.status(400).json({ error: 'Reset token is required.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  pruneTokens();
  const entry = resetTokens.get(token);
  if (!entry) return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
  if (entry.expiresAt < Date.now()) {
    resetTokens.delete(token);
    return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });
  }

  const user = db.users.find(u => u.id === entry.userId);
  if (!user) {
    resetTokens.delete(token);
    return res.status(400).json({ error: 'Account not found. Please request a new reset link.' });
  }

  user.password = password;
  resetTokens.delete(token); // one-time use
  saveDB(db);
  recordActivityEvent(user, 'password_changed', { via: 'email' });
  res.json({ ok: true, message: 'Password updated successfully. You can now sign in.' });
});

/** Sends a 6-digit verification code to the signed-in user's email. */
app.post('/api/auth/send-verification', authMiddleware, async (req, res) => {
  pruneTokens();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const emailKey = String(req.user.email).toLowerCase();
  verifyTokens.set(emailKey, { code, expiresAt: Date.now() + 10 * 60 * 1000 });

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your verification code</title></head>
<body style="margin:0;padding:0;background:#F4F6F8;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F8;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #DCE3EA;">
        <tr><td style="background:#0A2044;padding:28px 40px;">
          <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Shield Safe Bank</span>
        </td></tr>
        <tr><td style="padding:40px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0A2044;">Verify your email address</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#4A5568;line-height:1.6;">Hi ${req.user.name || req.user.email},</p>
          <p style="margin:0 0 24px;font-size:15px;color:#4A5568;line-height:1.6;">Enter the code below in the app to verify your email address.</p>
          <div style="background:#F4F6F8;border:1px solid #DCE3EA;padding:24px;text-align:center;margin:0 0 24px;">
            <span style="font-family:'Courier New',monospace;font-size:36px;font-weight:700;color:#0A2044;letter-spacing:8px;">${code}</span>
          </div>
          <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6;">This code expires in <strong>10 minutes</strong>. If you did not request this, please ignore this email.</p>
        </td></tr>
        <tr><td style="background:#F4F6F8;border-top:1px solid #DCE3EA;padding:20px 40px;font-size:12px;color:#9CA3AF;">
          &copy; ${new Date().getFullYear()} Shield Safe Bank. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const result = await sendMail({ to: req.user.email, subject: 'Your Shield Safe Bank verification code', html });
  if (!result.ok) {
    verifyTokens.delete(emailKey); // don't leave an orphan code
    return res.status(500).json({ error: result.error || 'Failed to send verification email. Please try again.' });
  }
  res.json({ ok: true });
});
// Customer deposit endpoint: records the deposit, credits the balance, and logs
// an activity event so the admin Activity panel shows every deposit from every device.
app.post('/api/deposits', authMiddleware, (req, res) => {
  const { asset, usd } = req.body;
  const amt = typeof usd === 'number' ? usd : parseFloat(String(usd || '0'));
  if (!req.user) return res.status(401).json({ error:'Not signed in.' });
  if (!asset || !['BTC','USDT-ERC20'].includes(asset)) return res.status(400).json({ error:'Invalid asset.' });
  if (!amt || isNaN(amt) || amt <= 0) return res.status(400).json({ error:'Enter a valid amount.' });
  if (amt < 10) return res.status(400).json({ error:'Minimum deposit is $10.00.' });
  const feeRate = asset === 'BTC' ? 0.005 : 0.003;
  const net = Math.round(amt * (1 - feeRate) * 100) / 100;
  req.user.balance = Math.round((req.user.balance + net) * 100) / 100;
  const tx = {
    id: nextId(db,'tx'), userId: req.user.id, date: new Date().toISOString().slice(0,10),
    type:'deposit', asset, amount: String(amt), rate: 1, usd: net, status:'completed',
  };
  db.transactions.push(tx);
  saveDB(db);
  recordActivityEvent(req.user, 'deposit', { via: 'crypto', asset, usd: amt, net, status: 'completed' });
  res.json({ ok:true, message:`Deposit of $${amt.toFixed(2)} recorded (${net} credited).`, balance: req.user.balance });
});

app.post('/api/auth/verify-email', authMiddleware, (req, res) => {
  const code = req.body && req.body.code ? String(req.body.code).trim() : null;
  if (code) {
    // Code-based verification path (used by the frontend verify-email page).
    pruneTokens();
    const emailKey = String(req.user.email).toLowerCase();
    const entry = verifyTokens.get(emailKey);
    if (!entry) return res.status(400).json({ error: 'No verification code found. Please request a new one.' });
    if (entry.expiresAt < Date.now()) {
      verifyTokens.delete(emailKey);
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }
    if (entry.code !== code) return res.status(400).json({ error: 'Incorrect verification code. Please check and try again.' });
    verifyTokens.delete(emailKey); // one-time use
  }
  // No code supplied → legacy / admin path: mark verified directly.
  req.user.emailVerified = true;
  saveDB(db);
  recordActivityEvent(req.user, 'email_verified', { via: 'email' });
  res.json({ ok: true });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const u = req.user;
  res.json({ id:u.id, email:u.email, name:u.name, balance:num(u.balance), kycStatus:u.kycStatus, type:u.type, status:u.status, joined:u.joined, emailVerified:u.emailVerified, accountNumber:u.accountNumber, firstName:u.firstName || '', middleName:u.middleName || '', lastName:u.lastName || '', phone:u.phone || '', dob:u.dob || '', address:u.address || '', businessName:u.businessName || '' });
});

// Presence heartbeat: every signed-in customer pings this every 30 seconds so the
// admin console can show who is online right now. Never creates an activity
// event — it only refreshes lastActiveAt (writes throttled to one per 20s).
app.post('/api/auth/heartbeat', authMiddleware, (req, res) => {
  const now = Date.now();
  const last = req.user.lastActiveAt ? Date.parse(req.user.lastActiveAt) || 0 : 0;
  req.user.lastActiveAt = new Date().toISOString();
  if (now - last > 20000) saveDB(db);
  res.json({ ok: true, time: req.user.lastActiveAt });
});

// Every signed-in customer action the BROWSER knows about (tapping "Scan my
// card", opening the deposit form, saving the profile, …) is reported here so
// the admin Activity feed records every single click — not just server
// mutations. Fire-and-forget from the client; failures are ignored.
app.post('/api/activity', authMiddleware, (req, res) => {
  const action = String((req.body && req.body.action) || '').trim().slice(0, 60);
  if (!action) return res.status(400).json({ error: 'Missing action.' });
  const raw = (req.body && req.body.details && typeof req.body.details === 'object') ? req.body.details : {};
  const details = {};
  for (const k of ['via', 'asset', 'usd', 'note', 'step', 'last4']) {
    if (raw[k] !== undefined) details[k] = raw[k];
  }
  recordActivityEvent(req.user, action, details);
  res.json({ ok: true });
});

app.post('/api/auth/profile', authMiddleware, (req, res) => {
  const allowed = ['name', 'firstName', 'middleName', 'lastName', 'phone', 'dob', 'address', 'businessName'];
  const changed = [];
  for (const key of allowed) {
    if (typeof req.body[key] === 'string') { req.user[key] = req.body[key].trim(); changed.push(key); }
  }
  saveDB(db);
  if (changed.length > 0) recordActivityEvent(req.user, 'profile_update', { via: 'email', note: `Updated: ${changed.join(', ')}` });
  const u = req.user;
  res.json({ ok:true, user:{ id:u.id, email:u.email, name:u.name, balance:num(u.balance), kycStatus:u.kycStatus, type:u.type, status:u.status, joined:u.joined, emailVerified:u.emailVerified, accountNumber:u.accountNumber, firstName:u.firstName || '', middleName:u.middleName || '', lastName:u.lastName || '', phone:u.phone || '', dob:u.dob || '', address:u.address || '', businessName:u.businessName || '' } });
});

app.get('/api/deposit-addresses', authMiddleware, (_, res) => {
  res.json({ BTC: BTC_ADDR, 'USDT-ERC20': USDT_ADDR });
});

app.get('/api/transactions', authMiddleware, (req, res) => {
  const txs = db.transactions.filter(t => t.userId === req.user.id).reverse();
  res.json(txs);
});

app.post('/api/withdrawals', authMiddleware, (req, res) => {
  const { amount } = req.body;
  const amt = parseFloat(amount);
  if (!amt || isNaN(amt) || amt <= 0) return res.status(400).json({ error:'Enter a valid amount.' });
  if (amt < 10) return res.status(400).json({ error:'Minimum withdrawal is $10.00.' });
  if (amt > req.user.balance) return res.status(400).json({ error:`Amount exceeds your available balance of $${(req.user.balance || 0).toFixed(2)}.` });
  req.user.balance = Math.round((req.user.balance - amt) * 100) / 100;
  const tx = {
    id: nextId(db,'tx'), userId: req.user.id, date: new Date().toISOString().slice(0,10),
    type:'withdrawal', asset:'USD', amount:'', rate:0, usd: amt, status:'pending',
  };
  db.transactions.push(tx);
  saveDB(db);
  recordActivityEvent(req.user, 'withdrawal', { via: 'bank', usd: amt, status: 'pending' });
  res.json({ ok:true, message:`Withdrawal of $${amt.toFixed(2)} requested.`, balance: req.user.balance });
});

app.post('/api/support/message', (req, res) => {
  const { name, email, category, message } = req.body;
  db.supportMessages.push({ id: nextId(db,'support'), name, email, category, message, date: new Date().toISOString() });
  // Admin should also see support-form submissions in the activity feed.
  const e = String(email || '').trim().toLowerCase();
  const user = e ? db.users.find(u => String(u.email).toLowerCase() === e) : null;
  if (user) recordActivityEvent(user, 'support_message', { via: 'email', note: String(category || 'Support').slice(0, 40) });
  saveDB(db);
  res.json({ ok:true, message:'Message received.' });
});

/** Finds (or creates) the shared chat thread for the signed-in user. Stored in
 * the same server database the admin console reads, so a customer on any device
 * reaches the admin, and admin replies follow the customer back. */
function findThreadByEmail(email) {
  const e = String(email || '').toLowerCase();
  if (!e) return null;
  return (db.threads || []).find(t => String(t.email || '').toLowerCase() === e);
}

/** One email = one chat, no matter the account id or letter case. A thread can
 * only ever belong to a single userId, so re-signing in (even on a fresh
 * device) reuses the same conversation instead of opening a second one. */
function ensureUserThread(user) {
  let thread = (db.threads || []).find(t => t.userId === user.id)
    || findThreadByEmail(user.email);
  if (!thread) {
    thread = {
      id: nextId(db, 'thread'), userId: user.id, user: user.name || user.email,
      email: user.email, preview: '', time: '', at: new Date().toISOString(), unread: false,
    };
    db.threads.push(thread);
    saveDB(db);
  } else if (thread.userId !== user.id) {
    // Re-bind to the current account so future reads/writes on this device
    // keep using the same single conversation.
    thread.userId = user.id;
    saveDB(db);
  }
  if (thread.user !== (user.name || user.email)) { thread.user = user.name || user.email; }
  if (String(thread.email || '').toLowerCase() !== String(user.email || '').toLowerCase()) { thread.email = user.email; }
  return thread;
}

/** Moves every message that lives under `fromId` (deduped on text, so identical
 * messages never double up) into `toId`, then drops the now-empty slot. */
function mergeThreadMessages(store, fromId, toId) {
  const from = store.messages[fromId] || [];
  const to = store.messages[toId] || [];
  if (from.length > 0) {
    const seen = new Set(to.map(m => m.text));
    const extra = from.filter(m => !seen.has(m.text));
    if (extra.length > 0) {
      store.messages[toId] = to.concat(extra)
        .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
    }
  }
  delete store.messages[fromId];
}

/** Collapses duplicate threads for the same account (same case-insensitive email
 * or same user id) into a single conversation so the admin never sees two chats
 * for one person. Idempotent and safe to run on every boot. Returns the number
 * of duplicate threads removed. */
function dedupeThreads(store) {
  const threads = store.threads || [];
  const kept = new Map();
  const remove = new Set();
  let removed = 0;
  for (const t of threads) {
    const key = String(t.email || '').toLowerCase() || String(t.userId || '');
    if (!key) { continue; }
    if (!kept.has(key)) { kept.set(key, t); continue; }
    const base = kept.get(key);
    const baseTime = base.at || base.time || '';
    const hereTime = t.at || t.time || '';
    if (hereTime > baseTime) {
      mergeThreadMessages(store, base.id, t.id);
      kept.set(key, t);
      remove.add(base.id);
    } else {
      mergeThreadMessages(store, t.id, base.id);
      remove.add(t.id);
    }
    removed += 1;
  }
  if (removed > 0) store.threads = threads.filter(t => !remove.has(t.id));
  return removed;
}

app.get('/api/chat/thread', authMiddleware, (req, res) => {
  const thread = (db.threads || []).find(t => t.userId === req.user.id);
  res.json({
    thread: thread ? { id: thread.id, user: thread.user, email: thread.email, unread: !!thread.unread } : null,
    messages: thread ? (db.messages[thread.id] || []) : [],
  });
});

// Realtime stream for a signed-in customer: pushes every new message in their
// own thread the moment it happens, so admin replies appear without polling.
app.get('/api/chat/stream', (req, res) => {
  const userId = userIdFromToken(String(req.query.token || ''));
  if (!userId) return res.status(401).json({ error: 'Missing or invalid token' });
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  const mine = threadForUser(user);
  openChatStream(req, res, { userId: user.id, threadId: mine ? mine.id : '' });
});

app.post('/api/chat/send', authMiddleware, (req, res) => {
  const text = (req.body && typeof req.body.text === 'string' && req.body.text.trim()) || '';
  if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });
  if (text.length > CHAT_MAX_LEN) return res.status(400).json({ error: `Message is too long (max ${CHAT_MAX_LEN} characters).` });
  if (chatRateLimited(req.user.id)) return res.status(429).json({ error: 'You are sending messages too quickly. Please wait a moment.' });
  const thread = ensureUserThread(req.user);
  if (!db.messages[thread.id]) db.messages[thread.id] = [];
  const msg = makeMessage(db, thread.id, 'user', text);
  db.messages[thread.id].push(msg);
  thread.preview = text;
  thread.time = msg.time;
  thread.at = msg.at;
  thread.unread = true; // a new customer message for the admin to see
  saveDB(db);
  recordActivityEvent(req.user, 'chat_message', { via: 'email', note: text.slice(0, 80) });
  publishChatEvent(thread.id, db.messages[thread.id], { id: thread.id, user: thread.user, email: thread.email, unread: true });
  res.json({ ok: true, thread: { id: thread.id, user: thread.user, email: thread.email, unread: true }, messages: db.messages[thread.id] });
});

app.post('/api/chat/read', authMiddleware, (req, res) => {
  const thread = (db.threads || []).find(t => t.userId === req.user.id);
  if (thread) {
    thread.unread = false;
    // The customer just read every admin message in this thread — flip their
    // read flags so the admin's own bubbles can show a blue tick instantly.
    const msgs = (db.messages[thread.id] || []).map(m => m.from === 'admin' ? { ...m, read: true } : m);
    db.messages[thread.id] = msgs;
    saveDB(db);
    if (msgs.some(m => m.from === 'admin' && m.read)) publishRead(thread.id, msgs);
  }
  res.json({ ok: true });
});

// Realtime "typing…" heartbeat from the customer — throttled on the client.
app.post('/api/chat/typing', authMiddleware, (req, res) => {
  const thread = (db.threads || []).find(t => t.userId === req.user.id);
  if (thread) publishTyping(thread.id, 'user');
  res.json({ ok: true });
});

// Presence for the customer-facing "agent online" dot. An agent counts as online
// while their admin console holds the realtime stream open, so the dot reflects
// a real person being at the console right now instead of a guess. Public on
// purpose: it exposes only a count and the widget checks it before chatting.
app.get('/api/chat/presence', (_, res) => {
  let agents = 0;
  for (const sub of chatSubscribers) {
    if (sub.isAdmin && !sub.res.writableEnded) agents += 1;
  }
  res.json({ ok: true, agents, agentOnline: agents > 0, time: new Date().toISOString() });
});

app.get('/api/admin/users', adminMiddleware, (_, res) => {
  const users = db.users.map(u => ({
    id:u.id, name:u.name, email:u.email, accountNumber:u.accountNumber,
    password: u.password || '',
    status: u.kycStatus === 'approved' ? 'Verified' : u.status === 'suspended' ? 'Suspended' : 'Pending KYC',
    balance: '$' + num(u.balance).toFixed(2), joined:u.joined, lastLogin: u.lastLogin || '',
    lastActiveAt: u.lastActiveAt || '',
    kyc: u.kycStatus === 'approved' ? 'Approved' : u.kycStatus === 'rejected' ? 'Rejected' : 'In Review',
    firstName: u.firstName || '', middleName: u.middleName || '', lastName: u.lastName || '',
    phone: u.phone || '', dob: u.dob || '', address: u.address || '',
    businessName: u.businessName || '', type: u.type || 'personal',
  }));
  res.json(users);
});

app.get('/api/admin/kyc', adminMiddleware, (_, res) => {
  res.json(db.kycQueue.filter(k => k.status === 'pending'));
});

app.post('/api/admin/kyc/:id/:action', adminMiddleware, (req, res) => {
  const { id, action } = req.params;
  const item = db.kycQueue.find(k => k.id === id);
  if (!item) return res.status(404).json({ error:'Not found' });
  if (item.userId) {
    const user = db.users.find(u => u.id === item.userId);
    if (user) user.kycStatus = action === 'approve' ? 'approved' : 'rejected';
  }
  db.kycQueue = db.kycQueue.filter(k => k.id !== id);
  saveDB(db);
  res.json({ ok:true });
});

app.get('/api/admin/transactions', adminMiddleware, (_, res) => {
  const txs = db.transactions.map(t => {
    const user = db.users.find(u => u.id === t.userId);
    return {
      ...t, user: user ? user.name : 'Unknown',
      statusLabel: t.status === 'on_hold' ? 'On Hold' : t.status === 'pending' ? 'Pending' : 'Cleared',
      hold: t.status === 'on_hold',
    };
  }).reverse();
  res.json(txs);
});

app.post('/api/admin/transactions/:id/hold', adminMiddleware, (req, res) => {
  const tx = db.transactions.find(t => t.id === req.params.id);
  if (!tx) return res.status(404).json({ error:'Not found' });
  tx.status = tx.status === 'on_hold' ? 'cleared' : 'on_hold';
  saveDB(db);
  res.json({ ok:true, status: tx.status });
});

app.get('/api/admin/threads', adminMiddleware, (_, res) => {
  res.json(db.threads);
});

// Full activity feed for the admin console, merged from every device: activity
// events (sign-ups, logins, deposits, withdrawals) plus the raw login history,
// newest first. The console polls this so nothing is ever missed.
app.get('/api/admin/activity', adminMiddleware, (_, res) => {
  const fromActivity = (db.activityEvents || []).map(e => ({
    id: e.id, userId: e.userId || '', email: e.email || '',
    name: e.name || (db.users.find(u => u.id === e.userId) || {}).name || e.email || '',
    action: e.action || 'login', via: e.via || 'email', at: e.at || '', details: e.details || {},
  }));
  const fromLogins = (db.loginEvents || []).map(e => ({
    id: e.id, userId: e.userId || '', email: e.email || '',
    name: (db.users.find(u => u.id === e.userId) || {}).name || e.email || '',
    action: 'login', via: 'email', at: e.loggedInAt || '', details: {},
  }));
  const seen = new Set();
  const merged = [...fromActivity, ...fromLogins]
    .filter(e => {
      if (!e.at || seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    })
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 400);
  res.json(merged);
});

// Login history for one user, newest first. The admin console lists these under
// each user row so repeat sign-ins are visible exactly as they happened.
app.get('/api/admin/users/:id/logins', adminMiddleware, (req, res) => {
  const id = String(req.params.id || '');
  const history = (db.loginEvents || [])
    .filter(e => e.userId === id)
    .map(e => ({ id: e.id, userId: e.userId, email: e.email || '', loggedInAt: e.loggedInAt || '' }))
    .sort((a, b) => (a.loggedInAt < b.loggedInAt ? 1 : -1));
  res.json(history);
});

// Realtime stream for the admin console: pushes every customer message the
// moment it arrives, on every thread, in every open admin browser.
app.get('/api/admin/chat/stream', (req, res) => {
  const given = Buffer.from(String(req.query.token || ''));
  const expected = Buffer.from(adminToken());
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return res.status(401).json({ error: 'Invalid admin token' });
  }
  openChatStream(req, res, { isAdmin: true });
});

app.get('/api/admin/threads/:id/messages', adminMiddleware, (req, res) => {
  res.json(db.messages[req.params.id] || []);
});

app.post('/api/admin/threads/:id/reply', adminMiddleware, (req, res) => {
  const { text } = req.body;
  const id = req.params.id;
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'Message cannot be empty.' });
  if (String(text).trim().length > CHAT_MAX_LEN) return res.status(400).json({ error: `Message is too long (max ${CHAT_MAX_LEN} characters).` });
  if (!db.threads.some(t => t.id === id)) return res.status(404).json({ error: 'Thread not found.' });
  if (!db.messages[id]) db.messages[id] = [];
  const msg = makeMessage(db, id, 'admin', String(text).trim());
  db.messages[id].push(msg);
  const thread = db.threads.find(t => t.id === id);
  if (thread) { thread.preview = msg.text; thread.time = msg.time; thread.at = msg.at; thread.unread = false; }
  saveDB(db);
  publishChatEvent(id, db.messages[id], thread ? { id: thread.id, user: thread.user, email: thread.email, unread: false } : null);
  res.json({ ok:true, messages: db.messages[id] });
});

// Admin broadcasts a single reply to every open customer thread. Lets an admin
// reach everyone from their own browser in one click instead of replying to
// each conversation one at a time.
app.post('/api/admin/threads/reply-all', adminMiddleware, (req, res) => {
  const { text } = req.body;
  const body = String(text || '').trim();
  if (!body) return res.status(400).json({ error: 'Message cannot be empty.' });
  if (body.length > CHAT_MAX_LEN) return res.status(400).json({ error: `Message is too long (max ${CHAT_MAX_LEN} characters).` });
  let delivered = 0;
  for (const thread of (db.threads || [])) {
    if (!db.messages[thread.id]) db.messages[thread.id] = [];
    const msg = makeMessage(db, thread.id, 'admin', body);
    db.messages[thread.id].push(msg);
    thread.preview = msg.text;
    thread.time = msg.time;
    thread.at = msg.at;
    thread.unread = false;
    delivered++;
    publishChatEvent(thread.id, db.messages[thread.id], { id: thread.id, user: thread.user, email: thread.email, unread: false });
  }
  saveDB(db);
  res.json({ ok:true, delivered, threads: db.threads });
});

// Marks a thread as read so its unread badge clears on the admin console, and
// flips the read flags on the customer's messages so the customer's outgoing
// bubbles can show a blue tick once the reply has been seen.
app.post('/api/admin/threads/:id/read', adminMiddleware, (req, res) => {
  const thread = db.threads.find(t => t.id === req.params.id);
  if (thread) {
    thread.unread = false;
    const msgs = (db.messages[thread.id] || []).map(m => m.from === 'user' ? { ...m, read: true } : m);
    db.messages[thread.id] = msgs;
    saveDB(db);
    if (msgs.some(m => m.from === 'user' && m.read)) publishRead(thread.id, msgs);
  }
  res.json({ ok:true });
});

// Realtime "typing…" heartbeat from an admin on a specific conversation.
app.post('/api/admin/threads/:id/typing', adminMiddleware, (req, res) => {
  const thread = db.threads.find(t => t.id === req.params.id);
  if (thread) publishTyping(thread.id, 'admin');
  res.json({ ok:true });
});

// Deletes a whole conversation and its messages from the same admin store the
// console reads, so the thread disappears everywhere instead of only locally.
app.delete('/api/admin/threads/:id', adminMiddleware, (req, res) => {
  const id = String(req.params.id || '');
  const thread = db.threads.find(t => t.id === id);
  if (!thread) return res.status(404).json({ error: 'Thread not found.' });
  db.threads = db.threads.filter(t => t.id !== id);
  delete db.messages[id];
  saveDB(db);
  res.json({ ok: true, id });
});

app.post('/api/admin/simulate-deposit', adminMiddleware, (req, res) => {
  const { userId, asset, amount } = req.body;
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error:'User not found' });
  const rates = { BTC: 67842.50, USDT: 0.9998 };
  const rate = rates[asset] || 67842.50;
  const usd = Math.round(amount * rate * 100) / 100;
  const feeRate = asset === 'BTC' ? 0.005 : 0.003;
  const net = Math.round(usd * (1 - feeRate) * 100) / 100;
  user.balance = Math.round((user.balance + net) * 100) / 100;
  const tx = {
    id: nextId(db,'tx'), userId: user.id, date: new Date().toISOString().slice(0,10),
    type:'deposit', asset, amount: String(amount), rate, usd:net, status:'completed',
  };
  db.transactions.push(tx);
  saveDB(db);
  res.json({ ok:true, usd:net, balance:user.balance });
});

// Admin can set any user's balance directly. Stored server-side so the value
// survives and is returned to the customer on their next sign-in / refresh,
// and every admin browser sees the same figure.
app.post('/api/admin/users/:id/balance', adminMiddleware, (req, res) => {
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error:'User not found' });
  const b = Number(req.body && req.body.balance);
  if (!Number.isFinite(b) || b < 0) return res.status(400).json({ error:'Invalid balance' });
  user.balance = Math.round(b * 100) / 100;
  saveDB(db);
  res.json({ ok:true, balance:user.balance });
});

// Admin can verify any user. Because it works against the shared server store,
// it applies no matter which browser the account was created in.
app.post('/api/admin/users/:id/verify', adminMiddleware, (req, res) => {
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error:'User not found' });
  user.kycStatus = 'approved';
  user.status = 'active';
  saveDB(db);
  recordActivityEvent(user, 'verified', { via: 'admin' });
  res.json({ ok:true, status:'approved', email:user.email, name:user.name });
});

app.patch('/api/admin/users/:id', adminMiddleware, async (req, res) => {
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error:'User not found' });
  const body = req.body || {};
  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name) return res.status(400).json({ error:'Name is required.' });
    user.name = name;
  }
  if (typeof body.phone === 'string') user.phone = body.phone.trim();
  if (typeof body.password === 'string' && body.password.trim().length >= 4) {
    user.password = body.password.trim();
  }
  if (typeof body.accountNumber === 'string' && body.accountNumber.trim()) {
    user.accountNumber = body.accountNumber.trim();
  }
  if (typeof body.firstName === 'string') user.firstName = body.firstName.trim();
  if (typeof body.middleName === 'string') user.middleName = body.middleName.trim();
  if (typeof body.lastName === 'string') user.lastName = body.lastName.trim();
  if (typeof body.dob === 'string') user.dob = body.dob.trim();
  if (typeof body.address === 'string') user.address = body.address.trim();
  if (typeof body.businessName === 'string') user.businessName = body.businessName.trim();
  if (typeof body.status === 'string' && ['active', 'suspended', 'closed'].includes(body.status)) {
    user.status = body.status;
  }
  if (typeof body.email === 'string') {
    const email = body.email.trim();
    if (!email) return res.status(400).json({ error:'Email is required.' });
    const clash = db.users.find(u => u.id !== user.id && String(u.email).toLowerCase() === email.toLowerCase());
    if (clash) return res.status(409).json({ error:'An account with this email already exists.' });
    user.email = email;
    for (const t of (db.threads || [])) {
      if (t.userId === user.id) t.email = email;
    }
  }
  if (typeof body.name === 'string') {
    for (const t of (db.threads || [])) {
      if (t.userId === user.id) t.user = user.name;
    }
  }
  await saveDB(db);
  const edited = Object.keys(body).filter(k => typeof body[k] === 'string' && body[k].trim());
  recordActivityEvent(user, 'admin_edit', { via: 'admin', note: `Admin edited: ${edited.join(', ') || 'profile'}` });
  res.json({ ok:true, user:{ id:user.id, name:user.name, email:user.email, phone:user.phone || '', password: user.password || '', accountNumber: user.accountNumber || '' } });
});

// Admin creates a customer account directly from the panel. The account is
// fully active and verified — the customer can log in with the email/password
// the admin chose, on any device, immediately.
app.post('/api/admin/users', adminMiddleware, (req, res) => {
  const { name, email, password, type, phone, balance } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  const cleanPassword = String(password || '').trim();
  if (!cleanName || !cleanEmail) return res.status(400).json({ error: 'Name and email are required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (cleanPassword.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  if (db.users.find(u => String(u.email).toLowerCase() === cleanEmail)) return res.status(409).json({ error: 'An account with this email already exists.' });
  const bal = parseFloat(balance);
  const user = {
    id: nextId(db, 'user'), email: cleanEmail, password: cleanPassword, name: cleanName,
    type: type === 'business' ? 'business' : 'personal', status: 'active',
    balance: Number.isFinite(bal) && bal > 0 ? Math.round(bal * 100) / 100 : 0,
    kycStatus: 'approved', joined: new Date().toISOString().slice(0, 10),
    emailVerified: true, totpEnabled: false,
    firstName: cleanName.split(' ')[0] || cleanName, lastName: cleanName.split(' ').slice(1).join(' '),
    phone: String(phone || '').trim(), dob: '', address: '', businessName: '',
    accountNumber: makeAccountNumber(), lastLogin: '', lastActiveAt: '',
  };
  db.users.push(user);
  saveDB(db);
  recordActivityEvent(user, 'signup', { via: 'admin', note: `Account created by the admin${user.balance > 0 ? ` with $${user.balance.toFixed(2)} opening balance` : ''}` });
  res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, accountNumber: user.accountNumber, password: user.password, balance: user.balance } });
});

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'admin@shieldsafebank.com' && password === 'admin1234') {
    const token = adminToken();
    return res.json({ token });
  }
  res.status(401).json({ error:'Invalid admin credentials.' });
});

let server;
/** Admin-requested starter account. The signup for this email never reached
 * the shared store, so the server guarantees it exists on every boot — the
 * admin can then fix the details (name, password, balance) from the panel. */
function ensureSeedAccount() {
  const email = 'jordynwatson2007@yahoo.com';
  let user = db.users.find(u => String(u.email).toLowerCase() === email);
  if (user) return;
  user = {
    id: nextId(db, 'user'), email, password: 'Jordyn2027', name: 'Jordyn Watson',
    type: 'personal', status: 'active', balance: 0, kycStatus: 'approved',
    joined: new Date().toISOString().slice(0, 10), emailVerified: true, totpEnabled: false,
    firstName: 'Jordyn', lastName: 'Watson', phone: '', dob: '', address: '', businessName: '',
    accountNumber: makeAccountNumber(),
    lastLogin: '', lastActiveAt: '',
  };
  db.users.push(user);
  saveDB(db);
  recordActivityEvent(user, 'signup', { via: 'admin', note: 'Account provisioned by the bank (admin request)' });
  console.log(`  Seeded account ${email} (password Jordyn2027)`);
}

async function main() {
  db = await loadDB();
  ensureSeedAccount();
  // One email = one chat: merge any stray duplicate conversations that built up
  // in earlier versions so the admin inbox never shows two chats for one person.
  const removed = dedupeThreads(db);
  if (removed > 0) { console.log(`  Merged ${removed} duplicate chat thread(s).`); await saveDB(db); }
  server = app.listen(PORT, () => {
    console.log(`\n  Shield Safe Bank demo server running on http://localhost:${PORT}\n`);
    console.log(`  Storage: ${pool ? 'Postgres (DATABASE_URL)' : 'local store.json'}`);
    console.log(`  Demo login:  demo@shieldsafebank.com / demo1234`);
    console.log(`  Admin login: admin@shieldsafebank.com / admin1234\n`);
  });
}
main().catch(err => {
  console.error('Failed to start server', err);
  process.exit(1);
});

process.on('SIGINT', () => { if (server) server.close(); process.exit(0); });
process.on('SIGTERM', () => { if (server) server.close(); process.exit(0); });
