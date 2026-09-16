import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { getUsers, getActivity, getThreads, getThreadMessages, pushChatMessage, markThreadRead, markLocalUserVerified, getKycQueue, updateUserBalance, type ChatMessage, type StoreUser, type ActivityEvent, type KycItem } from '../../lib/localStore';
import { decideKyc, getAdminKyc, getAdminUsers, setAdminUserBalance, patchAdminUser, getAdminThreads, getAdminMessages, replyThread, replyToAll, markAdminThreadRead, adminLogout, hasAdminToken, verifyAdminUser, pingAdminServer, adminAuthExpired, getAdminToken, sendAdminTyping } from '../../lib/api';
import { subscribeToChat, closeChatStream, type ChatEvent } from '../../lib/chatTransport';
import { fmtDateTime } from '../../lib/format';
import { DEPOSIT_ADDRESSES, BTC_NETWORK, USDT_NETWORK } from '../../lib/config';
import BrandMark from '../../components/BrandMark';

type Tab = 'chat' | 'users' | 'activity' | 'deposits';

/** A row shown in the admin Users tab. Local accounts carry a full record; a
 * user that only exists on the server side is merged in so the admin never
 * misses anyone who has signed up. `serverId` links a row to its server record. */
type AdminUserRow = StoreUser & { serverId?: string };

/** A conversation row in the admin Chat Inbox. `at` is the ISO timestamp of the
 * last message so we can show send/read times and render a red unread badge. */
type AdminThread = {
  id: string;
  user: string;
  email: string;
  preview: string;
  time: string;
  at: string;
  unread: boolean;
};

function fmtShortTime(at?: string): string {
  if (!at) return '';
  const d = new Date(at);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return hm;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function parseServerBalance(value: string): number {
  const n = parseFloat(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Quick-pick emojis for the admin composer — typing them directly works too. */
const CHAT_EMOJIS = ['😀','😊','😂','🥰','😍','😎','😌','😅','🤣','👍','👏','👋','👌','🫶','💯','✅','🔥','🎉','❤️','💰','🏦','📲','⏰','🙋'];

/** Three animated dots shown while the customer is typing. */
function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }} aria-label="typing">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </span>
  );
}

/** WhatsApp-style read receipt: one grey tick (sent) — blue double-tick (read).
 * `onDark` renders a lighter variant for use inside a blue bubble. */
function ReadTicks({ read, onDark }: { read?: boolean; onDark?: boolean }) {
  const color = read ? (onDark ? '#BDE0FF' : '#0A84FF') : (onDark ? '#D6E4F5' : '#A2AAB5');
  return (
    <svg width="15" height="11" viewBox="0 0 18 12" fill="none" aria-label={read ? 'Read' : 'Sent'} role="img" style={{ flexShrink: 0 }}>
      <path d="M1 6.2 4.4 9.6 12 2" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {read && <path d="M7 9.8 7.9 10.7 16.8 2" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />}
    </svg>
  );
}

