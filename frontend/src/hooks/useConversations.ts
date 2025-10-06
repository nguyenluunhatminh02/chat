import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../lib/api';

export function useConversations(userId: string) {
  return useQuery({
    queryKey: ['conversations', userId],
    queryFn: () => api.listConversations(userId),
    enabled: !!userId,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  const currentUserId = localStorage.getItem('x-user-id') || '';
  
  return useMutation({
    mutationFn: (data: { type: 'DIRECT' | 'GROUP'; title?: string; members: string[] }) => 
      api.createConversation(currentUserId, data),
    onSuccess: (result) => {
      console.log('🔄 Invalidating conversations after create:', result);
      // NOTE: This is backup invalidation, main one is in ChatPage.tsx
      queryClient.invalidateQueries({ queryKey: ['conversations', currentUserId] });
    },
    onError: (error) => {
      console.error('❌ Failed to create conversation:', error);
    },
  });
}