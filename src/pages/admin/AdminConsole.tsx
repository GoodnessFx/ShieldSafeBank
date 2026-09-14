import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getAdminUsers, getAdminKyc, decideKyc as apiDecideKyc, getAdminTransactions, toggleHold as apiToggleHold, getAdminThreads, getAdminMessages, replyThread } from '../../lib/api';
import BrandMark from '../../components/BrandMark';

function mapAdminTx(t: { id: string; date: string; user: string; type: string; asset: string; usd: number; statusLabel: string; hold: boolean }) {
  return {
    id: t.id, date: t.date, user: t.user,
    type: t.type === 'deposit' ? 'Deposit' : 'Withdrawal',
    asset: t.asset,
    usd: '$' + t.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    status: t.statusLabel, hold: t.hold,
  };
}

type Tab = 'chat' | 'users' | 'txlog' | 'kyc';

const USERS = [
  { id: 'U001', name: 'Elena Vasquez', email: 'elena@example.com', status: 'Verified', balance: '$24,380.00', joined: '2025-08-02', kyc: 'Approved' },
  { id: 'U002', name: 'James Okonkwo', email: 'james.o@example.com', status: 'Verified', balance: '$7,915.50', joined: '2025-08-14', kyc: 'Approved' },
  { id: 'U003', name: 'Lin Wei', email: 'linwei@example.com', status: 'Pending KYC', balance: '$0.00', joined: '2025-09-11', kyc: 'In Review' },
  { id: 'U004', name: 'Amara Diallo', email: 'amara.d@example.com', status: 'Verified', balance: '$3,200.00', joined: '2025-09-01', kyc: 'Approved' },
  { id: 'U005', name: 'Marco Bellini', email: 'mbellini@example.com', status: 'Suspended', balance: '$0.00', joined: '2025-08-20', kyc: 'Rejected' },
];

const TX_LOG = [
  { id: 'T1091', date: '2025-09-12 14:22', user: 'Elena Vasquez', type: 'Deposit', asset: 'BTC', usd: '$16,875.83', status: 'Cleared', hold: false },
  { id: 'T1090', date: '2025-09-12 11:08', user: 'James Okonkwo', type: 'Withdrawal', asset: 'USD', usd: '$5,000.00', status: 'Cleared', hold: false },
  { id: 'T1089', date: '2025-09-11 09:44', user: 'Amara Diallo', type: 'Deposit', asset: 'USDT', usd: '$3,200.00', status: 'On Hold', hold: true },
  { id: 'T1088', date: '2025-09-10 18:55', user: 'Elena Vasquez', type: 'Withdrawal', asset: 'USD', usd: '$9,000.00', status: 'Cleared', hold: false },
];

const KYC_QUEUE = [
  { id: 'K001', name: 'Lin Wei', email: 'linwei@example.com', type: 'Personal', submitted: '2025-09-11', docs: 'Passport + Liveness', status: 'Pending' },
  { id: 'K002', name: 'Soleil Martin', email: 'soleil.m@example.com', type: 'Personal', submitted: '2025-09-12', docs: 'Driver\'s License + Liveness', status: 'Pending' },
];

const CHAT_THREADS = [
  { id: 'C001', user: 'Elena Vasquez', preview: 'My deposit hasn\'t confirmed yet...', time: '2:14 PM', unread: true },
  { id: 'C002', user: 'James Okonkwo', preview: 'Can I change my withdrawal bank?', time: 'Yesterday', unread: false },
];

