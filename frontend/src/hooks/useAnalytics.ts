import { useQuery } from '@tanstack/react-query';
import {
  getActiveUsers,
  getRetention,
  getTopConversations,
  type AnalyticsOptions,
} from '../lib/analytics';

/**
 * Hook to fetch active users data (DAU/WAU/MAU)
 */
export function useActiveUsers(
  workspaceId: string | undefined,
  options: AnalyticsOptions = {},
) {
  return useQuery({
    queryKey: ['analytics', 'active', workspaceId, options],
    queryFn: () => getActiveUsers(workspaceId!, options),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch retention cohort data
 */
export function useRetention(
  workspaceId: string | undefined,
  options: AnalyticsOptions = {},
) {
  return useQuery({
    queryKey: ['analytics', 'retention', workspaceId, options],
    queryFn: () => getRetention(workspaceId!, options),
    enabled: !!workspaceId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch top conversations
 */
export function useTopConversations(
  workspaceId: string | undefined,
  options: AnalyticsOptions = {},
) {
  return useQuery({
    queryKey: ['analytics', 'top', workspaceId, options],
    queryFn: () => getTopConversations(workspaceId!, options),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
