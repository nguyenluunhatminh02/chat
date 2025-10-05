import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../lib/api';

export function useMessages(conversationId: string, cursor?: string) {
  return useQuery({
    queryKey: ['messages', conversationId, cursor],
    queryFn: async () => {
      console.log('🔥 Fetching messages for conversation:', conversationId);
      try {
        const result = await api.listMessages(conversationId, cursor);
        console.log('🔥 Messages API response:', result);
        return result;
      } catch (error) {
        console.error('🔥 Messages API error:', error);
        throw error;
      }
    },
    enabled: !!conversationId,
    // Avoid flicker on pagination / changes
    placeholderData: (prev) => prev,
    // Keep referential equality when data structurally equal
    structuralSharing: true,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ 
      userId, 
      data,
      eventKey
    }: { 
      userId: string; 
      data: { 
        conversationId: string;
        type: 'TEXT' | 'IMAGE' | 'FILE';
        content?: string;
        parentId?: string;
      };
      eventKey: string;
    }) => api.sendMessageIdempotent(userId, data, { key: eventKey }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['messages', variables.data.conversationId] 
      });
    },
  });
}

export function useUpdateMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ 
      userId, 
      messageId, 
      data 
    }: { 
      userId: string; 
      messageId: string; 
      data: { content: string } 
    }) => api.updateMessage(userId, messageId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ 
      userId, 
      messageId 
    }: { 
      userId: string; 
      messageId: string; 
    }) => api.deleteMessage(userId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}