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
export function listMessages(conversationId: string, cursor?: string, limit = 30, includeDeleted = true) {
  const qs = new URLSearchParams();
  if (cursor) qs.set('cursor', cursor);
  if (limit) qs.set('limit', String(limit));
  if (includeDeleted) qs.set('includeDeleted', '1');
  return http(`/messages/${conversationId}${qs.toString() ? `?${qs.toString()}` : ''}`, { method: 'GET' });
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

// Update (edit) message
export function updateMessage(
  userId: string,
  id: string,
  data: { content: string }
): Promise<import('../types').Message> {
  return http(`/messages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, userId);
}

// Soft-delete message
export function deleteMessage(
  userId: string,
  id: string
): Promise<import('../types').Message> {
  return http(`/messages/${id}`, { method: 'DELETE' }, userId);
}


// List reactions for a message
export function listReactions(
  messageId: string
): Promise<Array<{ userId: string; emoji: string; createdAt: string }>> {
  return http(`/reactions/${messageId}`, { method: 'GET' });
}

// Toggle reaction (add/remove)
export function toggleReaction(
  userId: string,
  payload: { messageId: string; emoji: string }
): Promise<{ added?: true; removed?: true }> {
  return http('/reactions/toggle', { method: 'POST', body: JSON.stringify(payload) }, userId);
}

// Get thread (replies) of a parent message
export function getThread(parentId: string, cursor?: string, limit = 30) {
  const qs = new URLSearchParams();
  if (cursor) qs.set('cursor', cursor);
  if (limit) qs.set('limit', String(limit));
  return http(`/messages/thread/${parentId}${qs.toString() ? `?${qs.toString()}` : ''}`, { method: 'GET' });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
function uuidv4() {
  // xài Web Crypto nếu có, fallback nếu không
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Gửi 1 lần cho mỗi key; tự retry khi server trả 409 (IN_PROGRESS)
export async function sendMessageIdempotent(
  userId: string,
  payload: { conversationId: string; type: 'TEXT' | 'IMAGE' | 'FILE'; content?: string; parentId?: string },
  opts: { key?: string; maxRetry?: number; backoffMs?: number } = {}
) {
  const key = opts.key || uuidv4();
  const maxRetry = opts.maxRetry ?? 4;
  let backoff = opts.backoffMs ?? 150;

  // dùng httpRaw nếu bạn bật ở trên; còn không, dùng http hiện có và bắt message 409
  for (let attempt = 0; attempt <= maxRetry; attempt++) {
    try {
      // nếu bạn đã có http() sẵn:
      return await http(
        '/messages',
        { method: 'POST', body: JSON.stringify(payload), headers: { 'Idempotency-Key': key } },
        userId
      );
      // nếu dùng httpRaw:
      // return await httpRaw('/messages', { method: 'POST', body: JSON.stringify(payload), headers: { 'Idempotency-Key': key } }, userId);
    } catch (e: any) {
      const is409 =
        (typeof e?.status === 'number' && e.status === 409) ||
        (typeof e?.message === 'string' && e.message.includes('409'));

      if (is409 && attempt < maxRetry) {
        await sleep(backoff);
        backoff *= 2;
        continue;
      }
      throw e;
    }
  }
}