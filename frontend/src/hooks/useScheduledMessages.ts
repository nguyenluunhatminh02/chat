import { useState, useCallback } from 'react';
import { api } from '../lib/api';

export interface ScheduledMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  metadata?: any;
  scheduledFor: string;
  status: 'PENDING' | 'SENT' | 'CANCELLED' | 'FAILED';
  sentMessageId?: string;
  createdAt: string;
  updatedAt: string;
}

export function useScheduledMessages() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scheduleMessage = useCallback(async (data: {
    conversationId: string;
    content: string;
    scheduledFor: Date;
    metadata?: any;
  }): Promise<ScheduledMessage | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post<ScheduledMessage>('/scheduled-messages', {
        ...data,
        scheduledFor: data.scheduledFor.toISOString(),
      });
      return response.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to schedule message';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getUserScheduled = useCallback(async (): Promise<ScheduledMessage[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<ScheduledMessage[]>('/scheduled-messages/user');
      return response.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load scheduled messages';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getConversationScheduled = useCallback(async (conversationId: string): Promise<ScheduledMessage[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<ScheduledMessage[]>(`/scheduled-messages/conversation/${conversationId}`);
      return response.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load scheduled messages';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const updateScheduled = useCallback(async (
    id: string,
    data: {
      content?: string;
      scheduledFor?: Date;
      metadata?: any;
    }
  ): Promise<ScheduledMessage | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.put<ScheduledMessage>(`/scheduled-messages/${id}`, {
        ...data,
        scheduledFor: data.scheduledFor?.toISOString(),
      });
      return response.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update scheduled message';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelScheduled = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/scheduled-messages/${id}`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel scheduled message';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    scheduleMessage,
    getUserScheduled,
    getConversationScheduled,
    updateScheduled,
    cancelScheduled,
    loading,
    error,
  };
}
