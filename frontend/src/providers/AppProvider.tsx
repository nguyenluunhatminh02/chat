import React, { createContext, useEffect, useState } from 'react';
import { realtime } from '../lib/realtime';
import { useLocalStorage } from '../utils/storage';
import type { User, Conversation, Message } from '../types';

interface AppContextType {
  currentUserId: string;
  setCurrentUserId: (id: string) => void;
  selectedConvId: string;
  setSelectedConvId: (id: string) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isConnected: boolean;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: React.ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [currentUserId, setCurrentUserId] = useLocalStorage<string>('x-user-id', '');
  const [selectedConvId, setSelectedConvId] = useState<string>('');
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

  const value: AppContextType = {
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
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

