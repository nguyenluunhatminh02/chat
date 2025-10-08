// src/hooks/useForwarding.ts
import { useCallback, useState } from 'react';
import { api } from '../lib/api';

export interface ForwardedFile {
  id: string;
  url?: string | null;
  key?: string | null;
  mime?: string | null;
  filename?: string | null;
  size?: number | null;
}

export interface ForwardedAttachment {
  id: string;
  fileId: string;
  file: ForwardedFile;
}

export interface ForwardedMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: string;
  content: string | null;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
  attachment: ForwardedAttachment[];
}

export interface ForwardResponse {
  success: boolean;
  forwardedCount: number;
  messages: ForwardedMessage[];
}

export interface ForwardMultipleItem {
  messageId: string;
  success: boolean;
  result?: ForwardResponse;
  error?: string;
}

export function useForwarding() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forwardMessage = useCallback(
    async (data: {
      messageId: string;
      targetConversationIds: string[];
      includeAttribution?: boolean;
    }): Promise<ForwardResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post<ForwardResponse>('/forwarding/forward', data);
        return res.data;
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || 'Failed to forward message');
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const forwardMultiple = useCallback(
    async (data: {
      messageIds: string[];
      targetConversationId: string;
      includeAttribution?: boolean;
    }): Promise<ForwardMultipleItem[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post<ForwardMultipleItem[]>('/forwarding/forward-multiple', data);
        return res.data;
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || 'Failed to forward messages');
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getForwardingInfo = useCallback(async (messageId: string) => {
    setError(null);
    try {
      const res = await api.get('/forwarding/info/' + messageId);
      return res.data as
        | {
            isForwarded: boolean;
            originalMessageId: string;
            originalConversationId: string;
            originalSenderId: string;
            showAttribution?: boolean;
          }
        | null;
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load forwarding info');
      return null;
    }
  }, []);

  return { forwardMessage, forwardMultiple, getForwardingInfo, loading, error }

}