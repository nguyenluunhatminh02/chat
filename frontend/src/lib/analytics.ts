import * as api from './api';

export interface ActiveUsersData {
  bucket: string;
  activeUsers: number;
  messages: number;
}

export interface RetentionCohort {
  cohortStartISO: string;
  size: number;
}

export interface RetentionMatrix {
  cohortStartISO: string;
  weekOffset: number;
  active: number;
}

export interface RetentionData {
  weeks: number;
  cohorts: RetentionCohort[];
  matrix: RetentionMatrix[];
}

export interface TopConversation {
  conversationId: string;
  title: string | null;
  type: string;
  messages: number;
  uniqueSenders: number;
  lastActivity: string;
}

export interface AnalyticsOptions {
  granularity?: 'day' | 'week' | 'month';
  range?: string; // "30d" | "2025-09-01|2025-10-02"
  tz?: string;
  weeks?: number;
  limit?: number;
}

/**
 * Get active users analytics (DAU/WAU/MAU)
 */
export async function getActiveUsers(
  workspaceId: string,
  options: AnalyticsOptions = {},
): Promise<ActiveUsersData[]> {
  const params = new URLSearchParams();
  if (options.granularity) params.append('granularity', options.granularity);
  if (options.range) params.append('range', options.range);
  if (options.tz) params.append('tz', options.tz);

  const userId = localStorage.getItem('x-user-id');
  if (!userId) {
    console.error('❌ Analytics: No user ID found in localStorage');
    throw new Error('No user ID');
  }

  return api.getAnalyticsActive(userId, workspaceId, params) as Promise<ActiveUsersData[]>;
}

/**
 * Get retention cohort analysis
 */
export async function getRetention(
  workspaceId: string,
  options: AnalyticsOptions = {},
): Promise<RetentionData> {
  const params = new URLSearchParams();
  if (options.weeks) params.append('weeks', options.weeks.toString());
  if (options.range) params.append('range', options.range);
  if (options.tz) params.append('tz', options.tz);

  const userId = localStorage.getItem('x-user-id');
  if (!userId) {
    console.error('❌ Analytics: No user ID found in localStorage');
    throw new Error('No user ID');
  }

  return api.getAnalyticsRetention(userId, workspaceId, params) as Promise<RetentionData>;
}

/**
 * Get top conversations by activity
 */
export async function getTopConversations(
  workspaceId: string,
  options: AnalyticsOptions = {},
): Promise<TopConversation[]> {
  const params = new URLSearchParams();
  if (options.range) params.append('range', options.range);
  if (options.limit) params.append('limit', options.limit.toString());

  const userId = localStorage.getItem('x-user-id');
  if (!userId) {
    console.error('❌ Analytics: No user ID found in localStorage');
    throw new Error('No user ID');
  }

  return api.getAnalyticsTopConversations(userId, workspaceId, params) as Promise<TopConversation[]>;
}
