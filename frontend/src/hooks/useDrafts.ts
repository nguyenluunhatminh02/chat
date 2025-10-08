import { useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api';

export interface MessageDraft {
  conversationId: string;
  userId: string;
  content: string;
  metadata?: Record<string, unknown>;
  updatedAt: string;
}

export function useDrafts() {
  const [drafts, setDrafts] = useState<Map<string, MessageDraft>>(new Map());
  const [loading, setLoading] = useState(false);

  // Debounce timer
  const [saveTimers, setSaveTimers] = useState<Map<string, number>>(new Map());

  const deleteDraft = useCallback(async (conversationId: string): Promise<boolean> => {
    try {
      await api.delete(`/drafts/conversation/${conversationId}`);
      
      setDrafts(prev => {
        const next = new Map(prev);
        next.delete(conversationId);
        return next;
      });
      
      return true;
    } catch (error) {
      console.error('Failed to delete draft:', error);
      return false;
    }
  }, []);

  const saveDraft = useCallback(async (
    conversationId: string,
    content: string,
    metadata?: Record<string, unknown>,
    immediate = false
  ) => {
    // Clear existing timer
    const existingTimer = saveTimers.get(conversationId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const doSave = async () => {
      if (!content || content.trim() === '') {
        // Delete draft if empty
        await deleteDraft(conversationId);
        return;
      }

      try {
        const response = await api.post<MessageDraft>('/drafts', {
          conversationId,
          content,
          metadata,
        });

        setDrafts(prev => {
          const next = new Map(prev);
          next.set(conversationId, response.data);
          return next;
        });
      } catch (error) {
        console.error('Failed to save draft:', error);
      }
    };

    if (immediate) {
      await doSave();
    } else {
      // Debounce: save after 1 second of inactivity
      const timer = setTimeout(doSave, 1000) as unknown as number;
      setSaveTimers(prev => {
        const next = new Map(prev);
        next.set(conversationId, timer);
        return next;
      });
    }
  }, [saveTimers, deleteDraft]);

  const getDraft = useCallback(async (conversationId: string): Promise<MessageDraft | null> => {
    setLoading(true);
    try {
      const response = await api.get<MessageDraft>(`/drafts/conversation/${conversationId}`);
      const draft = response.data;
      
      if (draft) {
        setDrafts(prev => {
          const next = new Map(prev);
          next.set(conversationId, draft);
          return next;
        });
      }
      
      return draft;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getAllDrafts = useCallback(async (): Promise<MessageDraft[]> => {
    setLoading(true);
    try {
      const response = await api.get<MessageDraft[]>('/drafts/user');
      const draftList = response.data;
      
      setDrafts(prev => {
        const next = new Map(prev);
        draftList.forEach((draft: MessageDraft) => next.set(draft.conversationId, draft));
        return next;
      });
      
      return draftList;
    } catch (error) {
      console.error('Failed to load drafts:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getCachedDraft = useCallback((conversationId: string): MessageDraft | undefined => {
    return drafts.get(conversationId);
  }, [drafts]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      saveTimers.forEach(timer => clearTimeout(timer));
    };
  }, [saveTimers]);

  return {
    saveDraft,
    getDraft,
    deleteDraft,
    getAllDrafts,
    getCachedDraft,
    drafts,
    loading,
  };
}
