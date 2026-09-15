import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_PATH = join(__dirname, 'data', 'store.json');
const PORT = process.env.PORT || 4000;

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
  counters: { user:7, tx:1092, thread:3, kyc:3, support:1 },
};

function loadDB() {
  if (!existsSync(DATA_PATH)) {
    const seed = normalizeDB(SEED);
    writeFileSync(DATA_PATH, JSON.stringify(seed, null, 2));
    return seed;
  }
  const store = normalizeDB(JSON.parse(readFileSync(DATA_PATH, 'utf-8')));
  // Persist the normalised store so generated account numbers stay stable.
  writeFileSync(DATA_PATH, JSON.stringify(store, null, 2));
  return store;
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
    u.emailVerified = !!u.emailVerified;
    u.totpEnabled = !!u.totpEnabled;
    u.accountNumber = makeAccountNumber(u.accountNumber);
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
    store.messages[id] = Array.isArray(store.messages[id]) ? store.messages[id].map(m => ({ ...m, time: m.time || '', at: m.at || '' })) : [];
  });
  store.supportMessages = Array.isArray(store.supportMessages) ? store.supportMessages : [];
  store.counters = store.counters && typeof store.counters === 'object' ? store.counters : {};
  return store;
}

function saveDB(db) {
  writeFileSync(DATA_PATH, JSON.stringify(db, null, 2));
}

function newToken() {
  return randomBytes(32).toString('hex');
}

function nextId(db, type) {
  db.counters[type] = (db.counters[type] || 0) + 1;
  const prefixes = { user:'U', tx:'T', thread:'C', kyc:'K', support:'S' };
  return `${prefixes[type] || type.toUpperCase()}${String(db.counters[type]).padStart(4,'0')}`;
}

const app = express();
app.use(cors());
app.use(express.json());

let db = loadDB();
const tokens = new Map();
const adminTokens = new Map();

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error:'Missing token' });
  const userId = tokens.get(header.slice(7));
  if (!userId) return res.status(401).json({ error:'Invalid token' });
  req.user = db.users.find(u => u.id === userId);
  if (!req.user) return res.status(401).json({ error:'User not found' });
  next();
}

function adminMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error:'Missing token' });
  if (!adminTokens.has(header.slice(7))) return res.status(401).json({ error:'Invalid admin token' });
  next();
}

app.get('/api/health', (_, res) => res.json({ ok:true, ts: Date.now() }));
app.get('/api/rates', (_, res) => res.json({ BTC: 67842.50, USDT: 0.9998 }));

app.post('/api/auth/register', (req, res) => {
  const { email, password, name, type, businessName } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error:'Email, password, and name are required.' });
  if (db.users.find(u => u.email === email)) return res.status(409).json({ error:'An account with this email already exists.' });
  const user = {
    id: nextId(db,'user'), email, password, name, type: type || 'personal',
    status:'active', balance:0, kycStatus:'pending', joined: new Date().toISOString().slice(0,10),
    emailVerified:false, totpEnabled:false, businessName: businessName || '',
    accountNumber: makeAccountNumber(),
    lastLogin: new Date().toISOString(),
  };
  db.users.push(user);
  saveDB(db);
  const token = newToken();
  tokens.set(token, user.id);
  res.json({ token, user:{ id:user.id, email:user.email, name:user.name, balance:user.balance, kycStatus:user.kycStatus, type:user.type, accountNumber:user.accountNumber } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error:'Email and password are required.' });
  const user = db.users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error:'Invalid credentials.' });
  if (user.password !== password) return res.status(401).json({ error:'Invalid credentials.' });
  if (user.status === 'suspended') return res.status(403).json({ error:'Account is suspended.' });
  const token = newToken();
  tokens.set(token, user.id);
  user.lastLogin = new Date().toISOString();
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
    };
    db.users.push(user);
    saveDB(db);
  } else {
    user.lastLogin = new Date().toISOString();
    saveDB(db);
  }
  const token = newToken();
  tokens.set(token, user.id);
  res.json({ token, user:{ id:user.id, email:user.email, name:user.name, balance:user.balance, kycStatus:user.kycStatus, type:user.type, accountNumber:user.accountNumber } });
});

app.post('/api/auth/forgot-password', (_, res) => {
  res.json({ ok:true, message:'If an account exists, a reset link has been sent.' });
});

app.post('/api/auth/verify-email', authMiddleware, (req, res) => {
  req.user.emailVerified = true;
  saveDB(db);
  res.json({ ok:true });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const u = req.user;
  res.json({ id:u.id, email:u.email, name:u.name, balance:num(u.balance), kycStatus:u.kycStatus, type:u.type, status:u.status, joined:u.joined, emailVerified:u.emailVerified, accountNumber:u.accountNumber });
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
  if (amt > req.user.balance) return res.status(400).json({ error:`Amount exceeds your available balance of $${req.user.balance.toFixed(2)}.` });
  req.user.balance = Math.round((req.user.balance - amt) * 100) / 100;
  const tx = {
    id: nextId(db,'tx'), userId: req.user.id, date: new Date().toISOString().slice(0,10),
    type:'withdrawal', asset:'USD', amount:'', rate:0, usd: amt, status:'pending',
  };
  db.transactions.push(tx);
  saveDB(db);
  res.json({ ok:true, message:`Withdrawal of $${amt.toFixed(2)} requested.`, balance: req.user.balance });
});

