import type { User } from '../types';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function http(path: string, init?: RequestInit) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  return fetch(url, init);
}
async function json<T = unknown>(res: Response): Promise<T> {
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json();
}

/* ========== Users ========== */
export async function listUsers(): Promise<User[]> {
  const res = await http('/users');
  return json<User[]>(res);
}
export async function createUser(body: { email: string; name?: string }) {
  const res = await http('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return json(res);
}

/* ========== Conversations ========== */
export async function listConversations(userId: string) {
  const workspaceId = localStorage.getItem('x-workspace-id') || 'ws_default';
  const res = await http('/conversations', { 
    headers: { 
      'X-User-Id': userId,
      'X-Workspace-Id': workspaceId,
    } 
  });
  return json(res);
}
export async function createConversation(
  userId: string,
  body: { type: 'DIRECT' | 'GROUP'; title?: string; members: string[] }
) {
  const workspaceId = localStorage.getItem('x-workspace-id') || 'ws_default';
  const res = await http('/conversations', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'X-User-Id': userId,
      'X-Workspace-Id': workspaceId,
    },
    body: JSON.stringify(body),
  });
  return json(res);
}

export async function removeMemberFromConversation(
  userId: string,
  conversationId: string,
  memberId: string,
  workspaceId: string
) {
  const res = await http(`/conversations/${conversationId}/members/${memberId}`, {
    method: 'DELETE',
    headers: { 'X-User-Id': userId ,'X-Workspace-Id': workspaceId,},
  });
  return json(res);
}

export async function addMemberToConversation(
  userId: string,
  conversationId: string,
  newMemberId: string,
  workspaceId: string
) {
  const res = await http(`/conversations/${conversationId}/members`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-User-Id': userId,
      'X-Workspace-Id': workspaceId,
    },
    body: JSON.stringify({ userId: newMemberId }),
  });
  return json(res);
}

/* ========== Messages ========== */
export async function listMessages(conversationId: string, cursor?: string, limit = 30, includeDeleted = false) {
  const qs = new URLSearchParams();
  if (cursor) qs.set('cursor', cursor);
  if (limit) qs.set('limit', String(limit));
  if (includeDeleted) qs.set('includeDeleted', '1');
  const res = await http(`/messages/${conversationId}?${qs.toString()}`);
  return json(res);
}

export async function sendMessageIdempotent(
  userId: string,
  body: { conversationId: string; type: 'TEXT' | 'IMAGE' | 'FILE'; content?: string; parentId?: string },
  opts: { key: string }
) {
  const res = await http('/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
      'Idempotency-Key': opts.key,
    },
    body: JSON.stringify(body),
  });
  return json(res);
}

export async function sendMessage(
  userId: string,
  body: { conversationId: string; type: 'TEXT' | 'IMAGE' | 'FILE'; content?: string; parentId?: string }
) {
  const res = await http('/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
    body: JSON.stringify(body),
  });
  return json(res);
}

export async function updateMessage(userId: string, id: string, body: { content: string }) {
  const res = await http(`/messages/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
    body: JSON.stringify(body),
  });
  return json(res);
}

export async function deleteMessage(userId: string, id: string) {
  const res = await http(`/messages/${id}`, { method: 'DELETE', headers: { 'X-User-Id': userId } });
  return json(res);
}

/* ========== Presence ========== */
export interface PresenceResponse {
  userId: string;
  online: boolean;
  lastSeen: string | null;
}

export async function getPresence(userId: string): Promise<PresenceResponse> {
  const res = await http(`/presence/${userId}`);
  return json<PresenceResponse>(res);
}

/* ========== Threads (reply) ========== */
export async function getThread(parentId: string, cursor?: string, limit = 30) {
  const qs = new URLSearchParams();
  if (cursor) qs.set('cursor', cursor);
  if (limit) qs.set('limit', String(limit));
  const res = await http(`/messages/thread/${parentId}?${qs.toString()}`);
  return json(res);
}

/* ========== Reactions ========== */
export async function listReactions(messageId: string) {
  const res = await http(`/reactions/${messageId}`);
  return json(res);
}
export async function toggleReaction(userId: string, body: { messageId: string; emoji: string }) {
  const res = await http('/reactions/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
    body: JSON.stringify(body),
  });
  return json(res);
}

/* ========== Files (Cloudflare R2 – Presigned PUT) ========== */
export async function filesPresignPut(filename: string, mime: string, sizeMax?: number) {
  const res = await http('/files/presign-put', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, mime, sizeMax }),
  });
  return json<{
    fileId: string; bucket: string; key: string; url: string; expiresIn: number; method: 'PUT';
  }>(res);
}

export function r2DirectPut(
  presign: { url: string },
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presign.url, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (!onProgress || !e.lengthComputable) return;
      onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`PUT ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(file);
  });
}

export async function filesComplete(fileId: string) {
  const res = await http('/files/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId }),
  });
  return json<{
    id: string; bucket: string; key: string; mime: string; size: number; status: 'READY'; thumbKey?: string | null;
  }>(res);
}

export async function filesCreateThumbnail(fileId: string, maxSize = 512) {
  const res = await http('/files/thumbnail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, maxSize }),
  });
  return json<{ thumbUrl: string; thumbKey?: string }>(res);
}

