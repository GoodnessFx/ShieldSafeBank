import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { getUsers, getActivity, getThreads, getThreadMessages, pushChatMessage, markThreadRead, markLocalUserVerified, getKycQueue, updateUserBalance, removeThread, setUserProfile, deriveAchLast4, updateUserBanking, type ChatMessage, type StoreUser, type ActivityEvent, type KycItem, type ChatAttachment } from '../../lib/localStore';
import { decideKyc, getAdminKyc, getAdminUsers, setAdminUserBalance, patchAdminUser, createAdminUser, getAdminThreads, getAdminMessages, getTawkConfig, replyThread, replyToAll, saveAdminTawk, markAdminThreadRead, adminLogout, hasAdminToken, verifyAdminUser, pingAdminServer, adminAuthExpired, getAdminToken, sendAdminTyping, deleteAdminThread, getAdminUserLogins, getAdminActivity, getAdminCardTracking, updateAdminCardTracking, deleteAdminCardTracking, type AdminLoginEvent, type CardTrackingData } from '../../lib/api';
import CardTracking, { TRACKING_STEPS } from '../../components/CardTracking';
import { subscribeToChat, closeChatStream, type ChatEvent } from '../../lib/chatTransport';
import { fmtDateTime } from '../../lib/format';
import { DEPOSIT_ADDRESSES, BTC_NETWORK, USDT_NETWORK } from '../../lib/config';
import BrandMark from '../../components/BrandMark';
import { readCardScan, writeCardScan, type CardScanResult } from '../../components/CardScanner';

type Tab = 'chat' | 'users' | 'activity' | 'deposits' | 'tracking';

/** A row shown in the admin Users tab. Local accounts carry a full record; a
 * user that only exists on the server side is merged in so the admin never
 * misses anyone who has signed up. `serverId` links a row to its server record. */
type AdminUserRow = StoreUser & { serverId?: string };

/** Login counts shown next to each user in the admin Users tab. */
type LoginCountMap = Record<string, { total: number; today: number }>;

/** Swipe and delete state for each thread row in the admin Chat Inbox. */
type ThreadRowUi = {
  offset: number;
  confirm: boolean;
  busy: boolean;
};

/** True when the user sent a presence heartbeat in the last 2 minutes. */
function isOnlineNow(lastActiveAt?: string): boolean {
  if (!lastActiveAt) return false;
  const t = Date.parse(lastActiveAt);
  if (isNaN(t)) return false;
  return Date.now() - t < 2 * 60 * 1000;
}

/** Human "how active is this person" label, e.g. "Active 4m ago". */
function lastActiveLabel(lastActiveAt?: string): string {
  if (!lastActiveAt) return '';
  const t = Date.parse(lastActiveAt);
  if (isNaN(t)) return '';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 2) return 'Online now';
  if (mins < 60) return `Active ${mins}m ago`;
  if (mins < 1440) return `Active ${Math.floor(mins / 60)}h ago`;
  if (mins < 43200) return `Last seen ${Math.floor(mins / 1440)}d ago`;
  return `Last seen ${fmtDateTime(lastActiveAt)}`;
}

/** Human label + dot colour for the agent's own online / away / offline status. */
function agentStatusBadge(status: 'online' | 'away' | 'offline') {
  const map: Record<'online' | 'away' | 'offline', { label: string; color: string }> = {
    online: { label: 'Online', color: '#1E7A4C' },
    away: { label: 'Away', color: '#9A6B00' },
    offline: { label: 'Offline', color: '#DC2626' },
  };
  return map[status];
}

/** Activity panel badge text for every tracked action. */
const ACTIVITY_LABELS: Record<string, string> = {
  signup: 'SIGNED UP',
  login: 'LOGGED IN',
  verified: 'VERIFIED',
  deposit: 'DEPOSIT',
  withdrawal: 'WITHDRAWAL',
  card_scan_start: 'CARD SCAN STARTED',
  card_scan_capture: 'CARD CAPTURED',
  card_scan_complete: 'CARD SCAN SAVED',
  deposit_click: 'DEPOSIT CLICKED',
  withdraw_click: 'WITHDRAW CLICKED',
  profile_update: 'PROFILE UPDATED',
  email_verified: 'EMAIL VERIFIED',
  password_reset: 'PASSWORD RESET',
  chat_message: 'CHAT MESSAGE',
  support_message: 'SUPPORT FORM',
  admin_edit: 'ADMIN EDIT',
  logout: 'LOGGED OUT',
};

/** Badge colour for every tracked action. */
function activityBadgeColor(action: string): string {
  if (action === 'signup') return '#1E7A4C';
  if (action === 'verified') return '#B45309';
  if (action === 'deposit') return '#2FA46B';
  if (action === 'withdrawal') return '#B45309';
  if (action === 'card_scan_start' || action === 'card_scan_capture' || action === 'card_scan_complete') return '#7C3AED';
  if (action === 'password_reset' || action === 'logout') return '#6B7280';
  if (action === 'chat_message' || action === 'support_message') return '#0E7490';
  return '#4779C4';
}

/** Short summary of an event's details, e.g. "$500 · BTC". */
function activityDetailSummary(a: ActivityEvent): string {
  const d = a.details;
  if (!d) return '';
  const parts: string[] = [];
  if (typeof d.usd === 'number' || typeof d.usd === 'string') {
    const n = typeof d.usd === 'number' ? d.usd : parseFloat(String(d.usd));
    if (!isNaN(n) && n > 0) parts.push(`$${n.toFixed(2)}`);
  }
  if (typeof d.asset === 'string' && d.asset) parts.push(d.asset);
  if (typeof d.note === 'string' && d.note) parts.push(d.note);
  return parts.join(' · ');
}

/** Count of logins that happened today (local calendar day). */
function countLoginsToday(logins: AdminLoginEvent[]): number {
  const today = new Date().toDateString();
  return logins.filter(l => {
    const d = new Date(l.loggedInAt);
    return !isNaN(d.getTime()) && d.toDateString() === today;
  }).length;
}

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

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function AttachmentBubble({ attachment, onDark }: { attachment: ChatAttachment; onDark?: boolean }) {
  const isImage = attachment.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(attachment.name);
  const isPdf = attachment.type === 'application/pdf' || /\.pdf$/i.test(attachment.name);
  const isWord = attachment.type.includes('word') || /\.(docx?|rtf)$/i.test(attachment.name);

  if (isImage) {
    return (
      <div style={{ marginTop: '6px' }}>
        <img
          src={attachment.url}
          alt={attachment.name}
          onClick={() => window.open(attachment.url, '_blank')}
          style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '6px', objectFit: 'contain', cursor: 'pointer', background: 'rgba(0,0,0,0.05)', display: 'block' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '10px', color: onDark ? '#BDE0FF' : '#6B7280' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{attachment.name}</span>
          <a href={attachment.url} download={attachment.name} style={{ color: onDark ? '#fff' : '#123C7C', textDecoration: 'underline', marginLeft: '6px', fontWeight: 600 }}>Download</a>
        </div>
      </div>
    );
  }

  const badgeColor = isPdf ? '#DC2626' : isWord ? '#2563EB' : '#4B5563';
  const badgeLabel = isPdf ? 'PDF' : isWord ? 'DOC' : 'FILE';

  return (
    <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: onDark ? 'rgba(255,255,255,0.12)' : 'rgba(10,32,68,0.06)', borderRadius: '6px', border: `1px solid ${onDark ? 'rgba(255,255,255,0.2)' : '#DCE3EA'}` }}>
      <span style={{ fontSize: '10px', fontWeight: 700, background: badgeColor, color: '#fff', padding: '3px 6px', borderRadius: '4px', letterSpacing: '0.04em' }}>{badgeLabel}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: onDark ? '#fff' : '#0A2044', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.name}</p>
        <p style={{ margin: 0, fontSize: '10px', color: onDark ? '#D6E4F5' : '#6B7280' }}>{formatFileSize(attachment.size)}</p>
      </div>
      <a href={attachment.url} download={attachment.name} target="_blank" rel="noreferrer" style={{ fontSize: '11px', fontWeight: 600, color: onDark ? '#fff' : '#123C7C', textDecoration: 'underline', flexShrink: 0 }}>
        Download
      </a>
    </div>
  );
}

