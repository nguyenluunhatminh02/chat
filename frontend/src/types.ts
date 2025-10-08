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
  avatarUrl?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  members: ConversationMember[];
  lastMessage?: {
    content: string;
    createdAt: string;
    user: User;
  } | null;
};

export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM' | 'VOICE_MESSAGE';

export type FileObject = {
  id: string;
  key: string;
  mime: string;
  size: number;
  url?: string;
  status: 'READY' | 'PROCESSING' | 'FAILED';
};

export type Attachment = {
  id: string;
  messageId: string;
  fileId: string;
  file: FileObject;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  content?: string | null;
  parentId?: string | null;
  metadata?: Record<string, unknown> | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  attachment?: Attachment[]; // NEW: Support file attachments
};
