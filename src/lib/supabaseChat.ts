/**
 * Supabase Realtime chat client.
 * Uses the Supabase publishable (anon) key only — never the service role key.
 */

import { supabase } from './supabase';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  from_role: 'user' | 'admin';
  text: string;
  created_at: string;
  read: boolean;
}

export interface ChatConversation {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export type ChatListener = (event: {
  type: 'message' | 'conversation' | 'typing' | 'read';
  payload: any;
}) => void;

let channel: any = null;
let currentListener: ChatListener | null = null;
let currentUserId: string | null = null;
let isAdmin = false;

/**
 * Subscribe to realtime chat updates.
 * - Customer: subscribes to their own conversation messages
 * - Admin: subscribes to all conversations and messages
 */
export function subscribeToChat(
  userId: string,
  listener: ChatListener,
  options: { admin?: boolean; conversationId?: string } = {}
): void {
  closeChatStream();
  currentListener = listener;
  currentUserId = userId;
  isAdmin = options.admin || false;

  const { admin = false, conversationId } = options;

  channel = supabase
    .channel('chat_realtime')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: admin ? '*' : `conversation_id=eq.${conversationId || ''}`,
      },
      (payload: any) => {
        currentListener?.({
          type: 'message',
          payload: payload.new as ChatMessage,
        });
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
        filter: admin ? '*' : `conversation_id=eq.${conversationId || ''}`,
      },
      (payload: any) => {
        currentListener?.({
          type: 'read',
          payload: payload.new as ChatMessage,
        });
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('[supabaseChat] Realtime subscription error:', status);
      }
    });
}

/** Close the realtime subscription. */
export function closeChatStream(): void {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  currentListener = null;
  currentUserId = null;
  isAdmin = false;
}

/** Get the current user's conversation, creating one if none exists. */
export async function getOrCreateConversation(userId: string): Promise<ChatConversation | null> {
  try {
    const { data: existing } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) return existing as ChatConversation;

    const convId = `conv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const { data: created, error } = await supabase
      .from('chat_conversations')
      .insert({ id: convId, user_id: userId, status: 'open' })
      .select()
      .single();

    if (error) {
      console.error('[supabaseChat] create conversation error:', error);
      return null;
    }
    return created as ChatConversation;
  } catch (err) {
    console.error('[supabaseChat] getOrCreateConversation error:', err);
    return null;
  }
}

/** Get messages for a conversation. */
export async function getConversationMessages(
  conversationId: string
): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[supabaseChat] fetch messages error:', error);
      return [];
    }
    return (data || []) as ChatMessage[];
  } catch (err) {
    console.error('[supabaseChat] getConversationMessages error:', err);
    return [];
  }
}

/** Send a message to a conversation. */
export async function sendChatMessage(
  conversationId: string,
  fromRole: 'user' | 'admin',
  text: string
): Promise<ChatMessage | null> {
  try {
    const msgId = `msg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        id: msgId,
        conversation_id: conversationId,
        from_role: fromRole,
        text: text.trim(),
        read: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[supabaseChat] send message error:', error);
      return null;
    }

    await supabase
      .from('chat_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data as ChatMessage;
  } catch (err) {
    console.error('[supabaseChat] sendChatMessage error:', err);
    return null;
  }
}

/** Mark messages in a conversation as read. */
export async function markMessagesRead(
  conversationId: string,
  fromRole: 'user' | 'admin'
): Promise<void> {
  try {
    const otherRole = fromRole === 'user' ? 'admin' : 'user';
    await supabase
      .from('chat_messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .eq('from_role', otherRole)
      .eq('read', false);
  } catch (err) {
    console.error('[supabaseChat] markMessagesRead error:', err);
  }
}

/** Get all conversations (admin only). */
export async function getAllConversations(): Promise<ChatConversation[]> {
  try {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[supabaseChat] fetch conversations error:', error);
      return [];
    }
    return (data || []) as ChatConversation[];
  } catch (err) {
    console.error('[supabaseChat] getAllConversations error:', err);
    return [];
  }
}

/** Close a conversation (admin). */
export async function closeConversation(conversationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chat_conversations')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', conversationId);
    return !error;
  } catch (err) {
    console.error('[supabaseChat] closeConversation error:', err);
    return false;
  }
}

/** Reopen a conversation (admin). */
export async function reopenConversation(conversationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chat_conversations')
      .update({ status: 'open', updated_at: new Date().toISOString() })
      .eq('id', conversationId);
    return !error;
  } catch (err) {
    console.error('[supabaseChat] reopenConversation error:', err);
    return false;
  }
}