import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getUsers, getActivity, getThreads, getThreadMessages, pushChatMessage, markThreadRead, verifyUser, ChatThread, ChatMessage, StoreUser, ActivityEvent } from '../../lib/localStore';
import { DEPOSIT_ADDRESSES, BTC_NETWORK, USDT_NETWORK } from '../../lib/config';
import BrandMark from '../../components/BrandMark';

type Tab = 'chat' | 'users' | 'activity' | 'deposits';

export default function AdminConsole() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('chat');
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<StoreUser[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [copied, setCopied] = useState<string>('');

  function reload() {
    setUsers(getUsers());
    setActivity(getActivity());
    setThreads(getThreads());
    if (activeThread) {
      setMessages(getThreadMessages(activeThread));
      markThreadRead(activeThread);
    } else if (getThreads().length > 0) {
      const first = getThreads()[0].id;
      setActiveThread(first);
      setMessages(getThreadMessages(first));
      markThreadRead(first);
    }
  }

  function selectThread(id: string) {
    setActiveThread(id);
    setMessages(getThreadMessages(id));
    markThreadRead(id);
    setThreads(getThreads());
  }

  function sendReply() {
    if (!chatInput.trim() || !activeThread) return;
    const thread = getThreads().find(t => t.id === activeThread);
    pushChatMessage(activeThread, thread ? thread.user : 'Customer', thread ? thread.email : '', chatInput, 'admin');
    markThreadRead(activeThread);
    setMessages(getThreadMessages(activeThread));
    setThreads(getThreads());
    setChatInput('');
  }

  function copyAddress(key: string, value: string) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    });
  }

  function approve(email: string) {
    verifyUser(email);
    reload();
  }

  function logout() { sessionStorage.removeItem('ssb_admin'); nav('/xk9-admin-console-7f3a'); }

  useEffect(() => { reload(); }, []);

  useEffect(() => {
    const id = setInterval(() => reload(), 5000);
    return () => clearInterval(id);
  }, []);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'chat', label: 'Chat Inbox' },
    { key: 'users', label: 'Users' },
    { key: 'activity', label: 'Activity' },
    { key: 'deposits', label: 'Deposit Addresses' },
  ];

  const pendingUsers = users.filter(u => u.status === 'pending');

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
      <div className="admin-tabs" style={{ background: '#12283F', borderBottom: '1px solid #1B3A5C', padding: '0 24px', display: 'flex', gap: '0' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); reload(); }}
            style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', padding: '12px 20px', background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid #4A7DA8' : '2px solid transparent', color: tab === t.key ? '#fff' : '#6B7280', cursor: 'pointer', letterSpacing: '0.04em', transition: 'color 0.12s', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {t.label}
            {t.key === 'users' && pendingUsers.length > 0 && (
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, background: '#EAB308', color: '#0F2338', padding: '1px 6px', borderRadius: '8px' }}>{pendingUsers.length}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {pendingUsers.length > 0 && (
          <div style={{ background: '#12283F', border: '1px solid #EAB308', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 700, color: '#EAB308', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {pendingUsers.length} account{pendingUsers.length === 1 ? '' : 's'} awaiting verification
              </span>
              <button onClick={() => { setTab('users'); }} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#E5E7EB', background: '#1B3A5C', border: '1px solid #1B3A5C', padding: '6px 12px', cursor: 'pointer' }}>VIEW USERS</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pendingUsers.map(u => (
                <div key={u.email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', border: '1px solid #1B3A5C', padding: '10px 14px', background: '#0F2338' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#E5E7EB', fontWeight: 600, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</p>
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#6B7280', margin: 0 }}>{u.email} · signed up {new Date(u.joined).toLocaleString()}</p>
                  </div>
                  <button onClick={() => approve(u.email)} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#fff', background: '#1E7A4C', border: 'none', padding: '8px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>VERIFY</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat */}
        {tab === 'chat' && (
          <div className="admin-chat" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 0, border: '1px solid #1B3A5C', height: '600px' }}>
            {/* Thread list */}
            <div style={{ borderRight: '1px solid #1B3A5C', overflowY: 'auto', background: '#12283F' }}>
              {threads.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#374151' }}>No chats yet. Messages from the app will appear here.</div>
              ) : threads.map(thread => (
                <button key={thread.id} onClick={() => selectThread(thread.id)}
                  style={{ width: '100%', textAlign: 'left', padding: '14px 16px', background: activeThread === thread.id ? '#1B3A5C' : 'none', border: 'none', borderBottom: '1px solid #1B3A5C', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 600, color: '#fff' }}>{thread.user}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#6B7280' }}>{thread.time}</span>
                  </div>
                  {thread.email && <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#6B7280', margin: '0 0 4px' }}>{thread.email}</p>}
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.preview}</p>
                  {thread.unread && <div style={{ width: '6px', height: '6px', background: '#4A7DA8', borderRadius: '50%', marginTop: '6px' }} />}
                </button>
              ))}
            </div>

            {/* Thread view */}
            <div style={{ display: 'flex', flexDirection: 'column', background: '#0F2338' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {!activeThread ? (
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#374151', textAlign: 'center', marginTop: '40px' }}>Select a conversation to reply.</p>
                ) : messages.map((m, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: m.from === 'admin' ? 'row-reverse' : 'row', gap: '10px', alignItems: 'flex-end' }}>
                    <div style={{ maxWidth: '72%', background: m.from === 'admin' ? '#1B3A5C' : '#12283F', border: '1px solid #1B3A5C', padding: '10px 14px' }}>
                      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#E5E7EB', margin: '0 0 4px', lineHeight: 1.5 }}>{m.text}</p>
                      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#6B7280', margin: 0, textAlign: m.from === 'admin' ? 'right' : 'left' }}>{m.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid #1B3A5C', padding: '12px 16px', display: 'flex', gap: '10px' }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendReply()}
                  placeholder="Type a reply…"
                  style={{ flex: 1, background: '#12283F', border: '1px solid #1B3A5C', padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#E5E7EB', outline: 'none' }} />
                <button onClick={sendReply} style={{ background: '#4A7DA8', color: '#fff', border: 'none', padding: '9px 18px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fontSize: '12px', cursor: 'pointer', letterSpacing: '0.04em' }}>SEND</button>
              </div>
            </div>
          </div>
        )}

        {/* Users */}
        {tab === 'users' && (
          <div style={{ border: '1px solid #1B3A5C', overflowX: 'auto' }}>
            {users.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#374151' }}>
                No users yet. Anyone who signs up or logs in will show up here.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#12283F' }}>
                    {['Name', 'Email', 'Type', 'Status', 'Last Login', 'Joined'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#4A7DA8', fontWeight: 600, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #1B3A5C', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.email} style={{ borderBottom: i < users.length - 1 ? '1px solid #1B3A5C' : 'none' }}>
                      <td style={{ padding: '11px 16px', color: '#E5E7EB', fontWeight: 600 }}>{u.name}</td>
                      <td style={{ padding: '11px 16px', color: '#A8C4DA' }}>{u.email}</td>
                      <td style={{ padding: '11px 16px', color: '#E5E7EB', textTransform: 'capitalize' }}>{u.type}</td>
                      <td style={{ padding: '11px 16px' }}>
                        {u.status === 'verified' ? (
                          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#34D399', whiteSpace: 'nowrap' }}>VERIFIED</span>
                        ) : (
                          <button onClick={() => approve(u.email)} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#fff', background: '#EAB308', border: 'none', padding: '6px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>VERIFY</button>
                        )}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#6B7280' }}>{new Date(u.lastLogin).toLocaleString()}</td>
                      <td style={{ padding: '11px 16px', color: '#6B7280' }}>{new Date(u.joined).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Activity */}
        {tab === 'activity' && (
          <div style={{ border: '1px solid #1B3A5C' }}>
            {activity.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#374151' }}>
                No activity yet. New sign-ups and logins will appear here in real time.
              </div>
            ) : (
              activity.map((a, i) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '14px 20px', borderBottom: i < activity.length - 1 ? '1px solid #1B3A5C' : 'none', background: a.action === 'signup' ? 'rgba(30, 122, 76, 0.06)' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', padding: '4px 10px', background: a.action === 'signup' ? '#1E7A4C' : a.action === 'verified' ? '#EAB308' : '#4A7DA8', color: '#fff', whiteSpace: 'nowrap' }}>
                      {a.action === 'signup' ? 'SIGNED UP' : a.action === 'verified' ? 'VERIFIED' : 'LOGGED IN'}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#E5E7EB', fontWeight: 600, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</p>
                      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#6B7280', margin: 0 }}>{a.email}{a.via === 'admin' ? '' : ` · via ${a.via === 'google' ? 'Google' : 'email'}`}</p>
                    </div>
                  </div>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', whiteSpace: 'nowrap' }}>{new Date(a.at).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Deposit addresses */}
        {tab === 'deposits' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px' }}>
            <div style={{ border: '1px solid #1B3A5C', background: '#12283F', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', fontWeight: 700, color: '#fff', margin: '0 0 4px', letterSpacing: '0.04em' }}>BTC — Bitcoin</p>
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', margin: 0 }}>{BTC_NETWORK}</p>
                </div>
                <span style={{ fontSize: '12px', color: '#4A7DA8', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace' }}>BITCOIN</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <code style={{ flex: 1, fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#A8C4DA', background: '#0F2338', border: '1px solid #1B3A5C', padding: '12px 14px', wordBreak: 'break-all' }}>{DEPOSIT_ADDRESSES.BTC}</code>
                <button onClick={() => copyAddress('BTC', DEPOSIT_ADDRESSES.BTC)} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#fff', background: '#4A7DA8', border: 'none', padding: '10px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {copied === 'BTC' ? 'COPIED' : 'COPY'}
                </button>
              </div>
            </div>

            <div style={{ border: '1px solid #1B3A5C', background: '#12283F', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', fontWeight: 700, color: '#fff', margin: '0 0 4px', letterSpacing: '0.04em' }}>USDT — ERC-20 (Ethereum)</p>
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', margin: 0 }}>{USDT_NETWORK}</p>
                </div>
                <span style={{ fontSize: '12px', color: '#4A7DA8', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace' }}>ETHEREUM</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <code style={{ flex: 1, fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#A8C4DA', background: '#0F2338', border: '1px solid #1B3A5C', padding: '12px 14px', wordBreak: 'break-all' }}>{DEPOSIT_ADDRESSES['USDT-ERC20']}</code>
                <button onClick={() => copyAddress('USDT', DEPOSIT_ADDRESSES['USDT-ERC20'])} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#fff', background: '#4A7DA8', border: 'none', padding: '10px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
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