import { useState, useEffect, useCallback, useRef } from 'react';
import { realtime } from '../lib/realtime';

interface UseTypingOptions {
  conversationId: string | null;
  currentUserId: string | null;
  enabled?: boolean;
}

interface TypingState {
  typingUsers: string[];
  isTyping: (userId: string) => boolean;
  startTyping: () => void;
  stopTyping: () => void;
}

const TYPING_HEARTBEAT_INTERVAL = 2500; // 2.5s
const TYPING_TIMEOUT = 6000; // 6s

/**
 * Hook to manage typing indicators for a conversation
 */
export function useTyping({
  conversationId,
  currentUserId,
  enabled = true,
}: UseTypingOptions): TypingState {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen to typing.update events
  useEffect(() => {
    if (!enabled || !conversationId) {
      setTypingUsers([]);
      return;
    }

    const handleTypingUpdate = (event: {
      conversationId: string;
      typing: string[];
    }) => {
      if (event.conversationId === conversationId) {
        // Filter out current user from typing list
        const others = event.typing.filter((uid) => uid !== currentUserId);
        setTypingUsers(others);

        // Auto-hide after timeout (in case no more updates)
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        if (others.length > 0) {
          typingTimeoutRef.current = setTimeout(() => {
            setTypingUsers([]);
          }, TYPING_TIMEOUT);
        }
      }
    };

    realtime.on('typing.update', handleTypingUpdate);

    return () => {
      realtime.off('typing.update', handleTypingUpdate);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId, currentUserId, enabled]);

  // Start typing
  const startTyping = useCallback(() => {
    if (!conversationId || !currentUserId || !enabled) return;

    // Send typing.start event
    if (!isUserTyping) {
      realtime.emit('typing.start', { conversationId });
      setIsUserTyping(true);
    }

    // Setup heartbeat to keep typing alive
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    heartbeatIntervalRef.current = setInterval(() => {
      if (isUserTyping) {
        realtime.emit('typing.heartbeat', { conversationId });
      }
    }, TYPING_HEARTBEAT_INTERVAL);
  }, [conversationId, currentUserId, enabled, isUserTyping]);

  // Stop typing
  const stopTyping = useCallback(() => {
    if (!conversationId || !currentUserId || !enabled) return;

    if (isUserTyping) {
      realtime.emit('typing.stop', { conversationId });
      setIsUserTyping(false);
    }

    // Clear heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, [conversationId, currentUserId, enabled, isUserTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Check if a specific user is typing
  const isTyping = useCallback(
    (userId: string) => {
      return typingUsers.includes(userId);
    },
    [typingUsers],
  );

  return {
    typingUsers,
    isTyping,
    startTyping,
    stopTyping,
  };
}