export default function AdminConsole() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('chat');
  const [activeThread, setActiveThread] = useState<string | null>('C001');
  const [chatInput, setChatInput] = useState('');
  const [txLog, setTxLog] = useState(TX_LOG);
  const [kycQueue, setKycQueue] = useState(KYC_QUEUE);
  const [users, setUsers] = useState(USERS);
  const [chatThreads, setChatThreads] = useState(CHAT_THREADS);
  const [messages, setMessages] = useState<Record<string, { from: string; text: string; time: string }[]>>({
    C001: [
      { from: 'user', text: "My deposit hasn't confirmed yet. I sent 0.1 BTC two hours ago.", time: '2:14 PM' },
    ],
    C002: [
      { from: 'user', text: "Can I change my withdrawal bank account?", time: 'Yesterday' },
      { from: 'admin', text: "Yes, you can add a new bank from your dashboard under Withdraw > Manage payment methods.", time: 'Yesterday' },
    ],
  });

  useEffect(() => {
    getAdminUsers().then(r => { if (r.ok && r.data) setUsers(r.data); });
    getAdminKyc().then(r => { if (r.ok && r.data) setKycQueue(r.data); });
    getAdminTransactions().then(r => { if (r.ok && r.data) setTxLog(r.data.map(mapAdminTx)); });
    getAdminThreads().then(r => { if (r.ok && r.data) setChatThreads(r.data); getAdminMessages(activeThread || 'C001').then(m => { if (m.ok && m.data) setMessages(mm => ({ ...mm, [activeThread || 'C001']: m.data as { from: string; text: string; time: string }[] })); }); });
  }, []);

  function logout() { sessionStorage.removeItem('ssb_admin'); nav('/xk9-admin-console-7f3a'); }

  function sendMsg() {
    if (!chatInput.trim() || !activeThread) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(m => ({ ...m, [activeThread]: [...(m[activeThread] || []), { from: 'admin', text: chatInput, time }] }));
    replyThread(activeThread, chatInput);
    setChatInput('');
  }

  function toggleHold(id: string) {
    setTxLog(log => log.map(t => t.id === id ? { ...t, hold: !t.hold, status: t.hold ? 'Cleared' : 'On Hold' } : t));
    apiToggleHold(id);
  }

  function decideKyc(id: string, approve: boolean) {
    setKycQueue(q => q.filter(k => k.id !== id));
    apiDecideKyc(id, approve ? 'approve' : 'reject');
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'chat', label: 'Chat Inbox' },
    { key: 'users', label: 'Users' },
    { key: 'txlog', label: 'Transaction Log' },
    { key: 'kyc', label: `KYC Queue${kycQueue.length > 0 ? ` (${kycQueue.length})` : ''}` },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0F2338', color: '#E5E7EB' }}>
      {/* Header */}
      <div style={{ background: '#12283F', borderBottom: '1px solid #1B3A5C', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BrandMark height={18} white />
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#374151', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Admin Console</span>
        </div>
        <button onClick={logout} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' }}>LOG OUT</button>
      </div>

      {/* Tab nav */}
      <div style={{ background: '#12283F', borderBottom: '1px solid #1B3A5C', padding: '0 24px', display: 'flex', gap: '0' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', padding: '12px 20px', background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid #4A7DA8' : '2px solid transparent', color: tab === t.key ? '#fff' : '#6B7280', cursor: 'pointer', letterSpacing: '0.04em', transition: 'color 0.12s' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>

        {/* Chat */}
        {tab === 'chat' && (
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 0, border: '1px solid #1B3A5C', height: '600px' }}>
            {/* Thread list */}
            <div style={{ borderRight: '1px solid #1B3A5C', overflowY: 'auto', background: '#12283F' }}>
              {chatThreads.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#374151' }}>Nothing waiting right now.</div>
              ) : chatThreads.map(thread => (
                <button key={thread.id} onClick={() => { setActiveThread(thread.id); getAdminMessages(thread.id).then(r => { if (r.ok && r.data && (!messages[thread.id] || messages[thread.id].length === 0)) setMessages(mm => ({ ...mm, [thread.id]: r.data })); }); }}
                  style={{ width: '100%', textAlign: 'left', padding: '14px 16px', background: activeThread === thread.id ? '#1B3A5C' : 'none', border: 'none', borderBottom: '1px solid #1B3A5C', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 600, color: '#fff' }}>{thread.user}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#6B7280' }}>{thread.time}</span>
                  </div>
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.preview}</p>
                  {thread.unread && <div style={{ width: '6px', height: '6px', background: '#4A7DA8', borderRadius: '50%', marginTop: '6px' }} />}
                </button>
              ))}
            </div>

            {/* Thread view */}
            <div style={{ display: 'flex', flexDirection: 'column', background: '#0F2338' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeThread && (messages[activeThread] || []).map((m, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: m.from === 'admin' ? 'row-reverse' : 'row', gap: '10px', alignItems: 'flex-end' }}>
                    <div style={{ maxWidth: '72%', background: m.from === 'admin' ? '#1B3A5C' : '#12283F', border: '1px solid #1B3A5C', padding: '10px 14px' }}>
                      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#E5E7EB', margin: '0 0 4px', lineHeight: 1.5 }}>{m.text}</p>
                      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#6B7280', margin: 0, textAlign: m.from === 'admin' ? 'right' : 'left' }}>{m.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid #1B3A5C', padding: '12px 16px', display: 'flex', gap: '10px' }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()}
                  placeholder="Type a reply…"
                  style={{ flex: 1, background: '#12283F', border: '1px solid #1B3A5C', padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#E5E7EB', outline: 'none' }} />
                <button onClick={sendMsg} style={{ background: '#4A7DA8', color: '#fff', border: 'none', padding: '9px 18px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fontSize: '12px', cursor: 'pointer', letterSpacing: '0.04em' }}>SEND</button>
              </div>
            </div>
          </div>
        )}

        {/* Users */}
        {tab === 'users' && (
          <div style={{ border: '1px solid #1B3A5C', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#12283F' }}>
                  {['ID', 'Name', 'Email', 'Status', 'Balance', 'KYC', 'Joined'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#4A7DA8', fontWeight: 600, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #1B3A5C', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #1B3A5C' : 'none' }}>
                    <td style={{ padding: '11px 16px', color: '#6B7280' }}>{u.id}</td>
                    <td style={{ padding: '11px 16px', color: '#E5E7EB', fontWeight: 600 }}>{u.name}</td>
                    <td style={{ padding: '11px 16px', color: '#A8C4DA' }}>{u.email}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: u.status === 'Verified' ? '#1E7A4C' : u.status === 'Suspended' ? '#DC2626' : '#9A6B00', letterSpacing: '0.04em' }}>● {u.status}</span>
                    </td>
                    <td style={{ padding: '11px 16px', color: '#E5E7EB', textAlign: 'right' }}>{u.balance}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontSize: '10px', color: u.kyc === 'Approved' ? '#1E7A4C' : u.kyc === 'Rejected' ? '#DC2626' : '#9A6B00' }}>● {u.kyc}</span>
                    </td>
                    <td style={{ padding: '11px 16px', color: '#6B7280' }}>{u.joined}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Transaction log */}
        {tab === 'txlog' && (
          <div style={{ border: '1px solid #1B3A5C', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#12283F' }}>
                  {['ID', 'Date/Time', 'User', 'Type', 'Asset', 'USD', 'Status', 'Action'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#4A7DA8', fontWeight: 600, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #1B3A5C', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txLog.map((tx, i) => (
                  <tr key={tx.id} style={{ borderBottom: i < txLog.length - 1 ? '1px solid #1B3A5C' : 'none', background: tx.hold ? 'rgba(154, 107, 0, 0.08)' : 'transparent' }}>
                    <td style={{ padding: '11px 16px', color: '#6B7280' }}>{tx.id}</td>
                    <td style={{ padding: '11px 16px', color: '#6B7280' }}>{tx.date}</td>
                    <td style={{ padding: '11px 16px', color: '#E5E7EB' }}>{tx.user}</td>
                    <td style={{ padding: '11px 16px', color: tx.type === 'Deposit' ? '#1E7A4C' : '#4A7DA8' }}>{tx.type}</td>
                    <td style={{ padding: '11px 16px', color: '#A8C4DA' }}>{tx.asset}</td>
                    <td style={{ padding: '11px 16px', color: '#E5E7EB', textAlign: 'right', fontWeight: 600 }}>{tx.usd}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: tx.hold ? '#9A6B00' : '#1E7A4C', letterSpacing: '0.04em' }}>● {tx.status}</span>
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <button onClick={() => toggleHold(tx.id)}
                        style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 600, color: tx.hold ? '#1E7A4C' : '#9A6B00', background: 'none', border: '1px solid currentColor', padding: '3px 10px', cursor: 'pointer', letterSpacing: '0.04em', transition: 'color 0.12s' }}>
                        {tx.hold ? 'RELEASE' : 'HOLD'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* KYC queue */}
        {tab === 'kyc' && (
          <>
            {kycQueue.length === 0 ? (
              <div style={{ border: '1px solid #1B3A5C', padding: '60px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#374151' }}>
                Nothing waiting right now.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {kycQueue.map(item => (
                  <div key={item.id} style={{ border: '1px solid #1B3A5C', background: '#12283F', padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fontSize: '14px', color: '#E5E7EB', margin: '0 0 4px' }}>{item.name}</p>
                        <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#6B7280', margin: 0 }}>{item.email} · {item.type} · Submitted {item.submitted}</p>
                      </div>
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#9A6B00', fontWeight: 600, letterSpacing: '0.06em' }}>● {item.status}</span>
                    </div>
                    <div style={{ background: '#0F2338', border: '1px solid #1B3A5C', padding: '14px 16px', marginBottom: '16px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#A8C4DA' }}>
                      Documents: {item.docs}
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => decideKyc(item.id, true)}
                        style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: '11px', letterSpacing: '0.06em', background: '#1E7A4C', color: '#fff', border: 'none', padding: '9px 20px', cursor: 'pointer' }}>
                        APPROVE
                      </button>
                      <button onClick={() => decideKyc(item.id, false)}
                        style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: '11px', letterSpacing: '0.06em', background: 'none', color: '#DC2626', border: '1px solid #DC2626', padding: '9px 20px', cursor: 'pointer' }}>
                        REJECT
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
