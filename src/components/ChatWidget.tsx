import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { chatIdentity, pushChatMessage, getThreadMessages, markThreadRead, type ChatMessage } from '../lib/localStore';
import { getMyChatThread, sendChatMessage, markMyChatRead } from '../lib/api';
import { subscribeToChat, closeChatStream, type ChatEvent } from '../lib/chatTransport';

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sent, setSent] = useState(false);
  const [unreadBadge, setUnreadBadge] = useState(false);
  const [sending, setSending] = useState(false);
  const openRef = useRef(false);

  const identity = chatIdentity();
  const signedIn = !!identity.email;
  const seenKey = `ssb_chat_seen_${(identity.email || '').toLowerCase()}`;

  function applyMessages(list: ChatMessage[]) {
    const normalized = list.map((m, i) => ({ ...m, id: m.id || `local${i}` }));
    setMessages(normalized);
    const last = normalized[normalized.length - 1];
    if (openRef.current) {
      if (last && last.at) localStorage.setItem(seenKey, String(last.at));
      setUnreadBadge(false);
    } else {
      const seen = localStorage.getItem(seenKey) || '';
      setUnreadBadge(!!(last && last.from === 'admin' && (!last.at || String(last.at) > seen)));
    }
  }

  useEffect(() => {
    if (!signedIn) return;
    load();
    const id = setInterval(() => { load().catch(() => null); }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  // Live updates: admin replies appear the moment they are sent, and the unread
  // badge lights up even while the widget is closed.
  useEffect(() => {
    if (!signedIn) return;
    subscribeToChat('user', (event: ChatEvent) => {
      const mine = event.messages.filter(m => m && typeof m.text === 'string');
      if (mine.length === 0) return;
      applyMessages(mine as ChatMessage[]);
    });
    return () => { closeChatStream(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  // Messages live on the shared server (so they reach the admin on any device);
  // if the server is offline we fall back to the browser's local copy.
  //
  // Recovery: a message written while no backend was reachable only ever existed
  // in that browser. When the server IS reachable we upload anything the server
  // is missing, so messages like that are never lost.
  function messageKey(m: { text: string; time?: string; at?: string }) {
    return `${m.at || m.time || ''}|${m.text}`;
  }

  function syncLocalToServer(who: { id: string; user: string; email: string }, serverMsgs: ChatMessage[]): boolean {
    const localMsgs = getThreadMessages(who.id);
    if (localMsgs.length === 0) return false;
    const serverKeys = new Set(serverMsgs.map(messageKey));
    const missing = localMsgs.filter(m => !serverKeys.has(messageKey(m)));
    for (const m of missing) sendChatMessage(m.text).catch(() => null);
    return missing.length > 0;
  }

  async function load() {
    const who = chatIdentity();
    if (!who.email) return;
    try {
      const r = await getMyChatThread();
      if (r.ok && r.data) {
        if (syncLocalToServer(who, r.data.messages)) {
          const again = await getMyChatThread();
          if (again.ok && again.data) { applyMessages(again.data.messages); return; }
        }
        applyMessages(r.data.messages);
        return;
      }
    } catch { /* fall back below */ }
    applyMessages(getThreadMessages(who.id));
  }

  function openChat() {
    setOpen(true);
    openRef.current = true;
    setUnreadBadge(false);
    load();
    window.addEventListener('storage', load);
    markMyChatRead().catch(() => null);
  }

  function closeChat() {
    setOpen(false);
    openRef.current = false;
    window.removeEventListener('storage', load);
    load(); // recompute the unread badge for the closed trigger
  }

  function send() {
    const text = input.trim();
    if (!text) return;
    const who = chatIdentity();
    if (!who.email) return; // chats require a signed-in user
    if (text.length > 2000) return;
    // Optimistic append: the customer sees their message instantly; the server
    // reply (or a live event) replaces it with the authoritative copy.
    const tempId = `pending${Date.now()}`;
    setMessages(prev => [...prev, { id: tempId, from: 'user', text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), at: new Date().toISOString() }]);
    setInput('');
    setSending(true);
    sendChatMessage(text).then(r => {
      setSending(false);
      if (r.ok && r.data && r.data.messages) applyMessages(r.data.messages as ChatMessage[]);
      else {
        pushChatMessage(who.id, who.user, who.email, text, 'user');
        markThreadRead(who.id);
        applyMessages(getThreadMessages(who.id));
      }
    }).catch(() => {
      setSending(false);
      pushChatMessage(who.id, who.user, who.email, text, 'user');
      applyMessages(getThreadMessages(who.id));
    });
    setSent(true);
  }

  return (
    <div className="chat-widget no-print" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 100 }}>
      {open && (
        <div className="chat-popup" style={{ background: '#fff', border: '1px solid #DCE3EA', boxShadow: '0 4px 24px rgba(10,32,68,0.10)', display: 'flex', flexDirection: 'column', marginBottom: '12px', maxHeight: '480px' }}>
          {/* Header */}
          <div style={{ background: '#123C7C', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '14px', color: '#fff' }}>Shield Safe Bank</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#A9C6E8' }}>Support</p>
            </div>
            <button onClick={closeChat} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px', fontSize: '18px', lineHeight: 1 }} aria-label="Close chat">&#x2715;</button>
          </div>

          {!signedIn ? (
            <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#0A2044', lineHeight: 1.5 }}>Please sign in to chat with our support team.</p>
              <Link to="/login" onClick={closeChat} style={{ background: '#123C7C', color: '#fff', border: 'none', padding: '10px 22px', fontWeight: 600, fontSize: '13px', textDecoration: 'none', cursor: 'pointer' }}>Sign in</Link>
            </div>
          ) : (
            <>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '260px' }}>
            {messages.length === 0 ? (
              <div style={{ padding: '8px 12px', background: '#F4F6F8', color: '#0A2044', fontSize: '13px', lineHeight: 1.5, maxWidth: '80%' }}>
                Talk to a real person. We're available Monday to Friday, 9am to 6pm EST.
              </div>
            ) : messages.map((m, i) => (
              <div key={m.id || i} style={{ display: 'flex', flexDirection: m.from === 'admin' ? 'row' : 'row-reverse', gap: '8px', alignItems: 'flex-end' }}>
                {m.from === 'admin' && <div style={{ width: '28px', height: '28px', background: '#123C7C', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L1.5 3.5V8C1.5 11.1 4 13.5 7 14C10 13.5 12.5 11.1 12.5 8V3.5L7 1Z" fill="#fff" /><rect x="5.5" y="6" width="3" height="3.5" rx="0.25" fill="none" stroke="#123C7C" strokeWidth="0.8" /><path d="M5.8 6V5.25C5.8 4.284 6.585 3.5 7.55 3.5" stroke="#123C7C" strokeWidth="0.8" strokeLinecap="square" /></svg>
                </div>}
                <div>
                  <div style={{ maxWidth: '75%', padding: '8px 12px', background: m.from === 'user' ? '#123C7C' : '#F4F6F8', color: m.from === 'user' ? '#fff' : '#0A2044', fontSize: '13px', lineHeight: 1.5 }}>
                    {m.text}
                  </div>
                  {m.time && <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#9CA3AF', textAlign: m.from === 'user' ? 'right' : 'left' }}>{m.time}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          {sent ? (
            <div style={{ borderTop: '1px solid #DCE3EA', padding: '16px', fontSize: '13px', color: '#1E7A4C' }}>
              Message received. One of our team members will reply here.
            </div>
          ) : (
            <div style={{ borderTop: '1px solid #DCE3EA', padding: '10px', display: 'flex', gap: '8px' }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !sending) send(); }}
                maxLength={2000}
                placeholder={sending ? 'Sending…' : 'Type a message...'}
                style={{ flex: 1, border: '1px solid #DCE3EA', padding: '8px 10px', fontSize: '13px', color: '#0A2044', background: '#fff', outline: 'none' }}
                aria-label="Chat message"
              />
              <button onClick={send} disabled={sending} style={{ background: '#123C7C', color: '#fff', border: 'none', padding: '8px 14px', cursor: sending ? 'default' : 'pointer', fontWeight: 500, fontSize: '13px', opacity: sending ? 0.6 : 1 }}>{sending ? '…' : 'Send'}</button>
            </div>
          )}
            </>
          )}
        </div>
      )}

      {/* Trigger */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        {unreadBadge && !open && (
          <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '14px', height: '14px', background: '#DC2626', border: '2px solid #fff', borderRadius: '50%', zIndex: 2 }} aria-label="You have an unread message" title="You have an unread message" />
        )}
        <button
          onClick={open ? closeChat : openChat}
          style={{ background: '#123C7C', color: '#fff', border: 'none', borderRadius: '50%', width: '52px', height: '52px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(18,60,124,0.25)', transition: 'background 0.15s' }}
          aria-label="Open support chat"
          onMouseEnter={e => { (e.target as HTMLElement).style.background = '#0B2B5C'; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.background = '#123C7C'; }}
        >
          {open ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5L15 15M15 5L5 15" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 3H19C19.552 3 20 3.448 20 4V14C20 14.552 19.552 15 19 15H7L3 19V4C3 3.448 3.448 3 4 3H3Z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="8" cy="9" r="1" fill="#fff" /><circle cx="11" cy="9" r="1" fill="#fff" /><circle cx="14" cy="9" r="1" fill="#fff" /></svg>
          )}
        </button>
      </div>
    </div>
  );
}