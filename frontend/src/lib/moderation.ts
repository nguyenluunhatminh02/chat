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

// ============ BLOCKS ============

export interface Block {
  blockerId: string;
  blockedUserId: string;
  createdAt: string;
  expiresAt?: string | null;
}

export async function blockUser(userId: string, blockedUserId: string, expiresAt?: string) {
  const res = await http('/blocks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    body: JSON.stringify({ blockedUserId, expiresAt }),
  });
  return json<Block>(res);
}

export async function unblockUser(userId: string, blockedUserId: string) {
  const res = await http(`/blocks/${blockedUserId}`, {
    method: 'DELETE',
    headers: { 'X-User-Id': userId },
  });
  return json<{ ok: boolean }>(res);
}

export async function listBlocks(userId: string) {
  const res = await http('/blocks', {
    headers: { 'X-User-Id': userId },
  });
  return json<Block[]>(res);
}

// ============ REPORTS ============

export type ReportType = 'MESSAGE' | 'USER' | 'CONVERSATION';
export type ReportReason = 'SPAM' | 'ABUSE' | 'NSFW' | 'HARASSMENT' | 'OTHER';
export type ReportStatus = 'OPEN' | 'RESOLVED' | 'REJECTED';

export interface Report {
  id: string;
  reporterId: string;
  type: ReportType;
  targetMessageId?: string;
  targetUserId?: string;
  targetConversationId?: string;
  reason: ReportReason;
  details?: string;
  evidence?: any;
  status: ReportStatus;
  action?: string;
  resolutionNotes?: string;
  resolvedById?: string;
  createdAt: string;
  resolvedAt?: string;
}

export async function createReport(
  userId: string,
  data: {
    type: ReportType;
    targetMessageId?: string;
    targetUserId?: string;
    targetConversationId?: string;
    reason: ReportReason;
    details?: string;
  }
) {
  const res = await http('/moderation/reports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    body: JSON.stringify(data),
  });
  return json<Report>(res);
}

export async function listReports(isAdmin: boolean, status?: ReportStatus) {
  const url = status ? `/moderation/reports?status=${status}` : '/moderation/reports';
  const res = await http(url, {
    headers: isAdmin ? { 'X-Admin': '1' } : {},
  });
  return json<Report[]>(res);
}

export async function resolveReport(
  reportId: string,
  adminUserId: string,
  data: {
    action?: 'NONE' | 'DELETE_MESSAGE' | 'BLOCK_USER';
    resolutionNotes?: string;
  }
) {
  const res = await http(`/moderation/reports/${reportId}/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin': '1',
      'X-User-Id': adminUserId,
    },
    body: JSON.stringify(data),
  });
  return json<Report>(res);
}

// ============ GROUP MODERATION ============

export interface ConversationBan {
  conversationId: string;
  userId: string;
  bannedBy: string;
  reason?: string;
  createdAt: string;
  expiresAt?: string;
}

export async function kickMember(
  userId: string,
  conversationId: string,
  targetUserId: string
) {
  const res = await http(`/moderation/conversations/${conversationId}/kick`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    body: JSON.stringify({ userId: targetUserId }),
  });
  return json<{ ok: boolean; message: string }>(res);
}

export async function banMember(
  userId: string,
  conversationId: string,
  data: {
    userId: string;
    reason?: string;
    expiresAt?: string;
  }
) {
  const res = await http(`/moderation/conversations/${conversationId}/ban`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    body: JSON.stringify(data),
  });
  return json<{ ok: boolean; message: string }>(res);
}

export async function unbanMember(
  userId: string,
  conversationId: string,
  targetUserId: string
) {
  const res = await http(`/moderation/conversations/${conversationId}/ban/${targetUserId}`, {
    method: 'DELETE',
    headers: { 'X-User-Id': userId },
  });
  return json<{ ok: boolean; message: string }>(res);
}

export async function listBans(userId: string, conversationId: string) {
  const res = await http(`/moderation/conversations/${conversationId}/bans`, {
    headers: { 'X-User-Id': userId },
  });
  return json<ConversationBan[]>(res);
}

// ============ APPEALS ============

export type AppealStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Appeal {
  id: string;
  userId: string;
  reportId?: string;
  banId?: string;
  reason: string;
  status: AppealStatus;
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt: string;
  reviewedAt?: string;
}

export async function createAppeal(
  userId: string,
  data: {
    reportId?: string;
    banId?: string;
    reason: string;
  }
) {
  const res = await http('/moderation/appeals', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    body: JSON.stringify(data),
  });
  return json<Appeal>(res);
}

export async function listAppeals(isAdmin: boolean, status?: AppealStatus) {
  const url = status ? `/moderation/appeals?status=${status}` : '/moderation/appeals';
  const res = await http(url, {
    headers: isAdmin ? { 'X-Admin': '1' } : {},
  });
  return json<Appeal[]>(res);
}

export async function reviewAppeal(
  appealId: string,
  adminUserId: string,
  decision: 'APPROVED' | 'REJECTED',
  reviewNotes?: string
) {
  const res = await http(`/moderation/appeals/${appealId}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin': '1',
      'X-User-Id': adminUserId,
    },
    body: JSON.stringify({ decision, reviewNotes }),
  });
  return json<Appeal>(res);
}
