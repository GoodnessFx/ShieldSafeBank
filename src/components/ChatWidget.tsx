import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { chatIdentity, pushChatMessage, getThreadMessages, markThreadRead, type ChatMessage, type ChatAttachment } from '../lib/localStore';
import { getMyChatThread, sendChatMessage, markMyChatRead, getChatPresence, sendChatTyping } from '../lib/api';
import { subscribeToChat, closeChatStream, type ChatEvent } from '../lib/chatTransport';

/** Quick-pick emojis for the composer — typing them directly works too. */
const CHAT_EMOJIS = ['😀','😊','😂','🥰','😍','😎','😌','😅','🤣','👍','👏','👋','👌','🫶','💯','✅','🔥','🎉','❤️','💰','🏦','📲','⏰','🙋'];

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

/** Three animated dots shown while the other side is typing. */
function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }} aria-label="typing">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </span>
  );
}

/** Mon–Fri, 9am–6pm in New York — the hours the widget advertises. */
function withinSupportHours(): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', hour12: false }).formatToParts(new Date());
    const day = parts.find(p => p.type === 'weekday')?.value || '';
    const hour = Number(parts.find(p => p.type === 'hour')?.value || '0');
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(day) && hour >= 9 && hour < 18;
  } catch {
    return false;
  }
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadBadge, setUnreadBadge] = useState(false);
  const [agentsConnected, setAgentsConnected] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const [quote, setQuote] = useState<ChatMessage | null>(null);
  const openRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const agentTypingTimer = useRef<number | null>(null);
  const typingSentAtRef = useRef(0);
  // Customers may send as many messages as they like, one after another, so
  // several requests can be in flight at once. Each send takes a ticket and only
  // the newest response is allowed to replace the list — an older one would be
  // missing the messages that followed it.
  const sendSeqRef = useRef(0);

  const identity = chatIdentity();
  const signedIn = !!identity.email;
  const seenKey = `ssb_chat_seen_${(identity.email || '').toLowerCase()}`;
  // Green while an agent's console is actually connected, or during the hours
  // the widget advertises. The dot is honest: it is not always on.
  const agentOnline = agentsConnected || withinSupportHours();

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

  // Live updates: admin replies appear the moment they are sent, "typing…" shows
  // as the agent types, and blue ticks update the instant the admin reads the
  // thread — all without waiting for the poll — even while the widget is closed.
  useEffect(() => {
    if (!signedIn) return;
    subscribeToChat('user', (event: ChatEvent) => {
      if (event.type === 'typing') {
        if (event.role !== 'admin') return;
        setAgentTyping(true);
        if (agentTypingTimer.current) window.clearTimeout(agentTypingTimer.current);
        agentTypingTimer.current = window.setTimeout(() => setAgentTyping(false), 3000);
        return;
      }
      if (event.type === 'read') {
        const updated = (event.messages || []).filter(m => m && typeof m.text === 'string');
        if (updated.length > 0) applyMessages(updated as ChatMessage[]);
        return;
      }
      const mine = (event.messages || []).filter(m => m && typeof m.text === 'string');
      if (mine.length === 0) return;
      const last = mine[mine.length - 1];
      // Reading the open widget instantly flips the agent's ticks to blue.
      if (last && last.from === 'admin' && openRef.current) markMyChatRead().catch(() => null);
      applyMessages(mine as ChatMessage[]);
    });
    return () => { if (agentTypingTimer.current) window.clearTimeout(agentTypingTimer.current); closeChatStream(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  // "Agent online" dot: checks whether an admin console holds the realtime
  // stream open. Refreshed every 20s; nothing here counts down anything the
  // customer would feel — it only updates the dot in the header.
  useEffect(() => {
    if (!signedIn) return;
    const check = () => {
      getChatPresence()
        .then(r => { if (r.ok && r.data) setAgentsConnected(!!r.data.agentOnline); })
        .catch(() => null);
    };
    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  // WhatsApp habit: the view always sits at the newest message.
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  // Messages live on the shared server (so they reach the admin on any device);
  // if the server is offline we fall back to the browser's local copy.
  //
  // The conversation is never hidden and never starts over: the history the
  // server holds is shown together with anything this browser sent while the
  // backend was unreachable (matched on text, since a message that made it to
  // the server gets the server's timestamp). Coming back later always shows
  // the whole thread.
  function messageKey(m: { text: string }) {
    return m.text;
  }

  /** Everything the server knows, plus this browser's messages the server is
   * still missing — never duplicated. */
  function mergeHistory(serverMsgs: ChatMessage[], localMsgs: ChatMessage[]): ChatMessage[] {
    const known = new Set(serverMsgs.map(messageKey));
    const extras = localMsgs.filter(m => !known.has(messageKey(m)));
    return [...serverMsgs, ...extras];
  }

  // Track messages already synced/in-flight so we never re-upload the same text.
  const syncedTextsRef = useRef<Set<string>>(new Set());

  // Recovery: a message written while no backend was reachable only ever existed
  // in that browser. When the server IS reachable we upload anything the server
  // is missing (matched on text, so the same words are never uploaded twice),
  // so messages like that are never lost.
  function syncLocalToServer(who: { id: string; user: string; email: string }, serverMsgs: ChatMessage[]): boolean {
    const localMsgs = getThreadMessages(who.id);
    if (localMsgs.length === 0) return false;
    const known = new Set(serverMsgs.map(messageKey));
    const missing = localMsgs.filter(m => m.from === 'user' && !known.has(messageKey(m)) && !syncedTextsRef.current.has(messageKey(m)));
    for (const m of missing) {
      syncedTextsRef.current.add(messageKey(m));
      sendChatMessage(m.text).catch(() => { syncedTextsRef.current.delete(messageKey(m)); });
    }
    return missing.length > 0;
  }

  async function load() {
    const who = chatIdentity();
    if (!who.email) return;
    try {
      const r = await getMyChatThread();
      if (r.ok && r.data) {
        // Upload what the server is missing, then show the merged thread so a
        // message can never vanish from view while it is still only local.
        if (syncLocalToServer(who, r.data.messages)) {
          const again = await getMyChatThread();
          if (again.ok && again.data) { applyMessages(mergeHistory(again.data.messages, getThreadMessages(who.id))); return; }
        }
        applyMessages(mergeHistory(r.data.messages, getThreadMessages(who.id)));
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

  /** Keeps a message in this browser when the shared server did not take it. */
  function storeLocally(who: { id: string; user: string; email: string }, text: string) {
    pushChatMessage(who.id, who.user, who.email, text, 'user');
    markThreadRead(who.id);
  }

  function send() {
    const text = input.trim();
    if (!text) return;
    const who = chatIdentity();
    if (!who.email) return; // chats require a signed-in user
    if (text.length > 2000) return;
    // Optimistic append: the customer sees their own message instantly, and the
    // input is cleared so they can immediately type the next one. Nothing here
    // blocks further messages — the conversation simply keeps every message
    // until the server confirms it.
    const tempId = `pending${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    setMessages(prev => [...prev, { id: tempId, from: 'user', text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), at: new Date().toISOString() }]);
    setInput('');
    const seq = ++sendSeqRef.current;
    const isNewest = () => seq === sendSeqRef.current;
    sendChatMessage(text)
      .then(r => {
        storeLocally(who, text);
        if (r.ok && r.data && r.data.messages) {
          // Only the newest response may replace the list: an older one would be
          // missing the messages sent after it. Merge against this browser's
          // copy so nothing the customer wrote can flash out of view.
          if (isNewest()) applyMessages(mergeHistory(r.data.messages as ChatMessage[], getThreadMessages(who.id)));
          return;
        }
        if (isNewest()) applyMessages(getThreadMessages(who.id));
      })
      .catch(() => {
        storeLocally(who, text);
        if (isNewest()) applyMessages(getThreadMessages(who.id));
      });
  }

  /** Throttled "typing…" heartbeat so the agent sees you're typing in realtime
   * without flooding the server on every keystroke. */
  function handleInput(value: string) {
    setInput(value);
    if (!value.trim()) return;
    const now = Date.now();
    if (now - typingSentAtRef.current > 1500) {
      typingSentAtRef.current = now;
      sendChatTyping().catch(() => null);
    }
  }

  return (
    <div className="chat-widget no-print" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 100 }}>
      {open && (
        <div className="chat-popup" style={{ background: '#fff', border: '1px solid #DCE3EA', boxShadow: '0 4px 24px rgba(10,32,68,0.10)', display: 'flex', flexDirection: 'column', marginBottom: '12px', maxHeight: '480px' }}>
          {/* Header */}
          <div style={{ background: '#123C7C', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '14px', color: '#fff' }}>Shield Safe Bank</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#A9C6E8', display: 'flex', alignItems: 'center', gap: '6px' }} title={agentOnline ? 'An agent is at the console right now' : 'Leave a message and we will reply'}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: agentOnline ? '#22C55E' : '#9CA3AF', boxShadow: agentOnline ? '0 0 0 2px rgba(34,197,94,0.25)' : 'none', flexShrink: 0 }} aria-hidden="true" />
                {agentOnline ? 'Agent online' : 'Support — we reply as soon as we can'}
              </p>
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
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '260px' }}>
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
                  <div style={{ maxWidth: '75%', padding: '8px 12px', background: m.from === 'user' ? '#123C7C' : '#F4F6F8', color: m.from === 'user' ? '#fff' : '#0A2044', fontSize: '13px', lineHeight: 1.5, cursor: 'pointer', position: 'relative' }} onClick={() => setQuote(m.id === quote?.id ? null : m)}>
                    {m.text}{m.attachment && renderAttachment(m.attachment)}
                    {quote && m.id === quote.id && (
                      <div style={{ marginTop: '6px', padding: '6px 8px', background: 'rgba(18,60,124,0.1)', borderRadius: '6px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#123C7C' }}>
                        <span style={{ fontWeight: 600 }}>replying to you:</span>
                      </div>
                    )}
                  </div>
                  {m.time && (
                    <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#9CA3AF', textAlign: m.from === 'user' ? 'right' : 'left', display: m.from === 'user' ? 'flex' : 'block', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                      {m.time}
                      {m.from === 'user' && <ReadTicks read={!!m.read} />}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Agent is typing… */}
            {agentTyping && (
              <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'flex-end' }}>
                <div style={{ width: '28px', height: '28px', background: '#123C7C', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L1.5 3.5V8C1.5 11.1 4 13.5 7 14C10 13.5 12.5 11.1 12.5 8V3.5L7 1Z" fill="#fff" /><rect x="5.5" y="6" width="3" height="3.5" rx="0.25" fill="none" stroke="#123C7C" strokeWidth="0.8" /><path d="M5.8 6V5.25C5.8 4.284 6.585 3.5 7.55 3.5" stroke="#123C7C" strokeWidth="0.8" strokeLinecap="square" /></svg>
                </div>
                <div style={{ background: '#F4F6F8', color: '#0A2044', padding: '10px 13px', display: 'flex', alignItems: 'center' }}>
                  <TypingDots />
                </div>
              </div>
            )}
          </div>

          {/* The composer is always available: a customer can send as many
              messages as they like, in any order, and nothing ever times out. */}
          <div style={{ borderTop: '1px solid #DCE3EA', padding: '10px', display: 'flex', gap: '8px', position: 'relative' }}>
            {emojiOpen && (
              <div style={{ position: 'absolute', bottom: '100%', left: '10px', marginBottom: '6px', background: '#fff', border: '1px solid #DCE3EA', boxShadow: '0 4px 16px rgba(10,32,68,0.12)', padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '3px', zIndex: 3 }} role="dialog" aria-label="Choose an emoji">
                {CHAT_EMOJIS.map(e => (
                  <button key={e} onClick={() => { setInput(prev => prev + e); setEmojiOpen(false); inputRef.current?.focus(); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '17px', lineHeight: 1, padding: '3px' }} aria-label={`Insert ${e}`}>{e}</button>
                ))}
              </div>
            )}
            <button onClick={() => setEmojiOpen(o => !o)} aria-label="Insert emoji" aria-expanded={emojiOpen}
              style={{ background: 'none', border: '1px solid #DCE3EA', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '4px 8px', color: '#0A2044', flexShrink: 0 }}>😊</button>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />
            <input
              ref={inputRef}
              value={input}
              onChange={e => handleInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setEmojiOpen(false); send(); } }}
              maxLength={2000}
              placeholder="Type a message..."
              style={{ flex: 1, minWidth: 0, border: '1px solid #DCE3EA', padding: '8px 10px', fontSize: '13px', color: '#0A2044', background: '#fff', outline: 'none' }}
              aria-label="Chat message"
            />
            {pendingAttachment && renderAttachment(pendingAttachment)}
            <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '4px 8px', color: '#0A2044', flexShrink: 0 }} aria-label="Attach file">📎</button>
            <button onClick={() => { setEmojiOpen(false); send(); }} style={{ background: '#123C7C', color: '#fff', border: 'none', padding: '8px 14px', cursor: 'pointer', fontWeight: 500, fontSize: '13px', flexShrink: 0 }}>Send</button>
          </div>
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

// New hooks and state for attachment handling
const fileInputRef = useRef<HTMLInputElement | null>(null);
const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);

function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const url = typeof reader.result === 'string' ? reader.result : '';
    const attachment: ChatAttachment = {
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      url,
    };
    setPendingAttachment(attachment);
  };
  reader.readAsDataURL(file);
}

function send() {
  const text = input.trim();
  if (!text && !pendingAttachment) return;
  const who = chatIdentity();
  if (!who.email) return;
  if (text.length > 2000) return;
  const tempId = `pending${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const optimisticMsg: ChatMessage = { id: tempId, from: 'user', text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), at: new Date().toISOString() };
  if (pendingAttachment) optimisticMsg.attachment = pendingAttachment;
  setMessages(prev => [...prev, optimisticMsg]);
  setInput('');
  setPendingAttachment(null);
  const seq = ++sendSeqRef.current;
  const isNewest = () => seq === sendSeqRef.current;
  sendChatMessage(text, pendingAttachment)
    .then(r => {
      storeLocally(who, text);
      if (r.ok && r.data && r.data.messages) {
        if (isNewest()) applyMessages(mergeHistory(r.data.messages as ChatMessage[], getThreadMessages(who.id)));
        return;
      }
      if (isNewest()) applyMessages(getThreadMessages(who.id));
    })
    .catch(() => {
      storeLocally(who, text);
      if (isNewest()) applyMessages(getThreadMessages(who.id));
    });
}

// Render attachment within messages
function renderAttachment(att: ChatAttachment) {
  if (att.type.startsWith('image/')) {
    return <img src={att.url} alt={att.name} style={{ maxWidth: '100%', borderRadius: '4px', marginTop: '6px' }} />;
  }
  if (att.type === 'application/pdf') {
    return (
      <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ color: '#123C7C', textDecoration: 'underline' }}>
        📄 {att.name}
      </a>
    );
  }
  return (
    <a href={att.url} download={att.name} style={{ color: '#123C7C', textDecoration: 'underline' }}>
      📎 {att.name}
    </a>
  );
}

// Modify message rendering to include attachment
// Replace the existing map block lines 297-311 with updated version