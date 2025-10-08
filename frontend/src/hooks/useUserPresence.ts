import { useState, useCallback, useEffect } from 'react';
import { useAppContext } from './useAppContext';
import io, { Socket } from 'socket.io-client';

export type UserStatus = 'ONLINE' | 'OFFLINE' | 'AWAY' | 'BUSY' | 'DO_NOT_DISTURB';

export interface UserPresence {
  userId: string;
  status: UserStatus;
  customStatus?: string | null;
  lastSeenAt: string;
  updatedAt: string;
}

let presenceSocket: Socket | null = null;

export function useUserPresence() {
  const { currentUserId } = useAppContext();
  const [presences, setPresences] = useState<Map<string, UserPresence>>(new Map());
  const [connected, setConnected] = useState(false);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!currentUserId) return;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    
    presenceSocket = io(`${apiUrl}/presence`, {
      query: { userId: currentUserId },
      transports: ['websocket'],
    });

    presenceSocket.on('connect', () => {
      console.log('Connected to presence server');
      setConnected(true);
    });

    presenceSocket.on('disconnect', () => {
      console.log('Disconnected from presence server');
      setConnected(false);
    });

    presenceSocket.on('presence:user_updated', (data: { userId: string; presence: UserPresence }) => {
      setPresences(prev => {
        const next = new Map(prev);
        next.set(data.userId, data.presence);
        return next;
      });
    });

    presenceSocket.on('presence:workspace_online', (data: { users: UserPresence[] }) => {
      setPresences(prev => {
        const next = new Map(prev);
        data.users.forEach(p => next.set(p.userId, p));
        return next;
      });
    });

    // Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      presenceSocket?.emit('presence:heartbeat');
    }, 30000);

    return () => {
      clearInterval(heartbeatInterval);
      presenceSocket?.disconnect();
      presenceSocket = null;
    };
  }, [currentUserId]);

  const updateStatus = useCallback((status: UserStatus) => {
    presenceSocket?.emit('presence:update', { status });
  }, []);

  const updateCustomStatus = useCallback((customStatus: string) => {
    presenceSocket?.emit('presence:custom_status', { customStatus });
  }, []);

  const clearCustomStatus = useCallback(() => {
    presenceSocket?.emit('presence:clear_custom_status');
  }, []);

  const subscribeToWorkspace = useCallback((workspaceId: string) => {
    presenceSocket?.emit('presence:subscribe_workspace', { workspaceId });
  }, []);

  const unsubscribeFromWorkspace = useCallback((workspaceId: string) => {
    presenceSocket?.emit('presence:unsubscribe_workspace', { workspaceId });
  }, []);

  const getPresence = useCallback((userId: string): UserPresence | undefined => {
    return presences.get(userId);
  }, [presences]);

  return {
    presences,
    connected,
    updateStatus,
    updateCustomStatus,
    clearCustomStatus,
    subscribeToWorkspace,
    unsubscribeFromWorkspace,
    getPresence,
  };
}
