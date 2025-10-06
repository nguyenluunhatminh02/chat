import { useQuery } from '@tanstack/react-query';
import { getLinkPreviewsForMessage } from '../lib/link-preview';

/**
 * Hook to fetch link previews for a message
 */
export function useLinkPreviews(messageId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['link-previews', messageId],
    queryFn: () => {
      if (!messageId) throw new Error('messageId is required');
      return getLinkPreviewsForMessage(messageId);
    },
    enabled: enabled && !!messageId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}