export async function filesPresignGet(key: string, expiresIn = 600) {
  const qs = new URLSearchParams({ key, expiresIn: String(expiresIn) });
  const res = await http(`/files/presign-get?${qs.toString()}`);
  return json<{ url: string }>(res);
}

/* ========== Search (Meilisearch) ========== */
export type SearchHit = {
  id: string;
  conversationId: string;
  senderId: string;
  type: string;
  content: string | null;
  createdAt: string;
  highlight?: string | null;
};

export async function searchMessages(
  q: string,
  opts: { conversationId?: string; limit?: number; offset?: number } = {},
) {
  const params = new URLSearchParams();
  params.set('q', q);
  if (opts.conversationId) params.set('conversationId', opts.conversationId);
  if (opts.limit != null) params.set('limit', String(opts.limit));
  if (opts.offset != null) params.set('offset', String(opts.offset));

  const res = await http('/search/messages?' + params.toString(), {
    headers: { 'Content-Type': 'application/json' },
  });
  return json<{
    query: string;
    limit: number;
    offset: number;
    estimatedTotalHits: number;
    hits: SearchHit[];
  }>(res);
}

/** NEW: lấy “cửa sổ” tin nhắn quanh 1 message (jump around) */
export async function getMessagesAround(
  userId: string,
  messageId: string,
  before = 20,
  after = 20,
) {
  const res = await http(
    `/messages/around/${encodeURIComponent(messageId)}?before=${before}&after=${after}`,
    { headers: { 'Content-Type': 'application/json', 'X-User-Id': userId } }
  );
  return json<{
    conversationId: string;
    anchorId: string;
    messages: unknown[];
  }>(res);
}

/* ========== Receipts (Read Status) ========== */
// NOTE: Moved to lib/reads.ts - using /reads endpoints instead of /receipts

/* ========== Typing Indicators ========== */
export async function getTypingUsers(conversationId: string) {
  const res = await http(`/presence/typing/${conversationId}`);
  return json<{
    conversationId: string;
    typing: string[];
  }>(res);
}

export async function getConversationPresence(conversationId: string) {
  const res = await http(`/presence/conversation/${conversationId}`);
  return json<{
    conversationId: string;
    counts: { total: number; online: number };
    online: string[];
    offline: string[];
  }>(res);
}

/* ========== Stars (Bookmarks) ========== */
export async function toggleStar(userId: string, messageId: string) {
  const res = await http('/stars/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
    body: JSON.stringify({ messageId }),
  });
  return json(res);
}

export async function listStars(
  userId: string,
  params?: { conversationId?: string; limit?: number; cursor?: string }
) {
  const query = new URLSearchParams();
  if (params?.conversationId) query.set('conversationId', params.conversationId);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.cursor) query.set('cursor', params.cursor);
  const qs = query.toString();
  const res = await http(`/stars${qs ? '?' + qs : ''}`, {
    headers: { 'X-User-Id': userId },
  });
  return json(res);
}

export async function checkStarFlags(userId: string, messageIds: string[]) {
  const res = await http('/stars/flags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
    body: JSON.stringify({ messageIds }),
  });
  return json<Record<string, boolean>>(res);
}

/* ========== Pins ========== */
export async function addPin(userId: string, messageId: string) {
  const res = await http('/pins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
    body: JSON.stringify({ messageId }),
  });
  return json(res);
}

export async function removePin(userId: string, messageId: string) {
  const res = await http(`/pins/${messageId}`, {
    method: 'DELETE',
    headers: { 'X-User-Id': userId },
  });
  return json(res);
}

export async function listPins(
  userId: string,
  conversationId: string,
  params?: { limit?: number; cursor?: string }
) {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.cursor) query.set('cursor', params.cursor);
  const qs = query.toString();
  const res = await http(`/pins/${conversationId}${qs ? '?' + qs : ''}`, {
    headers: { 'X-User-Id': userId },
  });
  return json(res);
}

/* ========== Push Notifications ========== */
export async function getPushPublicKey() {
  const res = await http('/push/public-key');
  return json<{ publicKey: string }>(res);
}

export async function subscribePush(userId: string, subscription: unknown) {
  const res = await http('/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
    body: JSON.stringify(subscription),
  });
  return json(res);
}

export async function unsubscribePush(endpoint: string) {
  const res = await http('/push/unsubscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });
  return json(res);
}

/* ========== Analytics ========== */
export async function getAnalyticsActive(userId: string, workspaceId: string, params: URLSearchParams) {
  const res = await http(`/analytics/active?${params}`, {
    headers: {
      'X-User-Id': userId,
      'X-Workspace-Id': workspaceId,
    },
  });
  return json(res);
}

export async function getAnalyticsRetention(userId: string, workspaceId: string, params: URLSearchParams) {
  const res = await http(`/analytics/retention?${params}`, {
    headers: {
      'X-User-Id': userId,
      'X-Workspace-Id': workspaceId,
    },
  });
  return json(res);
}

export async function getAnalyticsTopConversations(userId: string, workspaceId: string, params: URLSearchParams) {
  const res = await http(`/analytics/top-conversations?${params}`, {
    headers: {
      'X-User-Id': userId,
      'X-Workspace-Id': workspaceId,
    },
  });
  return json(res);
}
