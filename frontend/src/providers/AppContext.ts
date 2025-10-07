import { createContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Conversation, Message, User } from '../types';

export interface AppContextType {
  currentUserId: string;
  setCurrentUserId: (id: string) => void;
  selectedConvId: string | null;
  setSelectedConvId: (id: string | null) => void;
  users: User[];
  setUsers: Dispatch<SetStateAction<User[]>>;
  conversations: Conversation[];
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  isConnected: boolean;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);
