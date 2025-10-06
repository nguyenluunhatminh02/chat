const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function http(path: string, init?: RequestInit) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const userId = localStorage.getItem('x-user-id');
  const workspaceId = localStorage.getItem('x-workspace-id');
  const headers = new Headers(init?.headers);
  if (userId) headers.set('X-User-Id', userId);
  if (workspaceId) headers.set('X-Workspace-Id', workspaceId);
  return fetch(url, { ...init, headers });
}

async function json<T = unknown>(res: Response): Promise<T> {
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface ReadReceipt {
  userId: string;
  readAt: string;
  inferred: boolean;
}

export interface UnreadCount {
  conversationId: string;
  count: number;
  lastReadAt: string | null;
}

// Mark read up to message or timestamp
export async function markReadUpTo(
  conversationId: string,
  opts: { messageId?: string; at?: string }
): Promise<{ conversationId: string; newReadAt: string; messageId?: string }> {
  const res = await http(`/reads/conversations/${conversationId}/mark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  return json(res);
}

// Get unread count for conversation
export async function getUnreadCount(
  conversationId: string,
  includeSelf = false
): Promise<UnreadCount> {
  const res = await http(
    `/reads/conversations/${conversationId}/unread-count?includeSelf=${includeSelf}`
  );
  return json(res);
}

// Get unread summary for all conversations
export async function getUnreadSummary(): Promise<UnreadCount[]> {
  const res = await http('/reads/summary');
  return json(res);
}

// Get readers for a message
export async function getMessageReaders(messageId: string): Promise<{
  messageId: string;
  readers: ReadReceipt[];
}> {
  const res = await http(`/reads/messages/${messageId}/readers`);
  return json(res);
}
