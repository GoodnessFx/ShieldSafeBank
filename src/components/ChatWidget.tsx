import { useState } from 'react';
import { Link } from 'react-router';
import { chatIdentity, pushChatMessage, getThreadMessages, markThreadRead, type ChatMessage } from '../lib/localStore';

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sent, setSent] = useState(false);

  const identity = chatIdentity();
  const signedIn = !!identity.email;

  function load() {
    const id = chatIdentity().id;
    setMessages(getThreadMessages(id));
  }

  function openChat() {
    setOpen(true);
    load();
    window.addEventListener('storage', load);
  }

  function closeChat() {
    setOpen(false);
    window.removeEventListener('storage', load);
  }

  function send() {
    if (!input.trim()) return;
    const who = chatIdentity();
    if (!who.email) return; // chats require a signed-in user
    pushChatMessage(who.id, who.user, who.email, input, 'user');
    load();
    markThreadRead(who.id);
    setSent(true);
    setInput('');
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
              <div key={i} style={{ display: 'flex', flexDirection: m.from === 'admin' ? 'row' : 'row-reverse', gap: '8px', alignItems: 'flex-end' }}>
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
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="Type a message..."
                style={{ flex: 1, border: '1px solid #DCE3EA', padding: '8px 10px', fontSize: '13px', color: '#0A2044', background: '#fff', outline: 'none' }}
                aria-label="Chat message"
              />
              <button onClick={send} style={{ background: '#123C7C', color: '#fff', border: 'none', padding: '8px 14px', cursor: 'pointer', fontWeight: 500, fontSize: '13px' }}>Send</button>
            </div>
          )}
            </>
          )}
        </div>
      )}

      {/* Trigger */}
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
  );
}