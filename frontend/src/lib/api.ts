import type { Conversation, ConversationType, Message, User } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function http<T>(path: string, opts: RequestInit = {}, userId?: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
      ...(userId ? { 'X-User-Id': userId } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as T;
}

// Users
export function listUsers(): Promise<User[]> {
  return http<User[]>('/users', { method: 'GET' });
}
export function createUser(data: { email: string; name?: string; avatarUrl?: string }): Promise<User> {
  return http<User>('/users', { method: 'POST', body: JSON.stringify(data) });
}

// Conversations
export function listConversations(userId: string): Promise<Conversation[]> {
  return http<Conversation[]>('/conversations', { method: 'GET' }, userId);
}
export function createConversation(
  userId: string,
  data: { type: ConversationType; title?: string; members: string[] }
): Promise<Conversation> {
  return http<Conversation>('/conversations', { method: 'POST', body: JSON.stringify(data) }, userId);
}

// Messages
export function listMessages(conversationId: string, cursor?: string, limit = 30): Promise<Message[]> {
  const qs = new URLSearchParams();
  if (cursor) qs.set('cursor', cursor);
  if (limit) qs.set('limit', String(limit));
  return http<Message[]>(`/messages/${conversationId}${qs.toString() ? `?${qs.toString()}` : ''}`, { method: 'GET' });
}
export function sendMessage(
  userId: string,
  data: { conversationId: string; type: 'TEXT' | 'IMAGE' | 'FILE'; content?: string; parentId?: string }
): Promise<Message> {
  return http<Message>('/messages', { method: 'POST', body: JSON.stringify(data) }, userId);
}


export function getPresence(userId: string): Promise<{ userId: string; online: boolean; lastSeen: string | null }> {
  return http(`/presence/${userId}`, { method: 'GET' });
}

export function beatPresence(userId: string): Promise<{ ok: boolean; userId: string; ttlSec: number }> {
  return http(`/presence/heartbeat`, { method: 'POST' }, userId);
}


// ===== Read Receipts / Unread =====
export function markRead(
  userId: string,
  payload: { conversationId: string; messageId: string }
): Promise<{ ok: boolean; conversationId: string; messageId: string; readAt: string }> {
  return http('/receipts/read', { method: 'POST', body: JSON.stringify(payload) }, userId);
}

export function getUnread(
  userId: string,
  conversationId: string
): Promise<{ conversationId: string; unread: number; since: string }> {
  return http(`/receipts/unread/${conversationId}`, { method: 'GET' }, userId);
}