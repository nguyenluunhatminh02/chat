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

export interface Workspace {
  id: string;
  name: string;
  role: 'MEMBER' | 'ADMIN' | 'OWNER';
  joinedAt: string;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: 'MEMBER' | 'ADMIN' | 'OWNER';
  joinedAt: string;
}

// Create workspace
export async function createWorkspace(name: string): Promise<{ id: string; name: string; createdAt: string }> {
  const res = await http('/workspaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return json(res);
}

// Get my workspaces
export async function getMyWorkspaces(): Promise<Workspace[]> {
  const res = await http('/workspaces/mine');
  return json(res);
}

// Add member to workspace
export async function addWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: 'MEMBER' | 'ADMIN' = 'MEMBER'
): Promise<{ ok: boolean }> {
  const res = await http(`/workspaces/${workspaceId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, role }),
  });
  return json(res);
}

// List workspace members
export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const res = await http(`/workspaces/${workspaceId}/members`);
  return json(res);
}
