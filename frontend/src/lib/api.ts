// src/lib/api.ts
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function http(path: string, init?: RequestInit) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  return fetch(url, init);
}

async function json<T = any>(res: Response): Promise<T> {
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json();
}

/* ========== Users ========== */
export async function listUsers() {
  const res = await http('/users');
  return json(res);
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
  const res = await http('/conversations', { headers: { 'X-User-Id': userId } });
  return json(res);
}
export async function createConversation(
  userId: string,
  body: { type: 'DIRECT' | 'GROUP'; title?: string; members: string[] }
) {
  const res = await http('/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
    body: JSON.stringify(body),
  });
  return json(res);
}

/* ========== Messages ========== */
export async function listMessages(conversationId: string, cursor?: string, limit = 30, includeDeleted = false) {
  const qs = new URLSearchParams();
  if (cursor) qs.set('cursor', cursor);
  if (limit) qs.set('limit', String(limit));
  if (includeDeleted) qs.set('includeDeleted', '1'); // BE đang filter deletedAt=null; tham số này chỉ để tương thích
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
export async function getPresence(userId: string) {
  const res = await http(`/presence/${userId}`);
  return json(res);
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
/** Xin presigned PUT từ BE (R2 khuyên dùng) */
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

/** Upload trực tiếp lên R2 bằng XHR để track progress (%) */
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

/** Thông báo hoàn tất để BE HEAD/sniff & mark READY */
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

/** Yêu cầu BE tạo thumbnail (JPEG) và trả thumbUrl presigned */
export async function filesCreateThumbnail(fileId: string, maxSize = 512) {
  const res = await http('/files/thumbnail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, maxSize }),
  });
  return json<{ thumbUrl: string; thumbKey?: string }>(res);
}

/** Xin presigned GET cho object private */
export async function filesPresignGet(key: string, expiresIn = 600) {
  const qs = new URLSearchParams({ key, expiresIn: String(expiresIn) });
  const res = await http(`/files/presign-get?${qs.toString()}`);
  return json<{ url: string }>(res);
}