/** Shared style for the add-customer form inputs. */
const addInputStyle: React.CSSProperties = {
  flex: '1 1 180px', background: '#FFFFFF', border: '1px solid #DCE3EC', borderRadius: '8px',
  padding: '8px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none',
};

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
  const [editPassword, setEditPassword] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');
  const [editingCardUser, setEditingCardUser] = useState<string | null>(null);
  const [editCardLast4, setEditCardLast4] = useState('');
  const [editCardHolder, setEditCardHolder] = useState('');
  // Banking numbers & ACH editing modal state
  const [bankingModalUser, setBankingModalUser] = useState<AdminUserRow | null>(null);
  const [bankEditAccountNum, setBankEditAccountNum] = useState('');
  const [bankEditAchBank, setBankEditAchBank] = useState('');
  const [bankEditAchLast4, setBankEditAchLast4] = useState('');
  const [bankEditAchRouting, setBankEditAchRouting] = useState('');
  const [bankEditAchType, setBankEditAchType] = useState('');
  const [bankEditAchName, setBankEditAchName] = useState('');
  const [bankEditCardLast4, setBankEditCardLast4] = useState('');
  const [bankEditCardHolder, setBankEditCardHolder] = useState('');
  const [bankEditCardExp, setBankEditCardExp] = useState('');
  const [bankEditCardCvv, setBankEditCardCvv] = useState('');
  const [bankEditCardStatus, setBankEditCardStatus] = useState('Active');
  const [bankEditCardBrand, setBankEditCardBrand] = useState('Visa');
  const [bankEditDailyLimit, setBankEditDailyLimit] = useState('$5,000 / day');
  const [bankEditAchAccNum, setBankEditAchAccNum] = useState('');
  const [bankEditName, setBankEditName] = useState('');
  const [bankEditEmail, setBankEditEmail] = useState('');
  const [bankEditPhone, setBankEditPhone] = useState('');
  const [bankEditPassword, setBankEditPassword] = useState('');
  const [bankEditBalance, setBankEditBalance] = useState('');
  const [bankEditKycStatus, setBankEditKycStatus] = useState('verified');
  const [bankingSaving, setBankingSaving] = useState(false);
  const [bankingNotice, setBankingNotice] = useState('');
  // Add-customer form: lets an admin open a brand-new account from the panel.
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', type: 'personal', phone: '', balance: '' });
  const [addError, setAddError] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [serverOnline, setServerOnline] = useState(true);
  const [authStale, setAuthStale] = useState(false);
  const [syncNow, setSyncNow] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastInput, setBroadcastInput] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  // Agent online / away / offline status. Persisted so it survives a refresh and
  // is shown next to the Chat Inbox so clients know whether an agent is reachable.
  const [agentStatus, setAgentStatus] = useState<'online' | 'away' | 'offline'>(() => {
    try { return (localStorage.getItem('ssb_admin_status') as 'online' | 'away' | 'offline') || 'online'; } catch { return 'online'; }
  });
  useEffect(() => { try { localStorage.setItem('ssb_admin_status', agentStatus); } catch {} }, [agentStatus]);
  // Tawk.to (Hawk) live-chat connection configured by the admin so clients can
  // reach support through Tawk.to and agents reply from the Tawk.to dashboard —
  // a fallback channel that keeps working even when the ShieldSafeBank admin
  // console chat is having issues. Works on desktop and mobile.
  const [tawkPropertyId, setTawkPropertyId] = useState(() => {
    try { return localStorage.getItem('ssb_tawk_property_id') || ''; } catch { return ''; }
  });
  const [tawkConnected, setTawkConnected] = useState(() => {
    try { return localStorage.getItem('ssb_tawk_connected') === '1'; } catch { return false; }
  });
  const [tawkSaving, setTawkSaving] = useState(false);
  const [tawkNotice, setTawkNotice] = useState('');
  // Activity tab filters: free-text search + a time-window chip.
  const [activitySearch, setActivitySearch] = useState('');
  const [activityRange, setActivityRange] = useState<'all' | '24h' | '7d' | '30d'>('all');
  // Users tab search: filters rows by name or email.
  const [userSearch, setUserSearch] = useState('');
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  // threadId -> true while that customer is currently typing.
  const [typingMap, setTypingMap] = useState<Record<string, boolean>>({});
  const typingSentAtRef = useRef(0);
  const sendingReplyRef = useRef(false);
  // serverId -> per-user login history shown under each Users row.
  const [loginCounts, setLoginCounts] = useState<LoginCountMap>({});
  const [expandedLogins, setExpandedLogins] = useState<Record<string, boolean>>({});
  const [loginHistory, setLoginHistory] = useState<Record<string, AdminLoginEvent[]>>({});
  const [loginsBusy, setLoginsBusy] = useState<Record<string, boolean>>({});
  // threadId -> swipe offset / confirm / delete state for each Chat Inbox row.
  const [threadUi, setThreadUi] = useState<Record<string, ThreadRowUi>>({});
  const touchStartX = useRef<Record<string, number | null>>({});
  const touchBaseX = useRef<Record<string, number>>({});


  // Card delivery tracking state — keyed by user serverId.
  const [trackingMap, setTrackingMap] = useState<Record<string, CardTrackingData | null>>({});
  const [trackingBusy, setTrackingBusy] = useState<Record<string, boolean>>({});
  const [trackingExpanded, setTrackingExpanded] = useState<Record<string, boolean>>({});
  // Form state for the inline admin editor.
  const [trackingForm, setTrackingForm] = useState<Record<string, { step: string; note: string; estimatedDelivery: string; orderedAt: string }>>({});
  const [trackingError, setTrackingError] = useState<Record<string, string>>({});
  const [trackingSaved, setTrackingSaved] = useState<Record<string, boolean>>({});

  // If the shared server is reachable but the stored admin token is stale, the
  // banner says RE-LOGIN (green fix: one click), never OFFLINE. Render free
  // tier sleeps itself; the first probe each sitting is slow, so retry twice
  // with patience instead of condemning the whole panel instantly.
  async function checkServerLiveness(): Promise<{ online: boolean; auth: boolean }> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const probe = await pingAdminServer(attempt === 0 ? 10000 : 15000);
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
      if (attempt < 1) await new Promise(res => setTimeout(res, 2000));
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
          lastActiveAt: m.lastActiveAt || '',
          status: m.kyc === 'Approved' || m.status === 'Verified' ? 'verified' : 'pending',
          balance: parseServerBalance(m.balance),
          accountNumber: m.accountNumber || '',
          serverId: m.id,
          password: m.password || '',
          firstName: m.firstName || '',
          middleName: m.middleName || '',
          lastName: m.lastName || '',
          phone: m.phone || '',
          dob: m.dob || '',
          address: m.address || '',
          businessName: m.businessName || '',
          achBankName: m.achBankName || 'Bank',
          achLast4: m.achLast4 || deriveAchLast4(m.accountNumber || m.email),
          achRouting: m.achRouting || '021000021',
          achType: m.achType || 'ACH',
          achAccountName: m.achAccountName || m.name || '',
          achAccountNumber: m.achAccountNumber || '',
          cardLast4: m.cardLast4 || '',
          cardHolder: m.cardHolder || m.name || '',
          cardExp: m.cardExp || '12/28',
          cardCvv: m.cardCvv || '834',
          cardStatus: m.cardStatus || 'Active',
          cardBrand: m.cardBrand || 'Visa',
          dailyLimit: m.dailyLimit || '$5,000 / day',
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
      if (ex) {
        byEmail.set(key, {
          ...ex,
          ...l,
          serverId: ex.serverId,
          achBankName: ex.achBankName || l.achBankName,
          achLast4: ex.achLast4 || l.achLast4,
          achRouting: ex.achRouting || l.achRouting,
          achType: ex.achType || l.achType,
          achAccountName: ex.achAccountName || l.achAccountName,
          achAccountNumber: ex.achAccountNumber || l.achAccountNumber,
        });
      } else {
        byEmail.set(key, l);
      }
    }
    setUsers(Array.from(byEmail.values()));

    setActivity(getActivity());
    setKycQueue(getKycQueue());
    // Server activity feed: everything that happened on every device (sign-ups,
    // logins, deposits, withdrawals), merged with this browser's local copy so
    // the admin never misses an event even while the backend is unreachable.
    if (signedIn) {
      try {
        const ar = await getAdminActivity();
        if (ar.ok && ar.data) {
          const merged = new Map<string, ActivityEvent>();
          for (const e of ar.data) {
            merged.set(e.id, {
              id: e.id,
              email: e.email || '',
              name: e.name || e.email || '',
              action: (e.action || 'login') as ActivityEvent['action'],
              via: (e.via || 'email') as ActivityEvent['via'],
              at: e.at || '',
              details: (e.details || {}) as ActivityEvent['details'],
            });
          }
          for (const a of getActivity()) if (!merged.has(a.id)) merged.set(a.id, a);
          setActivity(Array.from(merged.values()).sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, 300));
        }
      } catch { /* keep the local feed */ }
    }
    const counts: LoginCountMap = {};
    if (signedIn) {
      for (const r of remote) {
        if (!r.serverId) continue;
        try {
          const lr = await getAdminUserLogins(r.serverId);
          if (lr.ok && lr.data) {
            counts[r.serverId] = { total: lr.data.length, today: countLoginsToday(lr.data) };
            setLoginHistory(prev => ({ ...prev, [r.serverId as string]: lr.data as AdminLoginEvent[] }));
          }
        } catch { /* keep the row without counts */ }
      }
    }
    setLoginCounts(prev => ({ ...prev, ...counts }));
    const threadsNow = await loadThreads();
    if (activeThread) {
      setMessages(await loadMessages(activeThread));
      markThreadRead(activeThread);
    }
    // Conversations open ONLY when the admin clicks one — no auto-opening the
    // first thread on load (important on mobile where the list should show).
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
    // fallback copy plus the server copy), preferring the server thread ID.
    const deduped = new Map<string, AdminThread>();
    for (const t of Array.from(byId.values())) {
      const key = (t.email || '').toLowerCase() || t.id;
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, t);
      } else {
        const isServer = serverThreads.some(s => s.id === t.id);
        const existingIsServer = serverThreads.some(s => s.id === existing.id);
        const preferredId = existingIsServer ? existing.id : isServer ? t.id : (existing.id || t.id);
        const newer = String(t.at || '') > String(existing.at || '') ? t : existing;
        deduped.set(key, { ...newer, id: preferredId });
      }
    }
    const merged = Array.from(deduped.values()).sort((a, b) => (a.at || '') < (b.at || '') ? 1 : (a.at || '') > (b.at || '') ? -1 : 0);
    setThreads(merged);
    setUnreadCount(merged.filter(t => t.unread).length);
    return merged;
  }

  async function loadMessages(id: string): Promise<ChatMessage[]> {
    const thread = threads.find(t => t.id === id) || getThreads().find(t => t.id === id);
    const localMsgs = getThreadMessages(id);
    const altId = thread && thread.email ? `u${thread.email.toLowerCase()}` : '';
    const altLocalMsgs = altId && altId !== id ? getThreadMessages(altId) : [];
    const allLocal = [...localMsgs, ...altLocalMsgs];

    try {
      const r = await getAdminMessages(id);
      if (r.ok && r.data) {
        const serverTexts = new Set(r.data.map(m => m.text));
        const missing = allLocal.filter(m => !serverTexts.has(m.text));
        return [...r.data, ...missing];
      }
    } catch { /* fall back below */ }

    const seen = new Set<string>();
    const res: ChatMessage[] = [];
    for (const m of allLocal) {
      if (!seen.has(m.text)) {
        seen.add(m.text);
        res.push(m);
      }
    }
    return res;
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
    if (!text || !activeThread || sendingReplyRef.current) return;
    sendingReplyRef.current = true;
    setEmojiOpen(false);
    const id = activeThread;
    const thread = threads.find(t => t.id === id) || getThreads().find(t => t.id === id);
    const stamp = new Date().toISOString();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatInput('');
    // WhatsApp habit: your reply appears immediately, then the server copy replaces it.
    setMessages(prev => [...prev, { id: `admin${Date.now()}`, from: 'admin', text, time, at: stamp }]);

    // Always store locally so offline mode or local browser chat has the message:
    pushChatMessage(id, thread ? thread.user : 'Customer', thread ? thread.email : '', text, 'admin');
    if (thread && thread.email) {
      const localId = `u${thread.email.toLowerCase()}`;
      if (localId !== id) {
        pushChatMessage(localId, thread.user, thread.email, text, 'admin');
      }
    }
    markThreadRead(id);

    try {
      const r = await replyThread(id, text);
      if (r.ok && r.data?.messages) {
        setMessages(r.data.messages);
      } else {
        setMessages(await loadMessages(id));
      }
      await loadThreads();
    } catch {
      setMessages(await loadMessages(id));
    } finally {
      // Always re-enable the composer so the reply box can never appear stuck
      // or disabled after a failed send (the "reply box disappeared" issue).
      sendingReplyRef.current = false;
    }
  }

  async function toggleLogins(serverId?: string) {
    if (!serverId) return;
    const open = !expandedLogins[serverId];
    setExpandedLogins(prev => ({ ...prev, [serverId]: open }));
    if (!open || loginHistory[serverId]) return;
    setLoginsBusy(prev => ({ ...prev, [serverId]: true }));
    try {
      const r = await getAdminUserLogins(serverId);
      if (r.ok && r.data) {
        setLoginHistory(prev => ({ ...prev, [serverId]: r.data as AdminLoginEvent[] }));
        setLoginCounts(prev => ({ ...prev, [serverId]: { total: r.data!.length, today: countLoginsToday(r.data as AdminLoginEvent[]) } }));
      }
    } catch { /* keep the closed row even when history cannot load */ }
    setLoginsBusy(prev => ({ ...prev, [serverId]: false }));
  }

  function loginCountLabel(serverId?: string): string | null {
    if (!serverId) return null;
    const counts = loginCounts[serverId];
    if (!counts) return null;
    if (counts.total <= 0) return '0 logins';
    if (counts.today > 0) return `${counts.total} logins · ${counts.today} today`;
    return `${counts.total} logins`;
  }

  function rowUi(id: string): ThreadRowUi {
    return threadUi[id] || { offset: 0, confirm: false, busy: false };
  }

  function setRowUi(id: string, patch: Partial<ThreadRowUi>) {
    setThreadUi(prev => ({ ...prev, [id]: { ...rowUi(id), ...patch } }));
  }

  // Standard mobile pattern: swiping left slides the row and reveals a red
  // delete button underneath. Mouse users keep the visible delete button.
  function onThreadTouchStart(id: string, e: React.TouchEvent) {
    touchStartX.current[id] = e.touches[0]?.clientX ?? null;
    touchBaseX.current[id] = rowUi(id).offset;
  }

  function onThreadTouchMove(id: string, e: React.TouchEvent) {
    const start = touchStartX.current[id];
    if (start === null || start === undefined) return;
    const dx = (e.touches[0]?.clientX ?? start) - start;
    const next = Math.min(0, Math.max(-96, (touchBaseX.current[id] || 0) + dx));
    setRowUi(id, { offset: next });
  }

  function onThreadTouchEnd(id: string) {
    touchStartX.current[id] = null;
    const offset = rowUi(id).offset;
    setRowUi(id, { offset: offset < -48 ? -96 : 0 });
  }

  async function confirmDeleteThread(id: string, threadName: string) {
    if (rowUi(id).busy) return;
    setRowUi(id, { busy: true });
    try {
      // Server first (hidden everywhere), then the browser's local copy. If the
      // backend is offline we still clear it locally and reload shows the rest.
      await deleteAdminThread(id).catch(() => null);
      removeThread(id);
      setThreads(prev => prev.filter(t => t.id !== id));
      setThreadUi(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (activeThread === id) {
        setActiveThread(null);
        setMessages([]);
      }
      await loadThreads();
    } finally {
      setRowUi(id, { busy: false, confirm: false, offset: 0 });
    }
    void threadName;
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
    }
    // Never auto-open a thread after a broadcast; the admin stays where they are.
  }

  /** Save the Tawk.to (Hawk) property id so the customer-facing widget connects
   *  to the admin's Tawk.to dashboard. Stored on the shared server so every
   *  customer device — desktop and mobile — loads the same widget. Agents reply
   *  from the Tawk.to mobile app/dashboard even if this inbox has issues. */
  async function saveTawkPropertyId() {
    const id = tawkPropertyId.trim();
    setTawkSaving(true);
    setTawkNotice('');
    try {
      if (!id) {
        const r = await saveAdminTawk('', '1');
        if (!r.ok) throw new Error(r.error);
        localStorage.removeItem('ssb_tawk_property_id');
        localStorage.removeItem('ssb_tawk_connected');
        setTawkConnected(false);
        setTawkNotice('Tawk.to connection cleared.');
        return;
      }
      const r = await saveAdminTawk(id);
      if (!r.ok) throw new Error(r.error || 'Save failed.');
      localStorage.setItem('ssb_tawk_property_id', id);
      localStorage.setItem('ssb_tawk_connected', '1');
      setTawkConnected(true);
      setTawkNotice('Tawk.to connected. Customers now see the chat bubble on every page — reply from the Tawk.to dashboard/app.');
    } catch (err) {
      setTawkConnected(false);
      setTawkNotice(`Could not save Tawk.to property id: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setTawkSaving(false);
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

  async function createAccount() {
    setAddError('');
    const bal = parseFloat(addForm.balance);
    if (!addForm.name.trim() || !addForm.email.trim() || addForm.password.trim().length < 4) {
      setAddError('Name, email and a password of at least 4 characters are required.');
      return;
    }
    setAddBusy(true);
    try {
      const r = await createAdminUser({
        name: addForm.name.trim(),
        email: addForm.email.trim(),
        password: addForm.password.trim(),
        type: addForm.type,
        phone: addForm.phone.trim(),
        balance: Number.isFinite(bal) ? bal : 0,
      });
      if (!r.ok || (r.data && (r.data as { error?: string }).error)) {
        setAddError((r.data as { error?: string })?.error || 'Could not create the account.');
      } else {
        setAddOpen(false);
        setAddForm({ name: '', email: '', password: '', type: 'personal', phone: '', balance: '' });
        await reload();
      }
    } catch {
      setAddError('Could not reach the server. Try again.');
    }
    setAddBusy(false);
  }

  async function saveUserProfile(u: AdminUserRow) {
    if (!u.serverId) return;
    setSavingUser(true);
    try {
      await patchAdminUser(u.serverId, {
        name: editName,
        email: editEmail,
        phone: editPhone,
        // Only send these when the admin actually typed something, so an empty
        // box never wipes an existing password or account number.
        ...(editPassword.trim() ? { password: editPassword.trim() } : {}),
        ...(editAccountNumber.trim() ? { accountNumber: editAccountNumber.trim() } : {}),
      });
      setEditingUser(null);
      setEditPassword('');
      setEditAccountNumber('');
      await reload();
    } catch { /* keep the form open so the admin can retry */ }
    setSavingUser(false);
  }

  function openBankingModal(u: AdminUserRow) {
    setBankingModalUser(u);
    setBankEditAccountNum(u.accountNumber || '');
    setBankEditAchBank(u.achBankName || 'Bank');
    setBankEditAchLast4(u.achLast4 || deriveAchLast4(u.accountNumber || u.email));
    setBankEditAchRouting(u.achRouting || '021000021');
    setBankEditAchType(u.achType || 'ACH');
    setBankEditAchName(u.achAccountName || u.name || '');
    setBankEditAchAccNum(u.achAccountNumber || '');
    const sc = readCardScan(u.email);
    setBankEditCardLast4(u.cardLast4 || sc?.last4 || deriveAchLast4(u.email));
    setBankEditCardHolder(u.cardHolder || sc?.holderName || u.name || '');
    setBankEditCardExp(u.cardExp || '12/28');
    setBankEditCardCvv(u.cardCvv || '834');
    setBankEditCardStatus(u.cardStatus || 'Active');
    setBankEditCardBrand(u.cardBrand || 'Visa');
    setBankEditDailyLimit(u.dailyLimit || '$5,000 / day');
    setBankEditName(u.name || '');
    setBankEditEmail(u.email || '');
    setBankEditPhone(u.phone || '');
    setBankEditPassword(u.password || '');
    setBankEditBalance((u.balance || 0).toFixed(2));
    setBankEditKycStatus(u.status || 'verified');
    setBankingNotice('');
  }

  async function saveBankingDetails() {
    if (!bankingModalUser) return;
    setBankingSaving(true);
    setBankingNotice('');
    const u = bankingModalUser;
    const payload = {
      name: bankEditName.trim() || u.name,
      email: bankEditEmail.trim() || u.email,
      phone: bankEditPhone.trim(),
      password: bankEditPassword.trim() || undefined,
      accountNumber: bankEditAccountNum.trim(),
      achBankName: bankEditAchBank.trim(),
      achLast4: bankEditAchLast4.trim(),
      achRouting: bankEditAchRouting.trim(),
      achType: bankEditAchType.trim(),
      achAccountName: bankEditAchName.trim(),
      achAccountNumber: bankEditAchAccNum.trim(),
      cardLast4: bankEditCardLast4.trim(),
      cardHolder: bankEditCardHolder.trim(),
      cardExp: bankEditCardExp.trim(),
      cardCvv: bankEditCardCvv.trim(),
      cardStatus: bankEditCardStatus.trim(),
      cardBrand: bankEditCardBrand.trim(),
      dailyLimit: bankEditDailyLimit.trim(),
      status: bankEditKycStatus === 'verified' ? 'verified' : 'pending',
    };

    const targetId = u.serverId || u.email;
    if (targetId) {
      try {
        const patchRes = await patchAdminUser(targetId, payload);
        if (!patchRes.ok && u.email && u.serverId) {
          await patchAdminUser(u.email, payload);
        }
        const parsedBal = parseFloat(bankEditBalance);
        if (!isNaN(parsedBal) && parsedBal >= 0 && Math.abs(parsedBal - (u.balance || 0)) > 0.001) {
          await setAdminUserBalance(targetId, parsedBal);
        }
      } catch (err) {
        console.warn('Server patch error:', err);
      }
    }

    // Local real-time store update
    setUserProfile(u.email, payload);
    updateUserBanking(u.email, payload);
    const parsedBal = parseFloat(bankEditBalance);
    if (!isNaN(parsedBal) && parsedBal >= 0) {
      setBalance(u.email, parsedBal);
    }

    if (bankEditCardLast4.trim()) {
      const sc = readCardScan(u.email) || { front: true, back: true, last4: '', holderName: '', scannedAt: '' };
      sc.last4 = bankEditCardLast4.trim();
      sc.holderName = bankEditCardHolder.trim() || u.name;
      sc.scannedAt = new Date().toISOString();
      writeCardScan(u.email, sc);
    }

    setBankingSaving(false);
    setBankingNotice('Saved and synced in real-time! Client dashboard will reflect changes immediately.');
    await reload();
    setTimeout(() => {
      setBankingModalUser(null);
      setBankingNotice('');
    }, 1200);
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

  // ---------------------------------------------------------------------------
  // Card tracking helpers
  // ---------------------------------------------------------------------------

  async function loadTracking(serverId: string) {
    if (!serverId || trackingBusy[serverId]) return;
    setTrackingBusy(prev => ({ ...prev, [serverId]: true }));
    try {
      const r = await getAdminCardTracking(serverId);
      if (r.ok) {
        const t = r.data?.tracking ?? null;
        setTrackingMap(prev => ({ ...prev, [serverId]: t }));
        // Pre-fill the editor form from whatever is stored.
        if (t) {
          setTrackingForm(prev => ({
            ...prev,
            [serverId]: {
              step: String(t.step),
              note: t.note || '',
              estimatedDelivery: t.estimatedDelivery || '',
              orderedAt: t.orderedAt || '',
            },
          }));
        } else {
          setTrackingForm(prev => ({
            ...prev,
            [serverId]: { step: '0', note: '', estimatedDelivery: '', orderedAt: new Date().toISOString().slice(0, 10) },
          }));
        }
      }
    } catch { /* keep existing data */ }
    setTrackingBusy(prev => ({ ...prev, [serverId]: false }));
  }

  function toggleTracking(serverId: string) {
    const open = !trackingExpanded[serverId];
    setTrackingExpanded(prev => ({ ...prev, [serverId]: open }));
    if (open && trackingMap[serverId] === undefined) loadTracking(serverId);
  }

  async function saveTracking(serverId: string) {
    const form = trackingForm[serverId];
    if (!form) return;
    const step = parseInt(form.step, 10);
    if (isNaN(step) || step < 0 || step > 4) {
      setTrackingError(prev => ({ ...prev, [serverId]: 'Step must be 0 – 4.' }));
      return;
    }
    setTrackingError(prev => ({ ...prev, [serverId]: '' }));
    setTrackingBusy(prev => ({ ...prev, [serverId]: true }));
    try {
      const r = await updateAdminCardTracking(serverId, {
        step,
        note: form.note.trim(),
        estimatedDelivery: form.estimatedDelivery.trim(),
        orderedAt: form.orderedAt.trim() || new Date().toISOString().slice(0, 10),
      });
      if (r.ok && r.data) {
        setTrackingMap(prev => ({ ...prev, [serverId]: r.data!.tracking }));
        setTrackingSaved(prev => ({ ...prev, [serverId]: true }));
        setTimeout(() => setTrackingSaved(prev => ({ ...prev, [serverId]: false })), 2000);
      } else {
        setTrackingError(prev => ({ ...prev, [serverId]: 'Could not save. Try again.' }));
      }
    } catch {
      setTrackingError(prev => ({ ...prev, [serverId]: 'Network error. Try again.' }));
    }
    setTrackingBusy(prev => ({ ...prev, [serverId]: false }));
  }

  async function clearTracking(serverId: string) {
    if (!window.confirm('Clear this user\'s card tracking? This cannot be undone.')) return;
    setTrackingBusy(prev => ({ ...prev, [serverId]: true }));
    try {
      await deleteAdminCardTracking(serverId);
      setTrackingMap(prev => ({ ...prev, [serverId]: null }));
      setTrackingForm(prev => ({
        ...prev,
        [serverId]: { step: '0', note: '', estimatedDelivery: '', orderedAt: new Date().toISOString().slice(0, 10) },
      }));
    } catch { /* keep existing */ }
    setTrackingBusy(prev => ({ ...prev, [serverId]: false }));
  }

  function patchForm(serverId: string, patch: Partial<{ step: string; note: string; estimatedDelivery: string; orderedAt: string }>) {
    setTrackingForm(prev => ({ ...prev, [serverId]: { ...(prev[serverId] || { step: '0', note: '', estimatedDelivery: '', orderedAt: '' }), ...patch } }));
  }

  useEffect(() => { reload().catch(() => null); }, []);
  // Load the Tawk.to property the admin connected so the inbox shows connected
  // state even before the admin edits it again.
  useEffect(() => {
    if (!hasAdminToken()) return;
    (async () => {
      const r = await getTawkConfig();
      if (r) {
        setTawkPropertyId(r.propertyId || '');
        setTawkConnected(!!(r.propertyId || ''));
      }
    })();
  }, [hasAdminToken()]);

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
    { key: 'tracking', label: 'Card Tracking' },
  ];

  const pendingUsers = users.filter(u => u.status === 'pending');

  // Activity tab: apply the time-window chip, then the free-text search
  // (matches name, email, action label and the detail summary).
  const activityFiltered = activity.filter(a => {
    if (activityRange !== 'all') {
      const t = Date.parse(a.at);
      if (isNaN(t)) return false;
      const cutoff = activityRange === '24h' ? 24 * 3600e3 : activityRange === '7d' ? 7 * 86400e3 : 30 * 86400e3;
      if (Date.now() - t > cutoff) return false;
    }
    const q = activitySearch.trim().toLowerCase();
    if (!q) return true;
    const label = ACTIVITY_LABELS[a.action] || String(a.action);
    const hay = `${a.name} ${a.email} ${label} ${activityDetailSummary(a)}`.toLowerCase();
    return hay.includes(q);
  });
  // Users tab: filter rows by name or email.
  const visibleUsers = users.filter(u => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return `${u.name} ${u.email}`.toLowerCase().includes(q);
  });

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9', color: '#374151' }}>
      {/* Responsive rules: chat becomes list-or-conversation below 800px, cards stack, tabs scroll. */}
      <style>{`
        @media (max-width: 799px) {
          .admin-chat { display: block !important; height: auto !important; }
          .admin-convo { display: none !important; }
          .admin-chat.admin-chat-open .admin-threads { display: none !important; }
          /* Bounded height so the reply composer (input + SEND) stays pinned
             to the bottom of the screen instead of being pushed out of view. */
          .admin-chat.admin-chat-open .admin-convo {
            display: flex !important;
            height: calc(100vh - 230px) !important;
            min-height: 380px !important;
            overflow: hidden !important;
          }
          .admin-tabs { overflow-x: auto !important; padding: 0 12px !important; }
          .admin-main { padding: 14px 12px !important; }
        }
        @media (max-width: 640px) {
          .kyc-row { flex-direction: column !important; align-items: stretch !important; }
          .kyc-row > button { align-self: flex-start; }
        }
        @media (min-width: 800px) { .convo-back { display: none !important; } }
      `}</style>
      {/* Header */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #DCE3EC', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BrandMark height={18} />
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#0A2044', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Admin Console</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: '#6B7280' }}>Agent status</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: agentStatusBadge(agentStatus).color, flexShrink: 0 }} />
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 600, color: agentStatusBadge(agentStatus).color }}>{agentStatusBadge(agentStatus).label}</span>
          </span>
          <select value={agentStatus} onChange={e => setAgentStatus(e.target.value as 'online' | 'away' | 'offline')} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', padding: '3px 8px', borderRadius: '6px', border: '1px solid #DCE3EC', background: '#fff', color: '#0A2044', outline: 'none', cursor: 'pointer' }}>
            <option value="online">Online</option>
            <option value="away">Away</option>
            <option value="offline">Offline</option>
          </select>
        </div>
        <button onClick={logout} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' }}>LOG OUT</button>
      </div>

      {/* Tab nav */}
      <div className="admin-tabs" style={{ background: '#FFFFFF', borderBottom: '1px solid #DCE3EC', padding: '0 24px', display: 'flex', gap: '0' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); reload(); }}
            style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', padding: '12px 20px', background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid #123C7C' : '2px solid transparent', color: tab === t.key ? '#123C7C' : '#6B7280', cursor: 'pointer', letterSpacing: '0.04em', transition: 'color 0.12s', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {t.label}
            {t.key === 'chat' && unreadCount > 0 && (
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, background: '#DC2626', color: '#fff', padding: '1px 6px', borderRadius: '8px', animation: 'pulse 1.2s infinite' }}>{unreadCount}</span>
            )}
            {t.key === 'users' && pendingUsers.length > 0 && (
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, background: '#1E7A4C', color: '#0A2044', padding: '1px 6px', borderRadius: '8px' }}>{pendingUsers.length}</span>
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

      <div className="admin-main" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {verifyNotice !== '' && (
          <div role="status" style={{ background: '#F4F6F9', border: '1px solid #1E7A4C', borderLeft: '4px solid #1E7A4C', borderRadius: '8px', padding: '12px 16px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', lineHeight: 1.6 }}>
            {verifyNotice}
          </div>
        )}

        {kycQueue.length > 0 && (
          <div style={{ background: '#FFFFFF', border: '1px solid #EAB308', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 700, color: '#92400E', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {kycQueue.length} account{kycQueue.length === 1 ? '' : 's'} awaiting verification
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {kycQueue.map(q => (
                <div key={q.id} className="kyc-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', border: '1px solid #DCE3EC', borderRadius: '8px', padding: '10px 14px', background: '#FFFFFF' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#0A2044', fontWeight: 600, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.name}</p>
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#6B7280', margin: 0 }}>{q.email} · {q.type} signup · {fmtDateTime(q.submitted)}</p>
                    {profileDetails(q).map(line => (
                      <p key={line} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', margin: '3px 0 0', wordBreak: 'break-word' }}>{line}</p>
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
          <div style={{ background: '#FFFFFF', border: '1px solid #EAB308', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 700, color: '#92400E', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {pendingUsers.length} account{pendingUsers.length === 1 ? '' : 's'} awaiting verification
              </span>
              <button onClick={() => { setTab('users'); }} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#fff', background: '#123C7C', border: '1px solid #123C7C', padding: '6px 12px', cursor: 'pointer' }}>VIEW USERS</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pendingUsers.map(u => (
                <div key={u.email} className="kyc-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', border: '1px solid #DCE3EC', borderRadius: '8px', padding: '10px 14px', background: '#FFFFFF' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#0A2044', fontWeight: 600, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</p>
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#6B7280', margin: 0 }}>{u.email} · signed up {fmtDateTime(u.joined)}</p>
                    {profileDetails(u).map(line => (
                      <p key={line} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', margin: '3px 0 0', wordBreak: 'break-word' }}>{line}</p>
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

        {/* Tawk.to (Hawk) connection — shown above the inbox when no conversation is open */}
        {tab === 'chat' && !activeThread && (
          <div style={{ background: '#FFFFFF', border: `1px solid ${tawkConnected ? '#1E7A4C' : '#DCE3EC'}`, borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 700, color: '#0A2044', letterSpacing: '0.04em' }}>
                TAWK.TO (HAWK) LIVE CHAT
              </span>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#fff', background: tawkConnected ? '#1E7A4C' : '#6B7280', padding: '2px 8px', borderRadius: '8px' }}>
                {tawkConnected ? 'CONNECTED' : 'NOT CONNECTED'}
              </span>
            </div>
            <p style={{ margin: 0, fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', lineHeight: 1.5 }}>
              Paste your Tawk.to Property ID (the part after embed.tawk.to/ in your widget code). Customers get the Tawk.to bubble on every page, and you reply from the Tawk.to mobile app (iOS/Android) or dashboard, even if this inbox has issues.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                value={tawkPropertyId}
                onChange={e => setTawkPropertyId(e.target.value)}
                placeholder="Tawk.to Property ID"
                aria-label="Tawk.to Property ID"
                style={{ flex: '1 1 200px', minWidth: 0, background: '#fff', border: '1px solid #DCE3EC', borderRadius: '8px', padding: '8px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }}
              />
              <button onClick={saveTawkPropertyId} disabled={tawkSaving}
                style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#fff', background: '#123C7C', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {tawkConnected && tawkPropertyId.trim() ? 'UPDATE' : tawkPropertyId.trim() ? 'CONNECT' : 'DISCONNECT'}
              </button>
              <a href="https://dashboard.tawk.to" target="_blank" rel="noreferrer"
                style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#123C7C', border: '1px solid #123C7C', borderRadius: '8px', padding: '8px 16px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                OPEN TAWK.TO
              </a>
            </div>
            {tawkNotice && <p role="status" style={{ margin: 0, fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#1E7A4C' }}>{tawkNotice}</p>}
          </div>
        )}

        {/* Chat */}
        {tab === 'chat' && (
          <div className={`admin-chat${activeThread ? ' admin-chat-open' : ''}`} style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 0, border: '1px solid #DCE3EC', borderRadius: '12px', overflow: 'hidden', background: '#FFFFFF', minHeight: '520px', height: '600px' }}>
            {/* Thread list */}
            <div className="admin-threads" style={{ borderRight: '1px solid #DCE3EC', overflowY: 'auto', background: '#FFFFFF' }}>
              {/* Reply to everyone — broadcast one message to all conversations */}
              <div style={{ padding: '8px 16px', borderBottom: '1px solid #DCE3EC', flexShrink: 0 }}>
                {!broadcastOpen ? (
                  <button
                    onClick={() => { setBroadcastOpen(true); setBroadcastInput(''); }}
                    disabled={threads.length === 0}
                    style={{ width: '100%', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#fff', background: '#123C7C', border: '1px solid #DCE3EC', padding: '8px 12px', cursor: threads.length === 0 ? 'default' : 'pointer', letterSpacing: '0.04em' }}
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
                      style={{ width: '100%', background: '#F4F6F9', border: '1px solid #DCE3EC', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={sendBroadcast} style={{ flex: 1, fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#fff', background: '#123C7C', border: 'none', padding: '6px 12px', cursor: 'pointer' }}>BROADCAST</button>
                      <button onClick={() => { setBroadcastOpen(false); setBroadcastInput(''); }} style={{ flex: 1, fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#0A2044', background: '#fff', border: '1px solid #DCE3EC', padding: '6px 12px', cursor: 'pointer' }}>CANCEL</button>
                    </div>
                  </div>
                )}
              </div>
              {threads.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#374151' }}>No chats yet. Messages from the app will appear here.</div>
              ) : threads.map(thread => {
                const ui = rowUi(thread.id);
                return (
                <div key={thread.id} style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid #DCE3EC' }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '96px', background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {ui.confirm ? (
                      <button onClick={() => confirmDeleteThread(thread.id, thread.user)}
                        disabled={ui.busy}
                        style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#fff', background: 'transparent', border: '1px solid #fff', padding: '6px 10px', cursor: ui.busy ? 'default' : 'pointer', letterSpacing: '0.04em' }}
                      >
                        {ui.busy ? 'DELETING…' : 'CONFIRM?'}
                      </button>
                    ) : (
                      <button onClick={() => setRowUi(thread.id, { confirm: true, offset: -96 })}
                        style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#fff', background: 'transparent', border: '1px solid #fff', padding: '6px 10px', cursor: 'pointer', letterSpacing: '0.04em' }}
                      >
                        DELETE
                      </button>
                    )}
                  </div>
                <div role="button" tabIndex={0} onClick={() => selectThread(thread.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') selectThread(thread.id); }}
                  onTouchStart={e => onThreadTouchStart(thread.id, e)}
                  onTouchMove={e => onThreadTouchMove(thread.id, e)}
                  onTouchEnd={() => onThreadTouchEnd(thread.id)}
                  onTouchCancel={() => onThreadTouchEnd(thread.id)}
                  style={{ width: '100%', textAlign: 'left', padding: '14px 16px', background: activeThread === thread.id ? '#EAF1FA' : '#FFFFFF', boxShadow: activeThread === thread.id ? 'inset 3px 0 0 #123C7C' : 'none', border: 'none', cursor: 'pointer', transform: `translateX(${ui.offset}px)`, transition: 'transform 0.15s ease-out' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: thread.unread ? 700 : 600, color: '#0A2044', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {thread.unread && <span style={{ width: '8px', height: '8px', background: '#DC2626', borderRadius: '50%', flexShrink: 0 }} />}
                      {thread.user}
                    </span>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: thread.unread ? '#DC2626' : '#6B7280', whiteSpace: 'nowrap' }}>{fmtShortTime(thread.at) || thread.time}</span>
                  </div>
                  {thread.email && <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#6B7280', margin: '0 0 4px' }}>{thread.email}</p>}
                  {typingMap[thread.id] ? (
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#22C55E', fontWeight: 600, margin: 0, fontStyle: 'italic' }}>typing…</p>
                  ) : (
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: thread.unread ? '#6B7280' : '#6B7280', fontWeight: thread.unread ? 600 : 400, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.preview}</p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                    {ui.confirm ? (
                      <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button onClick={e => { e.stopPropagation(); confirmDeleteThread(thread.id, thread.user); }}
                          disabled={ui.busy}
                          style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#fff', background: '#DC2626', border: 'none', padding: '4px 10px', cursor: ui.busy ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {ui.busy ? 'DELETING…' : 'CONFIRM DELETE'}
                        </button>
                        <button onClick={e => { e.stopPropagation(); setRowUi(thread.id, { confirm: false, offset: 0 }); }}
                          style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#0A2044', background: '#fff', border: '1px solid #DCE3EC', padding: '4px 8px', cursor: 'pointer' }}
                        >✕</button>
                      </span>
                    ) : (
                      <button onClick={e => { e.stopPropagation(); setRowUi(thread.id, { confirm: true, offset: -96 }); }}
                        style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#92400E', background: 'none', border: '1px solid #EAB308', padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >DELETE</button>
                    )}
                  </div>
                </div>
                </div>
                );
              })}
            </div>

            {/* Thread view */}
            <div className={`admin-convo${activeThread ? ' admin-convo-open' : ''}`} style={{ display: 'flex', flexDirection: 'column', background: '#fff' }}>
              {/* Conversation header — back button shows only on mobile */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: '1px solid #DCE3EC', flexShrink: 0 }}>
                <button className="convo-back" onClick={() => { setActiveThread(null); setMessages([]); }}
                  aria-label="Back to conversations"
                  style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#0A2044', background: '#fff', border: '1px solid #DCE3EC', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>
                  ← BACK
                </button>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 700, color: '#0A2044', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {threads.find(t => t.id === activeThread)?.user || 'Conversation'}
                </span>
              </div>
              <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {!activeThread ? (
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#6B7280', textAlign: 'center', marginTop: '40px' }}>Select a conversation to reply.</p>
                ) : messages.map((m, i) => (
                  <div key={m.id || i} style={{ display: 'flex', flexDirection: m.from === 'admin' ? 'row-reverse' : 'row', gap: '10px', alignItems: 'flex-end' }}>
                    <div style={{ maxWidth: '72%', background: m.from === 'admin' ? '#123C7C' : '#EEF2F7', color: m.from === 'admin' ? '#fff' : '#0A2044', borderRadius: '10px', padding: '10px 14px' }}>
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
                    <div style={{ width: '28px', height: '28px', background: '#EEF2F7', border: '1px solid #DCE3EA', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A2044', fontWeight: 700, fontSize: '11px' }}>…</div>
                    <div style={{ background: '#EEF2F7', color: '#0A2044', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center' }}>
                      <TypingDots />
                    </div>
                  </div>
                )}
              </div>
              <div style={{ borderTop: '1px solid #DCE3EA', padding: '12px 16px', display: 'flex', gap: '10px', position: 'relative', flexShrink: 0 }}>
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
          <div style={{ border: '1px solid #DCE3EC', borderRadius: '12px', background: '#FFFFFF', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #DCE3EC', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search name or email…"
                aria-label="Search users"
                style={{ width: '100%', maxWidth: '320px', background: '#FFFFFF', border: '1px solid #DCE3EC', borderRadius: '8px', padding: '8px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }}
              />
              <button
                onClick={() => { setAddOpen(o => !o); setAddError(''); }}
                style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', color: '#fff', background: '#123C7C', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {addOpen ? '✕ CLOSE' : '+ ADD CUSTOMER'}
              </button>
            </div>
            {addOpen && (
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #DCE3EC', background: '#F8FAFD', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '13px', color: '#0A2044' }}>
                  Open a new customer account — the customer can log in immediately with these details
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name *"
                    style={addInputStyle} />
                  <input value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="Email *"
                    style={addInputStyle} />
                  <input value={addForm.password} onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} placeholder="Password * (min 4)"
                    style={addInputStyle} />
                  <input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone"
                    style={addInputStyle} />
                  <input value={addForm.balance} onChange={e => setAddForm(f => ({ ...f, balance: e.target.value }))} placeholder="Opening balance $" type="number" min="0" step="0.01"
                    style={{ ...addInputStyle, maxWidth: '160px' }} />
                  <select value={addForm.type} onChange={e => setAddForm(f => ({ ...f, type: e.target.value }))}
                    style={{ ...addInputStyle, maxWidth: '130px' }}>
                    <option value="personal">Personal</option>
                    <option value="business">Business</option>
                  </select>
                  <button onClick={createAccount} disabled={addBusy}
                    style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#fff', background: addBusy ? '#6B7280' : '#1E7A4C', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: addBusy ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                    {addBusy ? 'CREATING…' : 'CREATE ACCOUNT'}
                  </button>
                </div>
                {addError && <p style={{ margin: 0, fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#DC2626' }}>{addError}</p>}
              </div>
            )}
            {users.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#374151' }}>
                No users yet. Anyone who signs up or logs in will show up here.
              </div>
            ) : visibleUsers.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#6B7280' }}>
                No users match “{userSearch}”.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', minWidth: '1150px', borderCollapse: 'collapse', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#F4F6F9' }}>
                    {['Name', 'Email', 'Account # (From)', 'ACH Destination (To)', 'Type', 'Balance', 'Status', 'Banking & Digits', 'Card', 'Last Login', 'Joined', 'Logins'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Balance' ? 'right' : 'left', color: '#123C7C', fontWeight: 600, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #DCE3EC', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((u, i) => (
                    <tr key={u.email} style={{ borderBottom: i < visibleUsers.length - 1 ? '1px solid #DCE3EC' : 'none', verticalAlign: 'top' }}>
                      <td style={{ padding: '11px 16px', color: '#0A2044', fontWeight: 600 }}>
                        {editingUser === u.email ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
                            <input
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              placeholder="Name"
                              style={{ background: '#FFFFFF', border: '1px solid #DCE3EC', padding: '5px 8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }}
                            />
                            <input
                              value={editPhone}
                              onChange={e => setEditPhone(e.target.value)}
                              placeholder="Phone"
                              style={{ background: '#FFFFFF', border: '1px solid #DCE3EC', padding: '5px 8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }}
                            />
                            <input
                              value={editAccountNumber}
                              onChange={e => setEditAccountNumber(e.target.value)}
                              placeholder="Account number (leave empty to keep)"
                              style={{ background: '#FFFFFF', border: '1px solid #DCE3EC', padding: '5px 8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }}
                            />
                            <input
                              value={editPassword}
                              onChange={e => setEditPassword(e.target.value)}
                              placeholder="New password (leave empty to keep)"
                              style={{ background: '#FFFFFF', border: '1px solid #DCE3EC', padding: '5px 8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }}
                            />
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => saveUserProfile(u)}
                                disabled={savingUser || !u.serverId}
                                style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#fff', background: '#1E7A4C', border: 'none', padding: '5px 10px', cursor: savingUser ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                              >{savingUser ? 'SAVING…' : 'SAVE'}</button>
                              <button
                                onClick={() => setEditingUser(null)}
                                style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#0A2044', background: '#fff', border: '1px solid #DCE3EC', padding: '5px 8px', cursor: 'pointer' }}
                              >✕</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {u.name}
                            {u.password && (
                              <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 400, color: '#6B7280', margin: '3px 0 0', wordBreak: 'break-word' }}>Password: {u.password}</p>
                            )}
                            {profileDetails(u).map(line => (
                              <p key={line} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 400, color: '#6B7280', margin: '3px 0 0', wordBreak: 'break-word' }}>{line}</p>
                            ))}
                            {u.serverId && (
                              <button
                                onClick={() => { setEditingUser(u.email); setEditName(u.name); setEditEmail(u.email); setEditPhone(u.phone || ''); setEditPassword(''); setEditAccountNumber(u.accountNumber || ''); }}
                                style={{ display: 'block', marginTop: '6px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#fff', background: '#123C7C', border: 'none', padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >EDIT</button>
                            )}
                          </>
                        )}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#6B7280' }}>
                        {editingUser === u.email ? (
                          <input
                            value={editEmail}
                            onChange={e => setEditEmail(e.target.value)}
                            placeholder="Email"
                            style={{ width: '100%', minWidth: '160px', background: '#FFFFFF', border: '1px solid #DCE3EC', padding: '5px 8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }}
                          />
                        ) : u.email}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#0A2044', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600 }}>{u.accountNumber || '—'}</span>
                      </td>
                      <td style={{ padding: '11px 16px', color: '#0A2044', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: '#123C7C' }}>
                              ••••• {u.achBankName || 'Bank'} ending {u.achLast4 || deriveAchLast4(u.accountNumber || u.email)} ({u.achType || 'ACH'})
                            </div>
                            {u.achRouting && (
                              <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px' }}>
                                RT: {u.achRouting} {u.achAccountName ? `· ${u.achAccountName}` : ''}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => openBankingModal(u)}
                            title="Edit ACH and banking details for this client"
                            style={{
                              background: '#EEF4FF',
                              border: '1px solid #C7D5EE',
                              borderRadius: '4px',
                              padding: '3px 8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#123C7C',
                              cursor: 'pointer',
                            }}
                          >
                            ✏️ Edit ACH
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '11px 16px', color: '#0A2044', textTransform: 'capitalize' }}>{u.type}</td>
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
                              style={{ width: '100px', background: '#FFFFFF', border: '1px solid #DCE3EC', padding: '5px 8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none', textAlign: 'right' }}
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
                              style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#0A2044', background: '#fff', border: '1px solid #DCE3EC', padding: '5px 8px', cursor: 'pointer' }}
                            >✕</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                            <span style={{ color: '#0A2044', fontWeight: 600 }}>${(u.balance || 0).toFixed(2)}</span>
                            <button
                              onClick={() => { setEditingBalance(u.email); setBalanceInput((u.balance || 0).toFixed(2)); }}
                              style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#fff', background: '#123C7C', border: 'none', padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >EDIT</button>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        {u.status === 'verified' ? (
                          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#1E7A4C', whiteSpace: 'nowrap' }}>VERIFIED</span>
                        ) : (
                          <button
                            onClick={() => approve(u)}
                            disabled={verifying === u.email}
                            style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#fff', background: verifying === u.email ? '#6B7280' : '#1E7A4C', border: 'none', padding: '6px 14px', cursor: verifying === u.email ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                          >
                            {verifying === u.email ? 'VERIFYING…' : 'VERIFY'}
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => openBankingModal(u)}
                          style={{
                            fontFamily: 'IBM Plex Mono, monospace',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#fff',
                            background: '#123C7C',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 6px rgba(18,60,124,0.25)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span>⚙️</span> MANAGE & EDIT CLIENT
                        </button>
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        {editingCardUser === u.email ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
                            <input
                              value={editCardLast4}
                              onChange={e => setEditCardLast4(e.target.value)}
                              placeholder="Last 4 digits"
                              maxLength={4}
                              style={{ background: '#FFFFFF', border: '1px solid #DCE3EC', padding: '5px 8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }}
                            />
                            <input
                              value={editCardHolder}
                              onChange={e => setEditCardHolder(e.target.value)}
                              placeholder="Cardholder name"
                              style={{ background: '#FFFFFF', border: '1px solid #DCE3EC', padding: '5px 8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }}
                            />
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => { const sc = readCardScan(u.email) || { front: true, back: true, last4: '', holderName: '', scannedAt: '' }; sc.last4 = editCardLast4; sc.holderName = editCardHolder; sc.scannedAt = new Date().toISOString(); writeCardScan(u.email, sc); setEditingCardUser(null); }}
                                style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#fff', background: '#1E7A4C', border: 'none', padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >SAVE</button>
                              <button
                                onClick={() => setEditingCardUser(null)}
                                style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#0A2044', background: '#fff', border: '1px solid #DCE3EC', padding: '5px 8px', cursor: 'pointer' }}
                              >✕</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingCardUser(u.email); const sc = readCardScan(u.email) || { last4: '', holderName: '' }; setEditCardLast4(sc.last4 || ''); setEditCardHolder(sc.holderName || ''); }}
                            style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#fff', background: '#123C7C', border: 'none', padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >EDIT CARD</button>
                        )}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#6B7280' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: isOnlineNow(u.lastActiveAt) ? '#22C55E' : '#4B5563', boxShadow: isOnlineNow(u.lastActiveAt) ? '0 0 6px rgba(34,197,94,0.8)' : 'none' }} />
                          <span>
                            {fmtDateTime(u.lastLogin)}
                            {lastActiveLabel(u.lastActiveAt) && (
                              <span style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 600, color: isOnlineNow(u.lastActiveAt) ? '#22C55E' : '#9CA3AF', marginTop: '2px' }}>
                                {lastActiveLabel(u.lastActiveAt)}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 16px', color: '#6B7280' }}>{fmtDateTime(u.joined)}</td>
                      <td style={{ padding: '11px 16px', color: '#6B7280' }}>
                        {(() => {
                          const label = loginCountLabel(u.serverId);
                          const history = u.serverId ? loginHistory[u.serverId] : undefined;
                          const open = !!(u.serverId && expandedLogins[u.serverId]);
                          const busy = !!(u.serverId && loginsBusy[u.serverId]);
                          if (!u.serverId) return <span style={{ color: '#6B7280' }}>n/a</span>;
                          return (
                            <div>
                              <button onClick={() => toggleLogins(u.serverId)}
                                style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#6B7280', background: 'none', border: '1px solid #DCE3EC', padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                {busy ? 'LOADING…' : open ? 'HIDE LOGINS' : label || 'VIEW LOGINS'}
                              </button>
                              {open && (
                                <div style={{ marginTop: '8px', maxHeight: '160px', overflowY: 'auto', border: '1px solid #DCE3EC', background: '#F4F6F9' }}>
                                  {!history || history.length === 0 ? (
                                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', margin: 0, padding: '10px 12px' }}>No logins recorded yet.</p>
                                  ) : history.map(h => (
                                    <p key={h.id} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#0A2044', margin: 0, padding: '7px 12px', borderBottom: '1px solid #DCE3EC', whiteSpace: 'nowrap' }}>{fmtDateTime(h.loggedInAt)}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {/* Activity */}
        {tab === 'activity' && (
          <div style={{ border: '1px solid #DCE3EC', borderRadius: '12px', background: '#FFFFFF', overflow: 'hidden' }}>
            {/* Search + time-window filter chips */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #DCE3EC', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
              <input
                value={activitySearch}
                onChange={e => setActivitySearch(e.target.value)}
                placeholder="Search name, email or action…"
                aria-label="Search activity"
                style={{ flex: '1 1 220px', maxWidth: '340px', background: '#FFFFFF', border: '1px solid #DCE3EC', borderRadius: '8px', padding: '8px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {([['all', 'All time'], ['24h', '24 hours'], ['7d', '7 days'], ['30d', '30 days']] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setActivityRange(key)}
                    style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, padding: '6px 12px', borderRadius: '999px', cursor: 'pointer', whiteSpace: 'nowrap', background: activityRange === key ? '#123C7C' : '#fff', color: activityRange === key ? '#fff' : '#0A2044', border: `1px solid ${activityRange === key ? '#123C7C' : '#DCE3EC'}` }}>
                    {label}
                  </button>
                ))}
              </div>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                {activityFiltered.length} event{activityFiltered.length === 1 ? '' : 's'}
              </span>
            </div>
            {activity.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#374151' }}>
                No activity yet. Sign-ups, logins, deposits, and withdrawals from every device will appear here in real time.
              </div>
            ) : activityFiltered.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#6B7280' }}>
                No events match your search or time filter.
              </div>
            ) : (
              activityFiltered.map((a, i) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', padding: '14px 20px', borderBottom: i < activityFiltered.length - 1 ? '1px solid #DCE3EC' : 'none', background: a.action === 'signup' ? 'rgba(30, 122, 76, 0.06)' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', padding: '4px 10px', background: activityBadgeColor(a.action), color: '#fff', whiteSpace: 'nowrap' }}>
                      {ACTIVITY_LABELS[a.action] || String(a.action).toUpperCase()}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#0A2044', fontWeight: 600, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {a.name}{activityDetailSummary(a) ? ` — ${activityDetailSummary(a)}` : ''}
                      </p>
                      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#6B7280', margin: 0 }}>{a.email}{a.via === 'admin' ? '' : ` · via ${a.via === 'google' ? 'Google' : a.via === 'crypto' ? 'crypto deposit' : a.via === 'bank' ? 'bank' : 'email'}`}</p>
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
            <div style={{ border: '1px solid #DCE3EC', borderRadius: '12px', background: '#FFFFFF', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', fontWeight: 700, color: '#0A2044', margin: '0 0 4px', letterSpacing: '0.04em' }}>BTC (Bitcoin)</p>
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', margin: 0 }}>{BTC_NETWORK}</p>
                </div>
                <span style={{ fontSize: '12px', color: '#4779C4', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace' }}>BITCOIN</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <code style={{ flex: 1, fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#6B7280', background: '#F4F6F9', border: '1px solid #DCE3EC', padding: '12px 14px', wordBreak: 'break-all' }}>{DEPOSIT_ADDRESSES.BTC}</code>
                <button onClick={() => copyAddress('BTC', DEPOSIT_ADDRESSES.BTC)} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#fff', background: '#123C7C', border: 'none', padding: '10px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {copied === 'BTC' ? 'COPIED' : 'COPY'}
                </button>
              </div>
            </div>

            <div style={{ border: '1px solid #DCE3EC', borderRadius: '12px', background: '#FFFFFF', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', fontWeight: 700, color: '#0A2044', margin: '0 0 4px', letterSpacing: '0.04em' }}>USDT (ERC-20, Ethereum)</p>
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', margin: 0 }}>{USDT_NETWORK}</p>
                </div>
                <span style={{ fontSize: '12px', color: '#4779C4', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace' }}>ETHEREUM</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <code style={{ flex: 1, fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#6B7280', background: '#F4F6F9', border: '1px solid #DCE3EC', padding: '12px 14px', wordBreak: 'break-all' }}>{DEPOSIT_ADDRESSES['USDT-ERC20']}</code>
                <button onClick={() => copyAddress('USDT', DEPOSIT_ADDRESSES['USDT-ERC20'])} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#fff', background: '#123C7C', border: 'none', padding: '10px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {copied === 'USDT' ? 'COPIED' : 'COPY'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Card Tracking — admin management panel */}
        {tab === 'tracking' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {/* Header */}
            <div style={{ background: '#FFFFFF', border: '1px solid #DCE3EC', borderRadius: '12px 12px 0 0', padding: '20px 24px', borderBottom: '1px solid #DCE3EC' }}>
              <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '16px', color: '#0A2044', margin: '0 0 4px' }}>Card Delivery Tracking</h2>
              <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#6B7280', margin: 0 }}>
                Set each customer's delivery step. Changes reflect immediately on their dashboard.
              </p>
            </div>

            {/* Step reference legend */}
            <div style={{ background: '#F8FAFD', border: '1px solid #DCE3EC', borderTop: 'none', padding: '14px 24px', display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
              {TRACKING_STEPS.map((s, i) => (
                <span key={i} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#4779C4' }}>
                  <strong style={{ color: '#0A2044' }}>{i}</strong> — {s.label}
                </span>
              ))}
            </div>

            {/* User rows */}
            <div style={{ background: '#FFFFFF', border: '1px solid #DCE3EC', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
              {users.filter(u => u.serverId).length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#374151' }}>
                  No server-linked users yet. Once customers sign up through the shared server they will appear here.
                </div>
              ) : users.filter(u => u.serverId).map((u, idx, arr) => {
                const sid = u.serverId!;
                const tracking = trackingMap[sid];
                const busy = !!trackingBusy[sid];
                const open = !!trackingExpanded[sid];
                const form = trackingForm[sid] || { step: '0', note: '', estimatedDelivery: '', orderedAt: new Date().toISOString().slice(0, 10) };
                const saved = !!trackingSaved[sid];
                const err = trackingError[sid] || '';
                const isLast = idx === arr.filter(u => u.serverId).length - 1;

                return (
                  <div key={sid} style={{ borderBottom: isLast ? 'none' : '1px solid #DCE3EC' }}>
                    {/* Collapsed row */}
                    <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div style={{
                          width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                          background: tracking == null ? '#CBD5E0' : tracking.step === 4 ? '#1E7A4C' : '#4779C4',
                          boxShadow: tracking != null && tracking.step < 4 ? '0 0 6px rgba(71,121,196,0.6)' : 'none',
                        }} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', fontWeight: 600, color: '#0A2044', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</p>
                          <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', margin: 0 }}>{u.email}</p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        {tracking != null ? (
                          <span style={{
                            fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700,
                            color: tracking.step === 4 ? '#1E7A4C' : '#123C7C',
                            background: tracking.step === 4 ? '#F0FDF4' : '#EEF2FA',
                            border: `1px solid ${tracking.step === 4 ? '#BBF7D0' : '#C7D5EE'}`,
                            padding: '3px 10px',
                          }}>
                            {tracking.step === 4 ? '✓ DELIVERED' : `STEP ${tracking.step} — ${TRACKING_STEPS[tracking.step].label.toUpperCase()}`}
                          </span>
                        ) : (
                          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#9CA3AF', background: '#F4F6F9', border: '1px solid #DCE3EC', padding: '3px 10px' }}>
                            NOT STARTED
                          </span>
                        )}

                        <button
                          onClick={() => toggleTracking(sid)}
                          style={{
                            fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700,
                            color: '#fff', background: open ? '#6B7280' : '#123C7C',
                            border: 'none', padding: '7px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          {busy && !open ? 'LOADING…' : open ? '▲ COLLAPSE' : '▼ MANAGE'}
                        </button>
                      </div>
                    </div>

                    {/* Expanded editor */}
                    {open && (
                      <div style={{ background: '#F8FAFD', borderTop: '1px solid #DCE3EC', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* Step selector */}
                        <div>
                          <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4779C4', margin: '0 0 10px' }}>Delivery Step</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {TRACKING_STEPS.map((s, i) => {
                              const active = String(i) === form.step;
                              return (
                                <button
                                  key={i}
                                  onClick={() => patchForm(sid, { step: String(i) })}
                                  style={{
                                    fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: active ? 700 : 400,
                                    color: active ? '#fff' : '#374151',
                                    background: active ? (i === 4 ? '#1E7A4C' : '#123C7C') : '#FFFFFF',
                                    border: `1.5px solid ${active ? (i === 4 ? '#1E7A4C' : '#123C7C') : '#DCE3EC'}`,
                                    padding: '8px 14px', cursor: 'pointer', transition: 'all 0.12s',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                  }}
                                >
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: '18px', height: '18px', borderRadius: '50%',
                                    background: active ? 'rgba(255,255,255,0.25)' : '#F4F6F9',
                                    fontSize: '10px', fontWeight: 700,
                                    color: active ? '#fff' : '#6B7280',
                                  }}>{i}</span>
                                  {s.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Note */}
                        <div>
                          <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4779C4', display: 'block', marginBottom: '6px' }}>
                            Status Note <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional, shown to customer)</span>
                          </label>
                          <textarea
                            value={form.note}
                            onChange={e => patchForm(sid, { note: e.target.value })}
                            rows={2}
                            maxLength={200}
                            placeholder="e.g. Your card has been dispatched via FedEx. Expected in 2–3 days."
                            style={{
                              width: '100%', background: '#FFFFFF', border: '1px solid #DCE3EC',
                              padding: '10px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px',
                              color: '#0A2044', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        {/* Dates row */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                          <div style={{ flex: '1 1 180px' }}>
                            <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4779C4', display: 'block', marginBottom: '6px' }}>Order Date</label>
                            <input
                              type="date"
                              value={form.orderedAt}
                              onChange={e => patchForm(sid, { orderedAt: e.target.value })}
                              style={{ width: '100%', background: '#FFFFFF', border: '1px solid #DCE3EC', padding: '8px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div style={{ flex: '1 1 180px' }}>
                            <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4779C4', display: 'block', marginBottom: '6px' }}>Estimated Delivery</label>
                            <input
                              type="date"
                              value={form.estimatedDelivery}
                              onChange={e => patchForm(sid, { estimatedDelivery: e.target.value })}
                              style={{ width: '100%', background: '#FFFFFF', border: '1px solid #DCE3EC', padding: '8px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none', boxSizing: 'border-box' }}
                            />
                          </div>
                        </div>

                        {/* Live preview */}
                        {(() => {
                          const previewStep = parseInt(form.step, 10);
                          if (isNaN(previewStep)) return null;
                          const previewTracking = {
                            step: previewStep,
                            note: form.note,
                            estimatedDelivery: form.estimatedDelivery,
                            orderedAt: form.orderedAt,
                            updatedAt: tracking?.updatedAt || new Date().toISOString(),
                          };
                          return (
                            <div style={{ background: '#FFFFFF', border: '1px solid #DCE3EC', padding: '20px' }}>
                              <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', margin: '0 0 16px' }}>Preview — what the customer sees</p>
                              <CardTracking tracking={previewTracking} />
                            </div>
                          );
                        })()}

                        {err && (
                          <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#DC2626', margin: 0 }}>{err}</p>
                        )}
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <button
                            onClick={() => saveTracking(sid)}
                            disabled={busy}
                            style={{
                              fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 700,
                              color: '#fff', background: saved ? '#1E7A4C' : busy ? '#6B7280' : '#123C7C',
                              border: 'none', padding: '10px 24px', cursor: busy ? 'default' : 'pointer',
                              transition: 'background 0.2s',
                            }}
                          >
                            {busy ? 'SAVING…' : saved ? '✓ SAVED' : 'SAVE & PUBLISH'}
                          </button>

                          {tracking != null && (
                            <button
                              onClick={() => clearTracking(sid)}
                              disabled={busy}
                              style={{
                                fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700,
                                color: '#DC2626', background: '#fff',
                                border: '1px solid #DC2626', padding: '10px 16px', cursor: busy ? 'default' : 'pointer',
                              }}
                            >
                              CLEAR TRACKING
                            </button>
                          )}

                          <button
                            onClick={() => setTrackingExpanded(prev => ({ ...prev, [sid]: false }))}
                            style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', background: 'none', border: '1px solid #DCE3EC', padding: '10px 14px', cursor: 'pointer' }}
                          >
                            COLLAPSE
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Edit Banking Numbers & ACH Details Modal */}
      {bankingModalUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10, 32, 68, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px',
        }} onClick={() => setBankingModalUser(null)}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #DCE3EC',
            width: '100%',
            maxWidth: '700px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 45px rgba(10,32,68,0.25)',
            display: 'flex',
            flexDirection: 'column',
          }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #DCE3EC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFD' }}>
              <div>
                <h3 style={{ margin: '0 0 2px', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '16px', color: '#0A2044' }}>
                  Edit Banking Numbers & ACH Transfer
                </h3>
                <p style={{ margin: 0, fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280' }}>
                  Client: <strong style={{ color: '#0A2044' }}>{bankingModalUser.name}</strong> ({bankingModalUser.email})
                </p>
              </div>
              <button onClick={() => setBankingModalUser(null)} style={{ background: 'none', border: '1px solid #DCE3EC', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#6B7280' }}>✕</button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* Section 1: Source SSB Account (Withdrawal From:) */}
              <div style={{ background: '#F8FAFD', border: '1px solid #DCE3EC', borderRadius: '8px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '15px' }}>🏦</span>
                  <label style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '13px', color: '#0A2044' }}>
                    Source SSB Account Number (From:)
                  </label>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#6B7280', lineHeight: 1.4 }}>
                  Controls what is displayed in the client&apos;s Withdraw USD box under <strong>&ldquo;From:&rdquo;</strong> and on their dashboard profile.
                </p>
                <input
                  value={bankEditAccountNum}
                  onChange={e => setBankEditAccountNum(e.target.value)}
                  placeholder="e.g. Shield Safe Bank-53185986"
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#0A2044', outline: 'none' }}
                />
              </div>

              {/* Section 2: Destination Bank for Withdrawals (Withdrawal To:) */}
              <div style={{ background: '#F8FAFD', border: '1px solid #DCE3EC', borderRadius: '8px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '15px' }}>🏛️</span>
                  <label style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '13px', color: '#0A2044' }}>
                    ACH Transfer Destination Bank Details (To:)
                  </label>
                </div>
                <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#6B7280', lineHeight: 1.4 }}>
                  Controls what is displayed in the client&apos;s Withdraw USD box under <strong>&ldquo;To: ••••• [Bank] ending [Last 4] ([Type])&rdquo;</strong>.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#4779C4', marginBottom: '4px' }}>
                      DESTINATION BANK NAME
                    </label>
                    <input
                      value={bankEditAchBank}
                      onChange={e => setBankEditAchBank(e.target.value)}
                      placeholder="e.g. Bank, Chase, Wells Fargo"
                      style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#4779C4', marginBottom: '4px' }}>
                      LAST 4 DIGITS (ENDING)
                    </label>
                    <input
                      value={bankEditAchLast4}
                      onChange={e => setBankEditAchLast4(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                      placeholder="e.g. 4821"
                      maxLength={4}
                      style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#4779C4', marginBottom: '4px' }}>
                      ROUTING NUMBER (ABA 9-DIGITS)
                    </label>
                    <input
                      value={bankEditAchRouting}
                      onChange={e => setBankEditAchRouting(e.target.value.replace(/[^0-9]/g, '').slice(0, 9))}
                      placeholder="e.g. 021000021"
                      maxLength={9}
                      style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#4779C4', marginBottom: '4px' }}>
                      TRANSFER TYPE LABEL
                    </label>
                    <select
                      value={bankEditAchType}
                      onChange={e => setBankEditAchType(e.target.value)}
                      style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }}
                    >
                      <option value="ACH">ACH Transfer (Free, 1-3 days)</option>
                      <option value="Wire">Wire Transfer (Same day)</option>
                      <option value="Direct Deposit">Direct Deposit</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#4779C4', marginBottom: '4px' }}>
                      BENEFICIARY / ACCOUNT HOLDER NAME
                    </label>
                    <input
                      value={bankEditAchName}
                      onChange={e => setBankEditAchName(e.target.value)}
                      placeholder="e.g. Full Legal Name"
                      style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#4779C4', marginBottom: '4px' }}>
                      FULL ACCOUNT NUMBER (OPTIONAL)
                    </label>
                    <input
                      value={bankEditAchAccNum}
                      onChange={e => setBankEditAchAccNum(e.target.value)}
                      placeholder="e.g. 1029384756"
                      style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Debit Card & Cardholder Controls */}
              <div style={{ background: '#F8FAFD', border: '1px solid #DCE3EC', borderRadius: '8px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '15px' }}>💳</span>
                  <label style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '13px', color: '#0A2044' }}>
                    Client Debit / ATM Card Details & Settings
                  </label>
                </div>
                <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#6B7280', lineHeight: 1.4 }}>
                  Controls what is displayed on the client&apos;s physical & virtual card, last 4 digits, cardholder name, and security digits.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#4779C4', marginBottom: '4px' }}>CARDHOLDER NAME</label>
                    <input value={bankEditCardHolder} onChange={e => setBankEditCardHolder(e.target.value)} placeholder="e.g. Full Legal Name" style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#4779C4', marginBottom: '4px' }}>CARD LAST 4 DIGITS</label>
                    <input value={bankEditCardLast4} onChange={e => setBankEditCardLast4(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} maxLength={4} placeholder="e.g. 4821" style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#4779C4', marginBottom: '4px' }}>EXPIRY (MM/YY)</label>
                    <input value={bankEditCardExp} onChange={e => setBankEditCardExp(e.target.value)} maxLength={5} placeholder="e.g. 12/28" style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#4779C4', marginBottom: '4px' }}>SECURITY CVV</label>
                    <input value={bankEditCardCvv} onChange={e => setBankEditCardCvv(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} maxLength={4} placeholder="e.g. 834" style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#4779C4', marginBottom: '4px' }}>CARD BRAND</label>
                    <select value={bankEditCardBrand} onChange={e => setBankEditCardBrand(e.target.value)} style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }}>
                      <option value="Visa">Visa Debit</option>
                      <option value="Mastercard">Mastercard Debit</option>
                      <option value="Amex">American Express</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#4779C4', marginBottom: '4px' }}>CARD STATUS</label>
                    <select value={bankEditCardStatus} onChange={e => setBankEditCardStatus(e.target.value)} style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }}>
                      <option value="Active">Active (Unlocked)</option>
                      <option value="Frozen">Frozen / Suspended</option>
                      <option value="Locked">Locked (Security)</option>
                      <option value="Pending">Pending Activation</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#4779C4', marginBottom: '4px' }}>DAILY ATM / SPEND LIMIT</label>
                    <input value={bankEditDailyLimit} onChange={e => setBankEditDailyLimit(e.target.value)} placeholder="e.g. $5,000 / day" style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }} />
                  </div>
                </div>
              </div>

              {/* Section 4: Client Credentials & Profile */}
              <div style={{ background: '#F8FAFD', border: '1px solid #DCE3EC', borderRadius: '8px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '15px' }}>👤</span>
                  <label style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '13px', color: '#0A2044' }}>
                    Client Credentials, Balance & Verification
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#4779C4', marginBottom: '4px' }}>FULL NAME</label>
                    <input value={bankEditName} onChange={e => setBankEditName(e.target.value)} placeholder="e.g. Full Name" style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#4779C4', marginBottom: '4px' }}>EMAIL ADDRESS</label>
                    <input value={bankEditEmail} onChange={e => setBankEditEmail(e.target.value)} placeholder="client@example.com" style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#4779C4', marginBottom: '4px' }}>PHONE NUMBER</label>
                    <input value={bankEditPhone} onChange={e => setBankEditPhone(e.target.value)} placeholder="+1 555 010 2233" style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#4779C4', marginBottom: '4px' }}>PASSWORD (LEAVE BLANK TO KEEP)</label>
                    <input value={bankEditPassword} onChange={e => setBankEditPassword(e.target.value)} placeholder="New password" style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#4779C4', marginBottom: '4px' }}>ACCOUNT BALANCE (USD)</label>
                    <input type="number" step="0.01" value={bankEditBalance} onChange={e => setBankEditBalance(e.target.value)} placeholder="0.00" style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#4779C4', marginBottom: '4px' }}>KYC STATUS</label>
                    <select value={bankEditKycStatus} onChange={e => setBankEditKycStatus(e.target.value)} style={{ width: '100%', background: '#FFFFFF', border: '1px solid #C7D5EE', borderRadius: '6px', padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#0A2044', outline: 'none' }}>
                      <option value="verified">Verified (Approved)</option>
                      <option value="pending">Pending Review</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 5: Live Client Screen Preview */}
              <div style={{ background: '#EEF2FA', border: '1px dashed #4779C4', borderRadius: '8px', padding: '14px 16px' }}>
                <p style={{ margin: '0 0 8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#123C7C', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  👁️ LIVE CLIENT SCREEN PREVIEW (Updates in Real-Time):
                </p>
                <div style={{ background: '#F4F6F8', border: '1px solid #DCE3EA', padding: '12px 14px', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#374151', margin: 0 }}>
                    <strong>From:</strong> {bankEditAccountNum || 'Shield Safe Bank account'}
                  </p>
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#374151', margin: 0 }}>
                    <strong>To:</strong> ••••• {bankEditAchBank || 'Bank'} ending {bankEditAchLast4 || '••••'} ({bankEditAchType || 'ACH'})
                  </p>
                  {bankEditAchRouting && (
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', margin: 0 }}>
                      Routing (ABA): {bankEditAchRouting} {bankEditAchName ? `· ${bankEditAchName}` : ''}
                    </p>
                  )}
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#1E7A4C', margin: 0 }}>
                    💳 Card: •••• {bankEditCardLast4 || '••••'} ({bankEditCardHolder || 'Cardholder'}) · {bankEditCardStatus}
                  </p>
                </div>
              </div>

              {bankingNotice && (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '10px 14px', borderRadius: '6px', color: '#166534', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px' }}>
                  {bankingNotice}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #DCE3EC', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#F8FAFD' }}>
              <button
                onClick={() => setBankingModalUser(null)}
                style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 600, color: '#6B7280', background: '#FFFFFF', border: '1px solid #DCE3EC', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer' }}
              >
                CANCEL
              </button>
              <button
                onClick={saveBankingDetails}
                disabled={bankingSaving}
                style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 700, color: '#fff', background: '#1E7A4C', border: 'none', borderRadius: '6px', padding: '8px 20px', cursor: bankingSaving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(30,122,76,0.3)' }}
              >
                {bankingSaving ? 'SAVING & SYNCING…' : '✓ SAVE & SYNC REAL-TIME'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}