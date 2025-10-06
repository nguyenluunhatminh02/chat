const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface MentionSuggestion {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface MentionedMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: string;
  content: string | null;
  createdAt: string;
  mentionedAt: string;
}

export async function suggestMentions(
  conversationId: string,
  q?: string,
  limit = 8
): Promise<MentionSuggestion[]> {
  const userId = localStorage.getItem('x-user-id');
  const workspaceId = localStorage.getItem('x-workspace-id');
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (limit) params.set('limit', String(limit));

  const res = await fetch(
    `${BASE}/mentions/suggest/${conversationId}?${params}`,
    {
      headers: {
        'X-User-Id': userId || '',
        'X-Workspace-Id': workspaceId || '',
      },
    }
  );
  if (!res.ok)
    throw new Error(`Failed to get mention suggestions: ${res.statusText}`);
  return res.json();
}

export async function getMentionInbox(
  cursor?: string,
  limit = 30
): Promise<MentionedMessage[]> {
  const userId = localStorage.getItem('x-user-id');
  const workspaceId = localStorage.getItem('x-workspace-id');
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (limit) params.set('limit', String(limit));

  const res = await fetch(`${BASE}/mentions/inbox?${params}`, {
    headers: {
      'X-User-Id': userId || '',
      'X-Workspace-Id': workspaceId || '',
    },
  });
  if (!res.ok)
    throw new Error(`Failed to get mention inbox: ${res.statusText}`);
  return res.json();
}
