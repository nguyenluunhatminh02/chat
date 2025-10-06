import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as readsApi from '../lib/reads';

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, opts }: { 
      conversationId: string; 
      opts: { messageId?: string; at?: string } 
    }) => readsApi.markReadUpTo(conversationId, opts),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['unread', variables.conversationId] });
      qc.invalidateQueries({ queryKey: ['unread-summary'] });
    },
  });
}

export function useUnreadCount(conversationId: string, includeSelf = false) {
  return useQuery({
    queryKey: ['unread', conversationId, includeSelf],
    queryFn: () => readsApi.getUnreadCount(conversationId, includeSelf),
    enabled: !!conversationId,
    placeholderData: (prev) => prev,
  });
}

export function useUnreadSummary() {
  return useQuery({
    queryKey: ['unread-summary'],
    queryFn: () => readsApi.getUnreadSummary(),
    placeholderData: (prev) => prev,
    staleTime: 30000, // 30s
  });
}

export function useMessageReaders(messageId: string) {
  return useQuery({
    queryKey: ['readers', messageId],
    queryFn: () => readsApi.getMessageReaders(messageId),
    enabled: !!messageId,
    retry: 1,
    staleTime: 10000, // 10s
  });
}
