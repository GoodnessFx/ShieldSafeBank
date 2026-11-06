// Create the four requested accounts on the local backend, set their balances,
// verify each balance via the admin list, then run a two-account chat test
// (Holly + Sandra). Local legacy mode only — never touches production/Supabase.
import { createHmac } from 'node:crypto';

const BASE = 'http://localhost:4000/api';
const SECRET = 'ssb-dev-secret';
const adminToken = createHmac('sha256', SECRET).update('admin').digest('hex');
const PASS = 'ShieldSafe#2026';

const users = [
  { email: 'Combsholly88@gmail.com', name: 'Holly Combs', balance: 9000 },
  { email: 'sandim2011@gmail.com', name: 'Sandra Magallanes', balance: 60000 },
  { email: 'melimari88@gmail.com', name: 'Meli Mari', balance: 10000 },
  { email: 'Loosegun@proton.me', name: 'Loosegun', balance: 980000 },
].map(u => ({ ...u, loginEmail: u.email.toLowerCase() }));

async function req(path, { method = 'GET', token, body } = {}) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let d = null; try { d = await r.json(); } catch { /* non-json */ }
  return { status: r.status, data: d };
}
let fail = 0;
const check = (l, o, d = '') => { console.log(`${o ? 'PASS' : 'FAIL'}: ${l}${d ? ' — ' + String(d).slice(0, 140) : ''}`); if (!o) fail++; };

async function main() {
  let up = false;
  for (let i = 0; i < 30; i++) { try { const r = await fetch(`${BASE}/health`); if (r.ok) { up = true; break; } } catch { /* not yet */ } await new Promise(r => setTimeout(r, 500)); }
  check('server health', up);
  if (!up) { console.log('RESULT: FAIL (server not up)'); process.exit(1); }

  // Create each account (admin create sets the opening balance and lowercases the email).
  for (const u of users) {
    const cr = await req('/admin/users', { method: 'POST', token: adminToken, body: { name: u.name, email: u.email, password: PASS, type: 'personal', phone: '', balance: u.balance } });
    let id = cr.data?.user?.id;
    if (!id && cr.data?.error && /already exists/i.test(cr.data.error)) {
      const list = await req('/admin/users', { token: adminToken });
      id = (list.data || []).find(x => String(x.email).toLowerCase() === u.loginEmail)?.id;
      if (id) await req(`/admin/users/${id}/balance`, { method: 'POST', token: adminToken, body: { balance: u.balance } });
    }
    u.id = id;
    check(`create ${u.name} ($${u.balance})`, !!id, JSON.stringify(cr.data).slice(0, 120));
  }

  // Verify balances through the admin users list.
  const list = await req('/admin/users', { token: adminToken });
  for (const u of users) {
    const row = (list.data || []).find(x => String(x.email).toLowerCase() === u.loginEmail);
    check(`verify ${u.name} balance $${u.balance}`, !!row && String(row.balance).replace(/[^0-9.]/g, '').includes(String(u.balance)), `${u.loginEmail} -> ${row?.balance}`);
  }

  // Two-account chat test: Holly + Sandra.
  const a = users[0], b = users[1];
  async function login(em) { const r = await req('/auth/login', { method: 'POST', body: { email: em, password: PASS } }); return r.data?.token || ''; }
  const ta = await login(a.loginEmail), tb = await login(b.loginEmail);
  check('Holly login', !!ta);
  check('Sandra login', !!tb);
  const sa = await req('/chat/send', { method: 'POST', token: ta, body: { text: 'Hi from Holly' } });
  const threadA = sa.data?.thread?.id;
  const sb = await req('/chat/send', { method: 'POST', token: tb, body: { text: 'Hi from Sandra' } });
  const threadB = sb.data?.thread?.id;
  check('Holly sends message', sa.status === 200 && sa.data?.ok);
  check('Sandra sends message', sb.status === 200 && sb.data?.ok);
  const tr = await req('/admin/threads', { token: adminToken });
  check('admin sees Holly thread', !!(tr.data || []).find(t => t.id === threadA));
  check('admin sees Sandra thread', !!(tr.data || []).find(t => t.id === threadB));
  const ra = await req(`/admin/threads/${threadA}/reply`, { method: 'POST', token: adminToken, body: { text: 'Admin reply to Holly' } });
  const rb = await req(`/admin/threads/${threadB}/reply`, { method: 'POST', token: adminToken, body: { text: 'Admin reply to Sandra' } });
  check('admin replies to Holly', ra.status === 200 && ra.data?.ok);
  check('admin replies to Sandra', rb.status === 200 && rb.data?.ok);
  async function verify(tok, own, rep, label) {
    const r = await req('/chat/thread', { token: tok });
    const m = r.data?.messages || [];
    check(`${label} sees own message`, m.some(x => x.from === 'user' && x.text.includes(own)));
    check(`${label} sees admin reply`, m.some(x => x.from === 'admin' && x.text.includes(rep)));
  }
  await verify(ta, 'Hi from Holly', 'Admin reply to Holly', 'Holly');
  await verify(tb, 'Hi from Sandra', 'Admin reply to Sandra', 'Sandra');

  console.log('\n=== ACCOUNTS (log in with the lowercase email) ===');
  for (const u of users) console.log(`${u.loginEmail} | ${u.name} | balance $${u.balance} | password: ${PASS}`);
  console.log(`\nRESULT: ${fail === 0 ? 'PASS' : 'FAIL'} (${fail} failure(s))`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error('TEST ERROR', e); process.exit(1); });
