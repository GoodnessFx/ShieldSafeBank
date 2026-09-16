/**
 * Realtime chat transport.
 *
 * Talks to the shared backend's Server-Sent-Events stream. It is deliberately
 * the ONLY module that knows how messages arrive in realtime — swapping to a
 * managed provider (Pusher, Ably, Firebase) later means rewriting this file
 * alone; every component keeps using the same subscribe() contract.
 */
import { getToken } from './api';
import { API_BASE } from './config';

export interface LiveMessage {
  id: string;
  from: 'user' | 'admin';
  text: string;
  time: string;
  at: string;
}

export interface LiveThread {
  id: string;
  user: string;
  email: string;
  unread: boolean;
}

export interface ChatEvent {
  eventId: number;
  threadId: string;
  messages: LiveMessage[];
  thread: LiveThread | null;
}

type Listener = (event: ChatEvent) => void;

let source: EventSource | null = null;
let currentListener: Listener | null = null;
let currentRole: 'user' | 'admin' | null = null;

function streamUrl(role: 'user' | 'admin'): string {
  // The stream must hit the same backend as the REST calls (API_BASE), not the
  // frontend origin: when the app is deployed as a static site there is no /api
  // proxy on its own host, so using window.location.origin here would silently
  // kill realtime and leave only the 5s polling fallback.
  const base = role === 'admin' ? `${API_BASE}/admin/chat/stream` : `${API_BASE}/chat/stream`;
  const t = role === 'admin' ? localStorage.getItem('ssb_admin_token') || '' : getToken();
  return `${base}?token=${encodeURIComponent(t)}`;
}

/** Opens (or re-opens) the realtime stream for the given role. */
export function subscribeToChat(role: 'user' | 'admin', listener: Listener): void {
  if (currentRole === role && source) return;
  closeChatStream();
  currentListener = listener;
  currentRole = role;
  try {
    source = new EventSource(streamUrl(role));
    source.addEventListener('chat', (e: MessageEvent) => {
      try { listener(JSON.parse((e as MessageEvent).data)); } catch { /* malformed frame — ignore */ }
    });
    source.onerror = () => { /* EventSource reconnects itself; polling covers gaps */ };
  } catch {
    source = null;
  }
}

export function closeChatStream(): void {
  if (source) { source.close(); source = null; }
  currentListener = null;
  currentRole = null;
}

export function chatStreamRole(): 'user' | 'admin' | null {
  return currentRole;
}
