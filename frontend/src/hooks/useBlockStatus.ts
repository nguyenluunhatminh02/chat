import { useQuery } from '@tanstack/react-query';
import { checkBlockStatus } from '../lib/moderation';

export function useBlockStatus(userId: string | undefined, otherUserId: string | undefined) {
  return useQuery({
    queryKey: ['blockStatus', userId, otherUserId],
    queryFn: () => checkBlockStatus(userId!, otherUserId!),
    enabled: !!userId && !!otherUserId && userId !== otherUserId,
    staleTime: 30000, // Cache for 30s
  });
}
