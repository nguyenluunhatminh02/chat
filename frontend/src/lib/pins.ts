const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function http(path: string, init?: RequestInit) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const userId = localStorage.getItem('x-user-id');
  const headers = new Headers(init?.headers);
  if (userId) headers.set('X-User-Id', userId);
  return fetch(url, { ...init, headers });
}

async function json<T = unknown>(res: Response): Promise<T> {
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface Pin {
  id: string;
  conversationId: string;
  messageId: string;
  pinnedBy: string;
  createdAt: string;
}

export interface PinnedMessage {
  id: string;
  pinnedAt: string;
  pinnedBy: string;
  message: {
    id: string;
    senderId: string;
    type: string;
    content: string;
    createdAt: string;
    editedAt: string | null;
    deletedAt: string | null;
  };
}

export async function addPin(messageId: string): Promise<Pin> {
  const res = await http('/pins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId }),
  });
  return json(res);
}

export async function removePin(messageId: string): Promise<{ ok: boolean }> {
  const res = await http(`/pins/${messageId}`, {
    method: 'DELETE',
  });
  return json(res);
}

export interface PinsResponse {
  items: PinnedMessage[];
  nextCursor: string | null;
}

export async function listPins(params: {
  conversationId: string;
  limit?: number;
  cursor?: string;
}): Promise<PinsResponse> {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  if (params.cursor) query.set('cursor', params.cursor);
  const qs = query.toString();
  const res = await http(`/pins/${params.conversationId}${qs ? '?' + qs : ''}`);
  return json(res);
}
