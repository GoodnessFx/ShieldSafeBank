import { useState } from 'react';

interface Message {
  from: 'user' | 'agent';
  text: string;
  time: string;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'chat' | 'form'>('chat');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { from: 'agent', text: "Talk to a real person. We're available Mon–Fri, 9am–6pm EST.", time: '' },
  ]);
  const [formSent, setFormSent] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  function send() {
    if (!input.trim()) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(m => [...m, { from: 'user', text: input, time: now }]);
    setInput('');
    setTimeout(() => {
      setMessages(m => [...m, { from: 'agent', text: "No one is available right now. Leave us a message and we'll follow up within one business day.", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      setMode('form');
    }, 1200);
  }

  return (
    <div className="chat-widget no-print" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 100 }}>
      {open && (
        <div className="chat-popup" style={{ background: '#fff', border: '1px solid #DCE3EA', boxShadow: '0 4px 24px rgba(15,35,56,0.10)', display: 'flex', flexDirection: 'column', marginBottom: '12px', maxHeight: '480px' }}>
          {/* Header */}
          <div style={{ background: '#1B3A5C', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '14px', color: '#fff' }}>Shield Safe Bank</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#A8C4DA' }}>Support</p>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px', fontSize: '18px', lineHeight: 1 }} aria-label="Close chat">&#x2715;</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '260px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: m.from === 'user' ? 'row-reverse' : 'row', gap: '8px', alignItems: 'flex-end' }}>
                {m.from === 'agent' && <div style={{ width: '28px', height: '28px', background: '#1B3A5C', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L1.5 3.5V8C1.5 11.1 4 13.5 7 14C10 13.5 12.5 11.1 12.5 8V3.5L7 1Z" fill="#fff" /><rect x="5.5" y="6" width="3" height="3.5" rx="0.25" fill="none" stroke="#1B3A5C" strokeWidth="0.8" /><path d="M5.8 6V5.25C5.8 4.284 6.585 3.5 7.55 3.5" stroke="#1B3A5C" strokeWidth="0.8" strokeLinecap="square" /></svg>
                </div>}
                <div style={{ maxWidth: '75%', padding: '8px 12px', background: m.from === 'user' ? '#1B3A5C' : '#F4F6F8', color: m.from === 'user' ? '#fff' : '#0F2338', fontSize: '13px', lineHeight: 1.5 }}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input or form */}
          {mode === 'chat' ? (
            <div style={{ borderTop: '1px solid #DCE3EA', padding: '10px', display: 'flex', gap: '8px' }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="Type a message..."
                style={{ flex: 1, border: '1px solid #DCE3EA', padding: '8px 10px', fontSize: '13px', color: '#0F2338', background: '#fff', outline: 'none' }}
                aria-label="Chat message"
              />
              <button onClick={send} style={{ background: '#1B3A5C', color: '#fff', border: 'none', padding: '8px 14px', cursor: 'pointer', fontWeight: 500, fontSize: '13px' }}>Send</button>
            </div>
          ) : formSent ? (
            <div style={{ borderTop: '1px solid #DCE3EA', padding: '16px', fontSize: '13px', color: '#1E7A4C' }}>
              Message received. We'll follow up within one business day.
            </div>
          ) : (
            <div style={{ borderTop: '1px solid #DCE3EA', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                placeholder="Your name"
                value={formData.name}
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                style={{ border: '1px solid #DCE3EA', padding: '8px 10px', fontSize: '13px', outline: 'none' }}
              />
              <input
                placeholder="Email address"
                type="email"
                value={formData.email}
                onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                style={{ border: '1px solid #DCE3EA', padding: '8px 10px', fontSize: '13px', outline: 'none' }}
              />
              <textarea
                placeholder="How can we help?"
                value={formData.message}
                onChange={e => setFormData(f => ({ ...f, message: e.target.value }))}
                rows={3}
                style={{ border: '1px solid #DCE3EA', padding: '8px 10px', fontSize: '13px', resize: 'none', outline: 'none' }}
              />
              <button onClick={() => setFormSent(true)} style={{ background: '#1B3A5C', color: '#fff', border: 'none', padding: '9px', cursor: 'pointer', fontWeight: 500, fontSize: '13px' }}>Send message</button>
            </div>
          )}
        </div>
      )}

      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        style={{ background: '#1B3A5C', color: '#fff', border: 'none', borderRadius: '50%', width: '52px', height: '52px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(27,58,92,0.25)', transition: 'background 0.15s' }}
        aria-label="Open support chat"
        onMouseEnter={e => { (e.target as HTMLElement).style.background = '#12283F'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.background = '#1B3A5C'; }}
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
