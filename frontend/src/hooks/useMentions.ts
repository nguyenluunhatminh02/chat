import { useQuery } from '@tanstack/react-query';
import { suggestMentions, getMentionInbox } from '../lib/mentions';

export function useMentionSuggestions(conversationId: string, query?: string) {
  return useQuery({
    queryKey: ['mentionSuggestions', conversationId, query],
    queryFn: () => suggestMentions(conversationId, query),
    enabled: !!conversationId,
    staleTime: 30000, // 30s
  });
}

export function useMentionInbox() {
  const currentUserId = localStorage.getItem('x-user-id');

  return useQuery({
    queryKey: ['mentionInbox', currentUserId],
    queryFn: () => getMentionInbox(),
    enabled: !!currentUserId,
  });
}