export default function AdminConsole() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('chat');
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [threads, setThreads] = useState<AdminThread[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [kycQueue, setKycQueue] = useState<KycItem[]>([]);
  const [verifying, setVerifying] = useState<string>('');
  const [verifyNotice, setVerifyNotice] = useState('');
  const [copied, setCopied] = useState<string>('');
  const [editingBalance, setEditingBalance] = useState<string | null>(null);
  const [balanceInput, setBalanceInput] = useState('');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingUser, setSavingUser] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [serverOnline, setServerOnline] = useState(true);
  const [authStale, setAuthStale] = useState(false);
  const [syncNow, setSyncNow] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastInput, setBroadcastInput] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  // threadId -> true while that customer is currently typing.
  const [typingMap, setTypingMap] = useState<Record<string, boolean>>({});
  const typingSentAtRef = useRef(0);

  // If the shared server is reachable but the stored admin token is stale, the
  // banner says RE-LOGIN (green fix: one click), never OFFLINE. Render free
  // tier sleeps itself; the first probe each sitting is slow, so retry twice
  // with patience instead of condemning the whole panel instantly.
  async function checkServerLiveness(): Promise<{ online: boolean; auth: boolean }> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const probe = await pingAdminServer(attempt === 0 ? 12000 : 20000);
      if (probe.online) {
        setServerOnline(true);
        setAuthStale(false);
        return { online: true, auth: false };
      }
      if (probe.reason === 'auth' || probe.reason === 'no-session' || adminAuthExpired()) {
        setServerOnline(false);
        setAuthStale(true);
        return { online: false, auth: true };
      }
      if (attempt < 2) await new Promise(res => setTimeout(res, 4000));
    }
    setServerOnline(false);
    setAuthStale(adminAuthExpired());
    return { online: false, auth: adminAuthExpired() };
  }

  async function reload() {
    // Everyone who has signed up locally, combined with anyone stored on the
    // server. Local accounts win on a matching email; server accounts are the
    // only ones with a serverId so an admin edit can also apply server-side.
    const local = getUsers();
    let remote: AdminUserRow[] = [];
    const signedIn = hasAdminToken();
    let live = await checkServerLiveness();
    try {
      // Reading admin data needs a token; without one these calls can only 401.
      const sr = signedIn ? await getAdminUsers() : { ok: false, offline: false, data: null };
      if (sr.ok) live = { online: true, auth: false };
      if (sr.ok && sr.data) {
        remote = sr.data.map(m => ({
          email: m.email,
          name: m.name,
          joined: m.joined || '',
          lastLogin: m.lastLogin || '',
          status: m.kyc === 'Approved' || m.status === 'Verified' ? 'verified' : 'pending',
          balance: parseServerBalance(m.balance),
          accountNumber: m.accountNumber || '',
          serverId: m.id,
          firstName: m.firstName || '',
          middleName: m.middleName || '',
          lastName: m.lastName || '',
          phone: m.phone || '',
          dob: m.dob || '',
          address: m.address || '',
          businessName: m.businessName || '',
          type: m.type || 'personal',
        }));
      }
    } catch {
      remote = [];
    }
    // Liveness wins; if it was online but getAdminUsers died, treat as auth
    // (server answered, token did not). If data actually landed, stay green.
    setServerOnline(live.online);
    setAuthStale(!live.online && (live.auth || adminAuthExpired()));
    // Refuse to paint the local-thread fallback while unauthenticated: it is
    // what makes a perfectly-healthy admin panel look like a dead one.
    const byEmail = new Map<string, AdminUserRow>();
    for (const r of remote) byEmail.set(r.email.toLowerCase(), r);
    for (const l of local) {
      const key = l.email.toLowerCase();
      const ex = byEmail.get(key);
      byEmail.set(key, ex && ex.serverId ? { ...l, serverId: ex.serverId } : l);
    }
    setUsers(Array.from(byEmail.values()));

    setActivity(getActivity());
    setKycQueue(getKycQueue());
    const threadsNow = await loadThreads();
    if (activeThread) {
      setMessages(await loadMessages(activeThread));
      markThreadRead(activeThread);
    } else if (threadsNow.length > 0) {
      const first = threadsNow[0].id;
      setActiveThread(first);
      setMessages(await loadMessages(first));
    }
  }

  // Conversations come from the shared server so chats from any device reach the
  // admin; if the server is offline we fall back to the browser's local copy.
  async function loadThreads(): Promise<AdminThread[]> {
    const localThreads = getThreads();
    let serverThreads: AdminThread[] = [];
    try {
      const tr = hasAdminToken() ? await getAdminThreads() : { ok: false, offline: false, data: null };
      if (tr.ok && tr.data) {
        serverThreads = tr.data.map(t => ({
          id: t.id,
          user: t.user,
          email: t.email || '',
          preview: t.preview || '',
          time: t.time || '',
          at: t.at || '',
          unread: !!t.unread,
        }));
      }
    } catch {
      serverThreads = [];
    }
    const byId = new Map<string, AdminThread>();
    for (const s of serverThreads) byId.set(s.id, s);
    for (const l of localThreads) {
      if (!byId.has(l.id)) byId.set(l.id, { id: l.id, user: l.user, email: l.email, preview: l.preview, time: l.time, at: l.at, unread: !!l.unread });
    }
    // One person = one chat: collapse any rows that share an email (e.g. a local
    // fallback copy plus the server copy), keeping the most recently active one.
    const deduped = new Map<string, AdminThread>();
    for (const t of Array.from(byId.values())) {
      const key = (t.email || '').toLowerCase() || t.id;
      const existing = deduped.get(key);
      if (!existing || String(t.at || '') > String(existing.at || '')) deduped.set(key, t);
    }
    const merged = Array.from(deduped.values()).sort((a, b) => (a.at || '') < (b.at || '') ? 1 : (a.at || '') > (b.at || '') ? -1 : 0);
    setThreads(merged);
    setUnreadCount(merged.filter(t => t.unread).length);
    return merged;
  }

  async function loadMessages(id: string): Promise<ChatMessage[]> {
    try {
      const r = await getAdminMessages(id);
      if (r.ok && r.data) return r.data;
    } catch { /* fall back below */ }
    return getThreadMessages(id);
  }

  async function selectThread(id: string) {
    setActiveThread(id);
    setMessages(await loadMessages(id));
    markAdminThreadRead(id).catch(() => null);
    markThreadRead(id);
    await loadThreads();
  }

  async function sendReply() {
    const text = chatInput.trim();
    if (!text || !activeThread) return;
    setEmojiOpen(false);
    const id = activeThread;
    const thread = threads.find(t => t.id === id) || getThreads().find(t => t.id === id);
    const stamp = new Date().toISOString();
    setChatInput('');
    // WhatsApp habit: your reply appears immediately, then the server copy replaces it.
    setMessages(prev => [...prev, { id: `admin${Date.now()}`, from: 'admin', text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), at: stamp }]);
    await replyThread(id, text);
    pushChatMessage(id, thread ? thread.user : 'Customer', thread ? thread.email : '', text, 'admin');
    markThreadRead(id);
    setMessages(await loadMessages(id));
    await loadThreads();
  }

  /** Throttled "typing…" heartbeat so the customer sees you're typing in realtime. */
  function handleChatInput(value: string) {
    setChatInput(value);
    if (!value.trim() || !activeThread) return;
    const now = Date.now();
    if (now - typingSentAtRef.current > 1500) {
      typingSentAtRef.current = now;
      sendAdminTyping(activeThread).catch(() => null);
    }
  }

  async function sendBroadcast() {
    const text = broadcastInput.trim();
    if (!text || threads.length === 0) return;
    await replyToAll(text);
    setBroadcastOpen(false);
    setBroadcastInput('');
    await loadThreads();
    if (activeThread) {
      setMessages(await loadMessages(activeThread));
      markThreadRead(activeThread);
    } else {
      const first = await loadThreads();
      if (first.length > 0) { setActiveThread(first[0].id); setMessages(await loadMessages(first[0].id)); }
    }
  }

  function copyAddress(key: string, value: string) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    });
  }

  function saveBalance(u: AdminUserRow, val: number) {
    if (isNaN(val) || val < 0) return;
    // Persist to the shared server first (visible to every admin browser), then
    // keep a local copy too so offline/browser-only accounts still work.
    if (u.serverId) setAdminUserBalance(u.serverId, val).catch(() => null);
    updateUserBalance(u.email, val);
    reload();
  }

  async function saveUserProfile(u: AdminUserRow) {
    if (!u.serverId) return;
    setSavingUser(true);
    try {
      await patchAdminUser(u.serverId, { name: editName, email: editEmail, phone: editPhone });
      setEditingUser(null);
      await reload();
    } catch { /* keep the form open so the admin can retry */ }
    setSavingUser(false);
  }

  // Verifies a user wherever the account actually lives. Accounts created on the
  // shared server (any browser) are verified server-side; browser-only accounts
  // fall back to the local store. Either way the admin can verify everyone.
  function profileDetails(u: { firstName?: string; middleName?: string; lastName?: string; phone?: string; dob?: string; address?: string; businessName?: string }): string[] {
    const full = [u.firstName, u.middleName, u.lastName].filter(v => v && String(v).trim()).join(' ');
    const rows = [
      full ? `Full name: ${full}` : '',
      u.phone ? `Phone: ${u.phone}` : '',
      u.dob ? `DOB: ${u.dob}` : '',
      u.address ? `Address: ${u.address}` : '',
      u.businessName ? `Business: ${u.businessName}` : '',
    ].filter(Boolean);
    return rows;
  }

  async function approve(row: { email: string; name?: string; serverId?: string }) {
    setVerifying(row.email);
    setVerifyNotice('');
    let verifiedName = '';
    if (row.serverId) {
      try {
        const r = await verifyAdminUser(row.serverId);
        if (r.ok && r.data) verifiedName = r.data.name || row.name || '';
      } catch { /* offline — fall through to local below */ }
    }
    if (!verifiedName) {
      const local = markLocalUserVerified(row.email);
      verifiedName = local ? local.name : row.name || '';
    }
    decideKyc(`k${row.email.toLowerCase()}`, 'approve')
      .catch(() => null)
      .finally(() => {
        reload();
        setVerifying('');
        setVerifyNotice(`${verifiedName || row.name || 'Account'} (${row.email}) is now verified. Their dashboard will show the Verified badge on the next refresh.`);
      });
  }

  function logout() { adminLogout(); nav('/xk9-admin-console-7f3a'); }

  useEffect(() => { reload().catch(() => null); }, []);
  // One poller, not two: a duplicate interval doubled the request rate and raced
  // itself. While signed out reload() skips the admin reads, so a rejected token
  // cannot spam the server or leave the banner stuck.
  useEffect(() => {
    const id = setInterval(() => { reload().catch(() => null); }, 5000);
    return () => clearInterval(id);
  }, []);

  // Realtime: new customer messages appear (and bump the unread counter), a
  // "typing…" badge shows while a customer is typing, and blue read ticks flip
  // the instant a customer opens the thread — on every open admin browser,
  // without waiting for the 5s poll. The poll stays as a safety net.
  useEffect(() => {
    if (!hasAdminToken()) return;
    subscribeToChat('admin', (event: ChatEvent) => {
      if (event.type === 'typing') {
        if (event.role !== 'user' || !event.threadId) return;
        setTypingMap(prev => ({ ...prev, [event.threadId]: true }));
        window.setTimeout(() => { setTypingMap(prev => ({ ...prev, [event.threadId]: false })); }, 3000);
        return;
      }
      if (event.type === 'read') {
        if (activeThread === event.threadId && event.messages) {
          setMessages(event.messages.map(m => ({ id: m.id, from: m.from, text: m.text, time: m.time, at: m.at, read: !!m.read })));
        }
        return;
      }
      if (!event.messages) return;
      loadThreads().catch(() => null);
      if (activeThread === event.threadId) {
        setMessages(event.messages.map(m => ({ id: m.id, from: m.from, text: m.text, time: m.time, at: m.at, read: !!m.read })));
        const last = event.messages[event.messages.length - 1];
        // Only an incoming customer message marks a thread read; an admin's own
        // reply must not reset the badges.
        if (last && last.from === 'user') markAdminThreadRead(event.threadId).catch(() => null);
      }
    });
    return () => { closeChatStream(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAdminToken(), activeThread]);

  // WhatsApp habit: the open conversation always sits at the newest message.
  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages, activeThread]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'chat', label: 'Chat Inbox' },
    { key: 'users', label: 'Users' },
    { key: 'activity', label: 'Activity' },
    { key: 'deposits', label: 'Deposit Addresses' },
  ];

  const pendingUsers = users.filter(u => u.status === 'pending');

  return (
    <div style={{ minHeight: '100vh', background: '#0A2044', color: '#E5E7EB' }}>
      {/* Header */}
      <div style={{ background: '#0B2B5C', borderBottom: '1px solid #123C7C', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BrandMark height={18} white />
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#374151', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Admin Console</span>
        </div>
        <button onClick={logout} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' }}>LOG OUT</button>
      </div>

      {/* Tab nav */}
      <div className="admin-tabs" style={{ background: '#0B2B5C', borderBottom: '1px solid #123C7C', padding: '0 24px', display: 'flex', gap: '0' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); reload(); }}
            style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', padding: '12px 20px', background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid #4779C4' : '2px solid transparent', color: tab === t.key ? '#fff' : '#6B7280', cursor: 'pointer', letterSpacing: '0.04em', transition: 'color 0.12s', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {t.label}
            {t.key === 'chat' && unreadCount > 0 && (
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, background: '#DC2626', color: '#fff', padding: '1px 6px', borderRadius: '8px', animation: 'pulse 1.2s infinite' }}>{unreadCount}</span>
            )}
            {t.key === 'users' && pendingUsers.length > 0 && (
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, background: '#EAB308', color: '#0A2044', padding: '1px 6px', borderRadius: '8px' }}>{pendingUsers.length}</span>
            )}
          </button>
        ))}
      </div>

      {serverOnline ? (
        <div style={{ background: '#064E3B', borderBottom: '1px solid #10B981', padding: '8px 24px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#A7F3D0', textAlign: 'center', letterSpacing: '0.02em' }}>
          ● Shared server connected — showing everyone and everything from all devices.
        </div>
      ) : authStale ? (
        <div style={{ background: '#7C4A03', borderBottom: '1px solid #F59E0B', padding: '10px 24px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#FDE68A', textAlign: 'center' }}>
           Admin sign-in required — the shared server is connected, but this browser needs to sign in to reply, verify customers and set balances.{' '}
          <button onClick={logout} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 700, color: '#0A2044', background: '#FDE68A', border: 'none', padding: '4px 12px', cursor: 'pointer' }}>
            SIGN IN
          </button>
        </div>
      ) : (
        <div style={{ background: '#7F1D1D', borderBottom: '1px solid #DC2626', padding: '10px 24px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#FEE2E2', textAlign: 'center' }}>
          ⚠ Offline — you can only see THIS browser's data. The shared server at shieldsafebank-api.onrender.com is not answering right now (usually it is asleep and wakes on first try).{' '}
          <button onClick={() => { setSyncNow(true); reload().finally(() => setSyncNow(false)); }}
            style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 700, color: '#FEE2E2', background: 'transparent', border: '1px solid #FEE2E2', padding: '4px 12px', cursor: 'pointer' }}>
            {syncNow ? 'RETRYING…' : 'RETRY NOW'}
          </button>
        </div>
      )}

      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {verifyNotice !== '' && (
          <div role="status" style={{ background: '#0A2044', border: '1px solid #1E7A4C', borderLeft: '4px solid #1E7A4C', padding: '12px 16px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#E5E7EB', lineHeight: 1.6 }}>
            {verifyNotice}
          </div>
        )}

        {kycQueue.length > 0 && (
          <div style={{ background: '#0B2B5C', border: '1px solid #EAB308', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 700, color: '#EAB308', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {kycQueue.length} account{kycQueue.length === 1 ? '' : 's'} awaiting verification
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {kycQueue.map(q => (
                <div key={q.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', border: '1px solid #123C7C', padding: '10px 14px', background: '#0A2044' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#E5E7EB', fontWeight: 600, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.name}</p>
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#6B7280', margin: 0 }}>{q.email} · {q.type} signup · {fmtDateTime(q.submitted)}</p>
                    {profileDetails(q).map(line => (
                      <p key={line} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#A9C6E8', margin: '3px 0 0', wordBreak: 'break-word' }}>{line}</p>
                    ))}
                  </div>
                  <button
                    onClick={() => approve(q)}
                    disabled={verifying === q.email}
                    style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#fff', background: verifying === q.email ? '#6B7280' : '#1E7A4C', border: 'none', padding: '8px 16px', cursor: verifying === q.email ? 'default' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {verifying === q.email ? 'VERIFYING…' : 'VERIFY'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingUsers.length > 0 && (
          <div style={{ background: '#0B2B5C', border: '1px solid #EAB308', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 700, color: '#EAB308', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {pendingUsers.length} account{pendingUsers.length === 1 ? '' : 's'} awaiting verification
              </span>
              <button onClick={() => { setTab('users'); }} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#E5E7EB', background: '#123C7C', border: '1px solid #123C7C', padding: '6px 12px', cursor: 'pointer' }}>VIEW USERS</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pendingUsers.map(u => (
                <div key={u.email} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', border: '1px solid #123C7C', padding: '10px 14px', background: '#0A2044' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#E5E7EB', fontWeight: 600, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</p>
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#6B7280', margin: 0 }}>{u.email} · signed up {fmtDateTime(u.joined)}</p>
                    {profileDetails(u).map(line => (
                      <p key={line} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#A9C6E8', margin: '3px 0 0', wordBreak: 'break-word' }}>{line}</p>
                    ))}
                  </div>
                  <button
                    onClick={() => approve(u)}
                    disabled={verifying === u.email}
                    style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#fff', background: verifying === u.email ? '#6B7280' : '#1E7A4C', border: 'none', padding: '8px 16px', cursor: verifying === u.email ? 'default' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {verifying === u.email ? 'VERIFYING…' : 'VERIFY'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat */}
        {tab === 'chat' && (
          <div className="admin-chat" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 0, border: '1px solid #123C7C', height: '600px' }}>
            {/* Thread list */}
            <div style={{ borderRight: '1px solid #123C7C', overflowY: 'auto', background: '#0B2B5C' }}>
              {/* Reply to everyone — broadcast one message to all conversations */}
              <div style={{ padding: '8px 16px', borderBottom: '1px solid #123C7C', flexShrink: 0 }}>
                {!broadcastOpen ? (
                  <button
                    onClick={() => { setBroadcastOpen(true); setBroadcastInput(''); }}
                    disabled={threads.length === 0}
                    style={{ width: '100%', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#EAB308', background: '#123C7C', border: '1px solid #123C7C', padding: '8px 12px', cursor: threads.length === 0 ? 'default' : 'pointer', letterSpacing: '0.04em' }}
                  >
                    {threads.length === 0 ? 'NO CONVERSATIONS' : 'REPLY TO ALL • ' + threads.filter(t => t.unread).length + ' UNREAD'}
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea
                      value={broadcastInput}
                      onChange={e => setBroadcastInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBroadcast(); } }}
                      placeholder="Message to everyone…"
                      rows={2}
                      style={{ width: '100%', background: '#0A2044', border: '1px solid #123C7C', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#E5E7EB', outline: 'none', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={sendBroadcast} style={{ flex: 1, fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#fff', background: '#4779C4', border: 'none', padding: '6px 12px', cursor: 'pointer' }}>BROADCAST</button>
                      <button onClick={() => { setBroadcastOpen(false); setBroadcastInput(''); }} style={{ flex: 1, fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#6B7280', background: '#123C7C', border: '1px solid #123C7C', padding: '6px 12px', cursor: 'pointer' }}>CANCEL</button>
                    </div>
                  </div>
                )}
              </div>
              {threads.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#374151' }}>No chats yet. Messages from the app will appear here.</div>
              ) : threads.map(thread => (
                <button key={thread.id} onClick={() => selectThread(thread.id)}
                  style={{ width: '100%', textAlign: 'left', padding: '14px 16px', background: activeThread === thread.id ? '#123C7C' : 'none', border: 'none', borderBottom: '1px solid #123C7C', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: thread.unread ? 700 : 600, color: thread.unread ? '#fff' : '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {thread.unread && <span style={{ width: '8px', height: '8px', background: '#DC2626', borderRadius: '50%', flexShrink: 0 }} />}
                      {thread.user}
                    </span>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: thread.unread ? '#F87171' : '#6B7280', whiteSpace: 'nowrap' }}>{fmtShortTime(thread.at) || thread.time}</span>
                  </div>
                  {thread.email && <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#6B7280', margin: '0 0 4px' }}>{thread.email}</p>}
                  {typingMap[thread.id] ? (
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#22C55E', fontWeight: 600, margin: 0, fontStyle: 'italic' }}>typing…</p>
                  ) : (
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: thread.unread ? '#A9C6E8' : '#6B7280', fontWeight: thread.unread ? 600 : 400, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.preview}</p>
                  )}
                </button>
              ))}
            </div>

            {/* Thread view */}
            <div style={{ display: 'flex', flexDirection: 'column', background: '#fff' }}>
              <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {!activeThread ? (
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#6B7280', textAlign: 'center', marginTop: '40px' }}>Select a conversation to reply.</p>
                ) : messages.map((m, i) => (
                  <div key={m.id || i} style={{ display: 'flex', flexDirection: m.from === 'admin' ? 'row-reverse' : 'row', gap: '10px', alignItems: 'flex-end' }}>
                    <div style={{ maxWidth: '72%', background: m.from === 'admin' ? '#123C7C' : '#F4F6F8', color: m.from === 'admin' ? '#fff' : '#0A2044', borderRadius: '10px', padding: '10px 14px' }}>
                      <p style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', margin: '0 0 4px', lineHeight: 1.5 }}>{m.text}</p>
                      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#9CA3AF', margin: 0, textAlign: m.from === 'admin' ? 'right' : 'left', display: m.from === 'admin' ? 'flex' : 'block', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                        {fmtShortTime(m.at) || m.time}
                        {m.from === 'admin' && <ReadTicks read={!!m.read} onDark />}
                      </p>
                    </div>
                  </div>
                ))}

                {activeThread && typingMap[activeThread] && (
                  <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', alignItems: 'flex-end' }}>
                    <div style={{ width: '28px', height: '28px', background: '#F4F6F8', border: '1px solid #DCE3EA', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A2044', fontWeight: 700, fontSize: '11px' }}>…</div>
                    <div style={{ background: '#F4F6F8', color: '#0A2044', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center' }}>
                      <TypingDots />
                    </div>
                  </div>
                )}
              </div>
              <div style={{ borderTop: '1px solid #DCE3EA', padding: '12px 16px', display: 'flex', gap: '10px', position: 'relative' }}>
                {emojiOpen && (
                  <div style={{ position: 'absolute', bottom: '100%', left: '10px', marginBottom: '6px', background: '#fff', border: '1px solid #DCE3EA', boxShadow: '0 4px 16px rgba(10,32,68,0.12)', padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '3px', zIndex: 3 }} role="dialog" aria-label="Choose an emoji">
                    {CHAT_EMOJIS.map(e => (
                      <button key={e} onClick={() => { setChatInput(prev => prev + e); setEmojiOpen(false); chatInputRef.current?.focus(); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '17px', lineHeight: 1, padding: '3px' }} aria-label={`Insert ${e}`}>{e}</button>
                    ))}
                  </div>
                )}
                <button onClick={() => setEmojiOpen(o => !o)} aria-label="Insert emoji" aria-expanded={emojiOpen}
                  style={{ background: 'none', border: '1px solid #DCE3EA', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '4px 8px', color: '#0A2044', flexShrink: 0 }}>😊</button>
                <input ref={chatInputRef} value={chatInput} onChange={e => handleChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setEmojiOpen(false); sendReply(); } }}
                  placeholder="Type a reply…"
                  style={{ flex: 1, background: '#fff', border: '1px solid #DCE3EA', padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#0A2044', outline: 'none' }} />
                <button onClick={sendReply} style={{ background: '#123C7C', color: '#fff', border: 'none', padding: '9px 18px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fontSize: '12px', cursor: 'pointer', letterSpacing: '0.04em' }}>SEND</button>
              </div>
            </div>
          </div>
        )}

        {/* Users */}
        {tab === 'users' && (
          <div style={{ border: '1px solid #123C7C', overflowX: 'auto' }}>
            {users.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#374151' }}>
                No users yet. Anyone who signs up or logs in will show up here.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#0B2B5C' }}>
                    {['Name', 'Email', 'Account Number', 'Type', 'Balance', 'Status', 'Last Login', 'Joined'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Balance' ? 'right' : 'left', color: '#4779C4', fontWeight: 600, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #123C7C', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.email} style={{ borderBottom: i < users.length - 1 ? '1px solid #123C7C' : 'none', verticalAlign: 'top' }}>
                      <td style={{ padding: '11px 16px', color: '#E5E7EB', fontWeight: 600 }}>
                        {editingUser === u.email ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
                            <input
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              placeholder="Name"
                              style={{ background: '#0B2B5C', border: '1px solid #4779C4', padding: '5px 8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#E5E7EB', outline: 'none' }}
                            />
                            <input
                              value={editPhone}
                              onChange={e => setEditPhone(e.target.value)}
                              placeholder="Phone"
                              style={{ background: '#0B2B5C', border: '1px solid #4779C4', padding: '5px 8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#E5E7EB', outline: 'none' }}
                            />
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => saveUserProfile(u)}
                                disabled={savingUser || !u.serverId}
                                style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#fff', background: '#1E7A4C', border: 'none', padding: '5px 10px', cursor: savingUser ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                              >{savingUser ? 'SAVING…' : 'SAVE'}</button>
                              <button
                                onClick={() => setEditingUser(null)}
                                style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#E5E7EB', background: '#374151', border: 'none', padding: '5px 8px', cursor: 'pointer' }}
                              >✕</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {u.name}
                            {profileDetails(u).map(line => (
                              <p key={line} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 400, color: '#A9C6E8', margin: '3px 0 0', wordBreak: 'break-word' }}>{line}</p>
                            ))}
                            {u.serverId && (
                              <button
                                onClick={() => { setEditingUser(u.email); setEditName(u.name); setEditEmail(u.email); setEditPhone(u.phone || ''); }}
                                style={{ display: 'block', marginTop: '6px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#fff', background: '#4779C4', border: 'none', padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >EDIT</button>
                            )}
                          </>
                        )}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#A9C6E8' }}>
                        {editingUser === u.email ? (
                          <input
                            value={editEmail}
                            onChange={e => setEditEmail(e.target.value)}
                            placeholder="Email"
                            style={{ width: '100%', minWidth: '160px', background: '#0B2B5C', border: '1px solid #4779C4', padding: '5px 8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#E5E7EB', outline: 'none' }}
                          />
                        ) : u.email}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#E5E7EB', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.04em' }}>{u.accountNumber || '—'}</td>
                      <td style={{ padding: '11px 16px', color: '#E5E7EB', textTransform: 'capitalize' }}>{u.type}</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                        {editingBalance === u.email ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            <span style={{ color: '#6B7280' }}>$</span>
                            <input
                              type="number"
                              value={balanceInput}
                              onChange={e => setBalanceInput(e.target.value)}
                              step="0.01"
                              min="0"
                              style={{ width: '100px', background: '#0B2B5C', border: '1px solid #4779C4', padding: '5px 8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#E5E7EB', outline: 'none', textAlign: 'right' }}
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  saveBalance(u, parseFloat(balanceInput));
                                  setEditingBalance(null);
                                  setBalanceInput('');
                                } else if (e.key === 'Escape') {
                                  setEditingBalance(null);
                                  setBalanceInput('');
                                }
                              }}
                            />
                            <button
                              onClick={() => {
                                saveBalance(u, parseFloat(balanceInput));
                                setEditingBalance(null);
                                setBalanceInput('');
                              }}
                              style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#fff', background: '#1E7A4C', border: 'none', padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >SAVE</button>
                            <button
                              onClick={() => { setEditingBalance(null); setBalanceInput(''); }}
                              style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#E5E7EB', background: '#374151', border: 'none', padding: '5px 8px', cursor: 'pointer' }}
                            >✕</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                            <span style={{ color: '#E5E7EB', fontWeight: 600 }}>${u.balance.toFixed(2)}</span>
                            <button
                              onClick={() => { setEditingBalance(u.email); setBalanceInput(u.balance.toFixed(2)); }}
                              style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#fff', background: '#4779C4', border: 'none', padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >EDIT</button>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        {u.status === 'verified' ? (
                          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#34D399', whiteSpace: 'nowrap' }}>VERIFIED</span>
                        ) : (
                          <button
                            onClick={() => approve(u)}
                            disabled={verifying === u.email}
                            style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#fff', background: verifying === u.email ? '#6B7280' : '#EAB308', border: 'none', padding: '6px 14px', cursor: verifying === u.email ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                          >
                            {verifying === u.email ? 'VERIFYING…' : 'VERIFY'}
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#6B7280' }}>{fmtDateTime(u.lastLogin)}</td>
                      <td style={{ padding: '11px 16px', color: '#6B7280' }}>{fmtDateTime(u.joined)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Activity */}
        {tab === 'activity' && (
          <div style={{ border: '1px solid #123C7C' }}>
            {activity.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#374151' }}>
                No activity yet. New sign-ups and logins will appear here in real time.
              </div>
            ) : (
              activity.map((a, i) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '14px 20px', borderBottom: i < activity.length - 1 ? '1px solid #123C7C' : 'none', background: a.action === 'signup' ? 'rgba(30, 122, 76, 0.06)' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', padding: '4px 10px', background: a.action === 'signup' ? '#1E7A4C' : a.action === 'verified' ? '#EAB308' : '#4779C4', color: '#fff', whiteSpace: 'nowrap' }}>
                      {a.action === 'signup' ? 'SIGNED UP' : a.action === 'verified' ? 'VERIFIED' : 'LOGGED IN'}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#E5E7EB', fontWeight: 600, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</p>
                      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#6B7280', margin: 0 }}>{a.email}{a.via === 'admin' ? '' : ` · via ${a.via === 'google' ? 'Google' : 'email'}`}</p>
                    </div>
                  </div>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', whiteSpace: 'nowrap' }}>{fmtDateTime(a.at)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Deposit addresses */}
        {tab === 'deposits' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px' }}>
            <div style={{ border: '1px solid #123C7C', background: '#0B2B5C', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', fontWeight: 700, color: '#fff', margin: '0 0 4px', letterSpacing: '0.04em' }}>BTC (Bitcoin)</p>
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', margin: 0 }}>{BTC_NETWORK}</p>
                </div>
                <span style={{ fontSize: '12px', color: '#4779C4', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace' }}>BITCOIN</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <code style={{ flex: 1, fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#A9C6E8', background: '#0A2044', border: '1px solid #123C7C', padding: '12px 14px', wordBreak: 'break-all' }}>{DEPOSIT_ADDRESSES.BTC}</code>
                <button onClick={() => copyAddress('BTC', DEPOSIT_ADDRESSES.BTC)} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#fff', background: '#4779C4', border: 'none', padding: '10px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {copied === 'BTC' ? 'COPIED' : 'COPY'}
                </button>
              </div>
            </div>

            <div style={{ border: '1px solid #123C7C', background: '#0B2B5C', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', fontWeight: 700, color: '#fff', margin: '0 0 4px', letterSpacing: '0.04em' }}>USDT (ERC-20, Ethereum)</p>
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', margin: 0 }}>{USDT_NETWORK}</p>
                </div>
                <span style={{ fontSize: '12px', color: '#4779C4', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace' }}>ETHEREUM</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <code style={{ flex: 1, fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#A9C6E8', background: '#0A2044', border: '1px solid #123C7C', padding: '12px 14px', wordBreak: 'break-all' }}>{DEPOSIT_ADDRESSES['USDT-ERC20']}</code>
                <button onClick={() => copyAddress('USDT', DEPOSIT_ADDRESSES['USDT-ERC20'])} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#fff', background: '#4779C4', border: 'none', padding: '10px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {copied === 'USDT' ? 'COPIED' : 'COPY'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}