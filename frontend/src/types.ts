export type User = {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversationType = 'DIRECT' | 'GROUP';
export type MemberRole = 'MEMBER' | 'ADMIN' | 'OWNER';

export type ConversationMember = {
  id: string;
  conversationId: string;
  userId: string;
  role: MemberRole;
  lastReadAt?: string | null;
  pinned: boolean;
  muted: boolean;
  joinedAt: string;
};

export type Conversation = {
  id: string;
  type: ConversationType;
  title?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  members: ConversationMember[];
};

export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  content?: string | null;
  parentId?: string | null;
  metadata?: unknown;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
};
