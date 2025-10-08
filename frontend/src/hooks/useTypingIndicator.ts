import { useRef, useCallback } from 'react';
import { api } from '../lib/api';

export function useTyping(conversationId: string) {
  const typingTimeoutRef = useRef<number | null>(null);
  const isTypingRef = useRef(false);

  const stopTyping = useCallback(() => {
    if (isTypingRef.current) {
      api.post('/presence/typing/stop', { conversationId }).catch(console.error);
      isTypingRef.current = false;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [conversationId]);

  const startTyping = useCallback(() => {
    if (!isTypingRef.current) {
      // Send typing start
      api.post('/presence/typing/start', { conversationId }).catch(console.error);
      isTypingRef.current = true;
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Auto-stop after 5 seconds of no activity
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 5000) as unknown as number;
  }, [conversationId, stopTyping]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    stopTyping();
  }, [stopTyping]);

  return {
    startTyping,
    stopTyping,
    cleanup,
  };
}