app.post('/api/support/message', (req, res) => {
  const { name, email, category, message } = req.body;
  db.supportMessages.push({ id: nextId(db,'support'), name, email, category, message, date: new Date().toISOString() });
  saveDB(db);
  res.json({ ok:true, message:'Message received.' });
});

/** Finds (or creates) the shared chat thread for the signed-in user. Stored in
 * the same server database the admin console reads, so a customer on any device
 * reaches the admin, and admin replies follow the customer back. */
function ensureUserThread(user) {
  let thread = (db.threads || []).find(t => t.userId === user.id);
  if (!thread) {
    thread = {
      id: nextId(db, 'thread'), userId: user.id, user: user.name || user.email,
      email: user.email, preview: '', time: '', at: new Date().toISOString(), unread: false,
    };
    db.threads.push(thread);
  }
  return thread;
}

app.get('/api/chat/thread', authMiddleware, (req, res) => {
  const thread = (db.threads || []).find(t => t.userId === req.user.id);
  res.json({
    thread: thread ? { id: thread.id, user: thread.user, email: thread.email, unread: !!thread.unread } : null,
    messages: thread ? (db.messages[thread.id] || []) : [],
  });
});

app.post('/api/chat/send', authMiddleware, (req, res) => {
  const text = (req.body && typeof req.body.text === 'string' && req.body.text.trim()) || '';
  if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });
  const thread = ensureUserThread(req.user);
  if (!db.messages[thread.id]) db.messages[thread.id] = [];
  const at = new Date().toISOString();
  const msg = { from: 'user', text, time: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }), at };
  db.messages[thread.id].push(msg);
  thread.preview = text;
  thread.time = msg.time;
  thread.at = at;
  thread.unread = true; // a new customer message for the admin to see
  saveDB(db);
  res.json({ ok: true, thread: { id: thread.id, user: thread.user, email: thread.email, unread: true }, messages: db.messages[thread.id] });
});

app.post('/api/chat/read', authMiddleware, (req, res) => {
  const thread = (db.threads || []).find(t => t.userId === req.user.id);
  if (thread) { thread.unread = false; saveDB(db); }
  res.json({ ok: true });
});

app.get('/api/admin/users', adminMiddleware, (_, res) => {
  const users = db.users.map(u => ({
    id:u.id, name:u.name, email:u.email, accountNumber:u.accountNumber,
    status: u.kycStatus === 'approved' ? 'Verified' : u.status === 'suspended' ? 'Suspended' : 'Pending KYC',
    balance: '$' + num(u.balance).toFixed(2), joined:u.joined, lastLogin: u.lastLogin || '',
    kyc: u.kycStatus === 'approved' ? 'Approved' : u.kycStatus === 'rejected' ? 'Rejected' : 'In Review',
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

app.get('/api/admin/threads/:id/messages', adminMiddleware, (req, res) => {
  res.json(db.messages[req.params.id] || []);
});

app.post('/api/admin/threads/:id/reply', adminMiddleware, (req, res) => {
  const { text } = req.body;
  const id = req.params.id;
  if (!db.messages[id]) db.messages[id] = [];
  const at = new Date().toISOString();
  const time = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  db.messages[id].push({ from:'admin', text, time, at });
  const thread = db.threads.find(t => t.id === id);
  if (thread) { thread.preview = text; thread.time = time; thread.at = at; thread.unread = false; }
  saveDB(db);
  res.json({ ok:true, messages: db.messages[id] });
});

// Marks a thread as read so its unread badge clears on the admin console.
app.post('/api/admin/threads/:id/read', adminMiddleware, (req, res) => {
  const thread = db.threads.find(t => t.id === req.params.id);
  if (thread) { thread.unread = false; saveDB(db); }
  res.json({ ok:true });
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
// survives and is returned to the customer on their next sign-in / refresh.
app.post('/api/admin/users/:id/balance', adminMiddleware, (req, res) => {
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error:'User not found' });
  const b = Number(req.body && req.body.balance);
  if (!Number.isFinite(b) || b < 0) return res.status(400).json({ error:'Invalid balance' });
  user.balance = Math.round(b * 100) / 100;
  saveDB(db);
  res.json({ ok:true, balance:user.balance });
});

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'admin@shieldsafebank.com' && password === 'admin1234') {
    const token = newToken();
    adminTokens.set(token, true);
    return res.json({ token });
  }
  res.status(401).json({ error:'Invalid admin credentials.' });
});

const server = app.listen(PORT, () => {
  console.log(`\n  Shield Safe Bank demo server running on http://localhost:${PORT}\n`);
  console.log(`  Demo login:  demo@shieldsafebank.com / demo1234`);
  console.log(`  Admin login: admin@shieldsafebank.com / admin1234\n`);
});

process.on('SIGINT', () => { server.close(); process.exit(0); });
process.on('SIGTERM', () => { server.close(); process.exit(0); });
