import React, { useEffect, useMemo, useState } from 'react';
import { realtime } from '../lib/realtime';
import { useLocalStorage } from '../utils/storage';
import type { User, Conversation, Message } from '../types';
import { AppContext } from './AppContext';
import type { AppContextType } from './AppContext';

interface AppProviderProps {
  children: React.ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [currentUserId, setCurrentUserId] = useLocalStorage<string>('x-user-id', '');
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  useEffect(() => {
    if (!currentUserId) return;

    const socket = realtime.connect(apiUrl, currentUserId);
    
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    return () => {
      realtime.disconnect();
      setIsConnected(false);
    };
  }, [currentUserId, apiUrl]);

  const value: AppContextType = useMemo(
    () => ({
      currentUserId,
      setCurrentUserId,
      selectedConvId,
      setSelectedConvId,
      users,
      setUsers,
      conversations,
      setConversations,
      messages,
      setMessages,
      isConnected,
    }),
    [
      currentUserId,
      selectedConvId,
      users,
      conversations,
      messages,
      isConnected,
      setCurrentUserId,
      setSelectedConvId,
      setUsers,
      setConversations,
      setMessages,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

