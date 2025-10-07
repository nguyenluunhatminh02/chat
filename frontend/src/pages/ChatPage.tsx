import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ConversationItem } from '../components/chat/ConversationItem';
import { MessageItem } from '../components/chat/MessageItem';
import { MessageInput } from '../components/chat/MessageInput';
const SearchModal = lazy(() => import('../components/chat/SearchModal').then(m => ({ default: m.SearchModal })));
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { NewConversationModal } from '../components/chat/NewConversationModal';
import { CreateGroupModal } from '../components/chat/CreateGroupModal';
import { ExportModal } from '../components/chat/ExportModal';
import { GroupSettingsModal } from '../components/chat/GroupSettingsModal';
const PinnedMessagesPanel = lazy(() => import('../components/chat/PinnedMessagesPanel').then(m => ({ default: m.PinnedMessagesPanel })));
import { BlockedBanner } from '../components/chat/BlockedBanner';
import { SettingsModal } from '../components/settings/SettingsModal';
import { WorkspaceSelector } from '../components/chat/WorkspaceSelector';
import { ReadReceipts } from '../components/chat/ReadReceipts';
import { NotificationBanner } from '../components/NotificationBanner';
import { Button } from '../components/ui/Button';
import { useAppContext } from '../hooks/useAppContext';
import { useUsers } from '../hooks/useUsers';
import { useConversations, useCreateConversation } from '../hooks/useConversations';
import { useMessages, useSendMessage } from '../hooks/useMessages';
import { useSearch, type SearchHit } from '../hooks/useSearch';
import { useTyping } from '../hooks/useTyping';
import { usePins } from '../hooks/usePins';
import { useBlockStatus } from '../hooks/useBlockStatus';
import { useMarkRead } from '../hooks/useReads';
import { generateId } from '../utils/helpers';
import { cn } from '../utils/cn';
import {
  filesPresignPut,
  r2DirectPut,
  filesComplete,
  filesPresignGet,
  filesCreateThumbnail,
  getPresence,
  updateMessage,
  deleteMessage,
  listReactions,
  toggleReaction,
  getThread,
  sendMessageIdempotent
} from '../lib/api';
import { unblockUser } from '../lib/moderation';
import { realtime } from '../lib/realtime';
import type { Conversation, ConversationMember, Message, User } from '../types';

// Helper component to render messages with star/pin support
function MessagesRenderer({
  messages,
  getUserById,
  currentUserId,
  selectedConvId,
  handleEdit,
  handleDelete,
  handleToggleReaction,
  reactions,
  ensureReactions,
  replyCounts,
  handleOpenThread,
  openThreadId,
  threadMap,
  threadInput,
  setThreadInput,
  handleSendThreadReply,
}: {
  messages: Message[];
  getUserById: (userId: string) => User | undefined;
  currentUserId: string;
  selectedConvId: string;
  handleEdit: (messageId: string, newContent: string) => void;
  handleDelete: (messageId: string) => void;
  handleToggleReaction: (messageId: string, emoji: string) => void;
  reactions: Record<string, Record<string, string[]>>;
  ensureReactions: (messageId: string) => void;
  replyCounts: Record<string, number>;
  handleOpenThread: (messageId: string) => void;
  openThreadId: string | null;
  threadMap: Record<string, Message[]>;
  threadInput: string;
  setThreadInput: (value: string) => void;
  handleSendThreadReply: (parentId: string, content: string) => void;
}) {
  const { data: pinsData } = usePins(selectedConvId);

  const pinnedMessageIds = useMemo(() => {
    return new Set(pinsData?.items?.map(p => p.message.id) || []);
  }, [pinsData]);
  
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

  return (
    <div className="flex flex-col-reverse space-y-1">
      {messages.map((message: Message) => {
        const user = getUserById(message.senderId);
        const isPinned = pinnedMessageIds.has(message.id);
        const isLastMessage = lastMessage?.id === message.id;

        return (
          <div key={message.id}>
            <MessageItem
              message={message}
              user={user}
              isOwn={message.senderId === currentUserId}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReact={emoji => handleToggleReaction(message.id, emoji)}
              reactions={reactions[message.id]}
              onEnsureReactions={() => ensureReactions(message.id)}
              replyCount={replyCounts[message.id] || 0}
              onOpenThread={() => handleOpenThread(message.id)}
              threadOpen={openThreadId === message.id}
              threadMessages={threadMap[message.id] || []}
              threadInput={threadInput}
              onThreadInputChange={setThreadInput}
              onSendThreadReply={() => handleSendThreadReply(message.id, threadInput)}
              getUserById={getUserById}
              currentUserId={currentUserId}
              isPinned={isPinned}
            />
            {isLastMessage && (
              <div className="mt-1 ml-12">
                <ReadReceipts messageId={message.id} getUserById={getUserById} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ChatPage() {
  const queryClient = useQueryClient();
  
  const {
    currentUserId,
    selectedConvId,
    setSelectedConvId,
    isConnected,
  } = useAppContext();

  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [exportImportOpen, setExportImportOpen] = useState(false);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Presence state
  const [peerPresence, setPeerPresence] = useState<{ online: boolean; lastSeen: string | null } | null>(null);
  
  // Reactions: messageId -> emoji -> userIds
  const [reactions, setReactions] = useState<Record<string, Record<string, string[]>>>({});
  
  // Thread state
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [threadMap, setThreadMap] = useState<Record<string, Message[]>>({});
  const [threadInput, setThreadInput] = useState('');
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  
  const searchHook = useSearch();
  
  // Typing indicator
  const { typingUsers, startTyping, stopTyping } = useTyping({
    conversationId: selectedConvId,
    currentUserId,
    enabled: !!selectedConvId && !!currentUserId,
  });

  // Keyboard shortcut for search (Ctrl/Cmd + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { data: users = [] } = useUsers();
  const { data: conversations = [], isLoading: conversationsLoading } = useConversations(currentUserId);
  const { data: messagesData, isLoading: messagesLoading, error: messagesError } = useMessages(selectedConvId);
  const sendMessageMutation = useSendMessage();
  const createConversationMutation = useCreateConversation();
  const markReadMutation = useMarkRead();
  
  // 🐛 Debug: Log conversations changes
  useEffect(() => {
    const convList = conversations as Conversation[];
    console.log('📋 Conversations updated:', {
      count: convList.length,
      items: convList.map((c: Conversation) => ({ 
        id: c.id, 
        type: c.type, 
        title: c.title 
      })),
      loading: conversationsLoading
    });
  }, [conversations, conversationsLoading]);
  
  const selectedConv = (conversations as Conversation[]).find((c: Conversation) => c.id === selectedConvId);
  
  // Get peer user for DIRECT chat
  const getDirectPeer = useCallback((conv: Conversation | undefined): User | null => {
    if (!conv || conv.type !== 'DIRECT') return null;
    const otherId = conv.members.find((m: ConversationMember) => m.userId !== currentUserId)?.userId;
    return (users as User[]).find((u: User) => u.id === otherId) || null;
  }, [users, currentUserId]);

  // Get other user ID for DIRECT conversations (for block check)
  const otherUserId = useMemo(() => {
    if (!selectedConv || selectedConv.type !== 'DIRECT') return undefined;
    return selectedConv.members.find((m: ConversationMember) => m.userId !== currentUserId)?.userId;
  }, [selectedConv, currentUserId]);

  // Check block status for DIRECT conversations
  const { data: blockStatus } = useBlockStatus(currentUserId, otherUserId);
  const isBlocked = blockStatus?.blocked || false;
  const blockDirection = blockStatus?.direction || 'none';

  // Handle unblock action
  const handleUnblock = useCallback(async () => {
    if (!otherUserId || !currentUserId) return;
    try {
      await unblockUser(currentUserId, otherUserId);
      queryClient.invalidateQueries({ queryKey: ['blockStatus'] });
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
    } catch (error) {
      console.error('Failed to unblock user:', error);
    }
  }, [currentUserId, otherUserId, queryClient]);
  
  type PresenceResponse = { online: boolean; lastSeen: string | null };
  type ReactionResponse = { emoji: string; userId: string };
  
  // Poll presence for DIRECT chat peer
  useEffect(() => {
    const peer = getDirectPeer(selectedConv);
    if (!peer?.id) {
      setPeerPresence(null);
      return;
    }
    
    let stopped = false;
    const loadPresence = async () => {
      try {
        const p = await getPresence(peer.id) as PresenceResponse;
        if (!stopped) {
          setPeerPresence({ 
            online: p.online, 
            lastSeen: p.lastSeen 
          });
        }
      } catch (err) {
        console.error('Failed to load presence:', err);
      }
    };
    
    loadPresence();
    const interval = setInterval(loadPresence, 20000); // Poll every 20s
    
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [selectedConv, users, currentUserId, getDirectPeer]);
  
  // Auto-mark-read effect (debounced 500ms after viewing conversation)
  useEffect(() => {
    if (!selectedConvId || !messagesData || messagesLoading) return;
    
    const messages = messagesData as Message[];
    if (messages.length === 0) return;
    
    // Find the last message in the conversation
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.senderId === currentUserId) return;
    
    const timer = setTimeout(() => {
      markReadMutation.mutate({
        conversationId: selectedConvId,
        opts: { messageId: lastMessage.id },
      });
    }, 500); // Debounce 500ms
    
    return () => clearTimeout(timer);
  }, [selectedConvId, messagesData, messagesLoading, currentUserId, markReadMutation]);
  
  // Wire realtime events for automatic updates
  useEffect(() => {
    if (!currentUserId) return;
    
    // Message created - invalidate messages and conversations
    const handleMessageCreated = (event: { message?: Message }) => {
      const msg = event?.message;
      if (!msg) return;
      
      console.log('🔥 Realtime: message.created', msg);
      
      // Invalidate messages for this conversation
      queryClient.invalidateQueries({ queryKey: ['messages', msg.conversationId] });
      
      // Invalidate conversations list (for last message update)
      queryClient.invalidateQueries({ queryKey: ['conversations', currentUserId] });
      
      // Invalidate unread count for this conversation (if message is from someone else)
      if (msg.senderId !== currentUserId) {
        queryClient.invalidateQueries({ queryKey: ['unread', msg.conversationId] });
      }
      
      // Update reply count if it's a thread reply
      if (msg.parentId) {
        setReplyCounts(prev => ({
          ...prev,
          [msg.parentId!]: (prev[msg.parentId!] || 0) + 1
        }));
        
        // Update thread map if thread is open
        if (openThreadId === msg.parentId) {
          setThreadMap(prev => {
            const arr = prev[msg.parentId!] || [];
            const exists = arr.find(m => m.id === msg.id);
            if (exists) return prev;
            return {
              ...prev,
              [msg.parentId!]: [...arr, msg].sort(
                (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)
              )
            };
          });
        }
      }
    };
    
    // Message updated - invalidate messages
    const handleMessageUpdated = (event: { id?: string; content?: string; editedAt?: string }) => {
      const { id, content, editedAt } = event || {};
      if (!id) return;
      
      console.log('🔥 Realtime: message.updated', { id, content, editedAt });
      
      // Invalidate messages for current conversation
      if (selectedConvId) {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedConvId] });
      }
      
      // Update thread map if exists
      setThreadMap(prev => {
        const updated = { ...prev };
        for (const parentId of Object.keys(updated)) {
          updated[parentId] = updated[parentId].map(m =>
            m.id === id ? { ...m, content: content || m.content, editedAt } : m
          );
        }
        return updated;
      });
    };
    
    // Message deleted - invalidate messages
    const handleMessageDeleted = (event: { id?: string; deletedAt?: string; parentId?: string }) => {
      const { id, deletedAt, parentId } = event || {};
      if (!id) return;
      
      console.log('🔥 Realtime: message.deleted', { id, deletedAt, parentId });
      
      // Invalidate messages for current conversation
      if (selectedConvId) {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedConvId] });
      }
      
      // Clear reactions for deleted message
      setReactions(prev => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [id]: _removed, ...rest } = prev;
        return rest;
      });
      
      // Update reply count
      if (parentId) {
        setReplyCounts(prev => ({
          ...prev,
          [parentId]: Math.max(0, (prev[parentId] || 0) - 1)
        }));
      }
      
      // Update thread map
      setThreadMap(prev => {
        const updated = { ...prev };
        for (const pid of Object.keys(updated)) {
          updated[pid] = updated[pid].map(m =>
            m.id === id
              ? { ...m, content: null, deletedAt: deletedAt || new Date().toISOString() }
              : m
          );
        }
        return updated;
      });
    };
    
    // Reaction added - update reactions state
    const handleReactionAdded = (event: { messageId?: string; userId?: string; emoji?: string }) => {
      const { messageId, userId, emoji } = event || {};
      if (!messageId || !emoji || !userId) return;
      
      console.log('🔥 Realtime: reaction.added', { messageId, emoji, userId });
      
      setReactions(prev => {
        const forMsg = prev[messageId] ? { ...prev[messageId] } : {};
        const users = new Set(forMsg[emoji] || []);
        users.add(userId);
        forMsg[emoji] = Array.from(users);
        return { ...prev, [messageId]: forMsg };
      });
    };
    
    // Reaction removed - update reactions state
    const handleReactionRemoved = (event: { messageId?: string; userId?: string; emoji?: string }) => {
      const { messageId, userId, emoji } = event || {};
      if (!messageId || !emoji || !userId) return;
      
      console.log('🔥 Realtime: reaction.removed', { messageId, emoji, userId });
      
      setReactions(prev => {
        const forMsg = prev[messageId] ? { ...prev[messageId] } : {};
        const arr = forMsg[emoji] || [];
        const next = arr.filter(u => u !== userId);
        
        if (next.length === 0) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [emoji]: _removed, ...rest } = forMsg;
          return { ...prev, [messageId]: rest };
        }
        
        return { ...prev, [messageId]: { ...forMsg, [emoji]: next } };
      });
    };
    
    // Pin event handlers
    const handlePinAdded = (data: { messageId: string }) => {
      console.log('📌 Pin added:', data);
      queryClient.invalidateQueries({ queryKey: ['pins', selectedConvId] });
    };

    const handlePinRemoved = (data: { messageId: string }) => {
      console.log('📌 Pin removed:', data);
      queryClient.invalidateQueries({ queryKey: ['pins', selectedConvId] });
    };

    const handleConversationRead = (data: { conversationId: string; messageId?: string }) => {
      console.log('👁️ Conversation read:', data);
      const { conversationId, messageId } = data;
      
      // Invalidate read receipts for this message
      if (messageId) {
        queryClient.invalidateQueries({ queryKey: ['readers', messageId] });
      }
      
      // Invalidate unread count for this conversation
      queryClient.invalidateQueries({ queryKey: ['unread', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['unreadSummary'] });
    };

    // Handle conversation created event
    const handleConversationCreated = (data: { conversation?: Conversation; memberIds?: string[] }) => {
      console.log('🔥 Realtime: conversation.created', data);
      console.log('📋 Current userId:', currentUserId);
      console.log('📋 Is member?', data.memberIds?.includes(currentUserId));
      
      // Check if current user is a member
      const isMember = data.memberIds?.includes(currentUserId);
      if (isMember) {
        console.log('✅ User is member, invalidating conversations query');
        // Invalidate AND refetch conversations list to show new conversation
        queryClient.invalidateQueries({ 
          queryKey: ['conversations', currentUserId],
          refetchType: 'active' 
        });
        // Force immediate refetch
        queryClient.refetchQueries({ 
          queryKey: ['conversations', currentUserId],
          exact: true 
        });
      } else {
        console.log('❌ User is NOT a member, skipping invalidation');
      }
    };

    // Handle member removed event
    const handleMemberRemoved = (data: { conversationId: string; removedUserId: string; removedBy: string; memberIds: string[] }) => {
      console.log('🔥 Realtime: member.removed', data);
      
      // If you were removed from the conversation
      if (data.removedUserId === currentUserId) {
        console.log('❌ You were removed from conversation:', data.conversationId);
        
        // Clear selection if this was the selected conversation
        if (selectedConvId === data.conversationId) {
          setSelectedConvId(null);
        }
        
        // Refresh conversations list (conversation will disappear)
        queryClient.invalidateQueries({ queryKey: ['conversations', currentUserId] });
        
        // Show notification
        import('react-hot-toast').then(({ toast }) => {
          toast.error('You have been removed from the group');
        });
        return;
      }

      // If another member was removed, just refresh the conversation
      console.log('✅ Member removed from conversation, refreshing data');
      queryClient.invalidateQueries({ queryKey: ['conversation', data.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', currentUserId] });
    };

    // Handle conversation updated event (avatar, title changes)
    const handleConversationUpdated = (data: { conversationId: string; avatarKey?: string; title?: string; memberIds: string[] }) => {
      console.log('🔥 Realtime: conversation.updated', data);
      
      // Refresh conversation details
      queryClient.invalidateQueries({ queryKey: ['conversation', data.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', currentUserId] });
      
      // If avatar was updated, show success message
      if (data.avatarKey) {
        console.log('✅ Avatar updated for conversation:', data.conversationId);
      }
      
      if (data.title) {
        console.log('✅ Title updated for conversation:', data.conversationId);
      }
    };

    // Handle member added event
    const handleMemberAdded = (data: { conversationId: string; addedUserId: string; addedBy: string; memberIds: string[] }) => {
      console.log('🔥 Realtime: member.added', data);
      
      // Refresh conversation details and conversations list
      queryClient.invalidateQueries({ queryKey: ['conversation', data.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', currentUserId] });
      
      console.log('✅ Member added to conversation:', {
        conversationId: data.conversationId,
        addedUserId: data.addedUserId,
        addedBy: data.addedBy,
        totalMembers: data.memberIds.length
      });
    };

    // Register event handlers
    realtime.on('message.created', handleMessageCreated);
    realtime.on('message.updated', handleMessageUpdated);
    realtime.on('message.deleted', handleMessageDeleted);
    realtime.on('reaction.added', handleReactionAdded);
    realtime.on('reaction.removed', handleReactionRemoved);
    realtime.on('pin.added', handlePinAdded);
    realtime.on('pin.removed', handlePinRemoved);
    realtime.on('conversation.read', handleConversationRead);
    realtime.on('conversation.created', handleConversationCreated);
    realtime.on('member.removed', handleMemberRemoved);
    realtime.on('conversation.updated', handleConversationUpdated);
    realtime.on('member.added', handleMemberAdded);
    
    return () => {
      realtime.off('message.created', handleMessageCreated);
      realtime.off('message.updated', handleMessageUpdated);
      realtime.off('message.deleted', handleMessageDeleted);
      realtime.off('reaction.added', handleReactionAdded);
      realtime.off('reaction.removed', handleReactionRemoved);
      realtime.off('pin.added', handlePinAdded);
      realtime.off('pin.removed', handlePinRemoved);
      realtime.off('conversation.read', handleConversationRead);
      realtime.off('conversation.created', handleConversationCreated);
      realtime.off('member.removed', handleMemberRemoved);
      realtime.off('conversation.updated', handleConversationUpdated);
      realtime.off('member.added', handleMemberAdded);
    };
  }, [currentUserId, selectedConvId, queryClient, openThreadId, setSelectedConvId]);

  // Join conversation room when selected
  useEffect(() => {
    if (!selectedConvId || !currentUserId) return;
    
    console.log('🔥 Joining conversation room:', selectedConvId);
    realtime.joinConversation(selectedConvId);
    
    // Reset thread state when switching conversations
    setOpenThreadId(null);
    setThreadMap({});
    setReactions({});
    setReplyCounts({});
  }, [selectedConvId, currentUserId]);

  const messages = useMemo(() => (messagesData || []) as Message[], [messagesData]);

  // Mark messages as read when viewing conversation
  useEffect(() => {
    if (!selectedConvId || !currentUserId || messages.length === 0) return;
    
    // Find the last message that is not from current user
    const lastMessageFromOther = messages
      .filter((m: Message) => m.senderId !== currentUserId)
      .sort((a: Message, b: Message) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    
    if (!lastMessageFromOther) return;
    
    // Mark as read after a short delay (to avoid marking immediately)
    const timer = setTimeout(async () => {
      try {
        const { markReadUpTo } = await import('../lib/reads');
        await markReadUpTo(selectedConvId, { messageId: lastMessageFromOther.id });
        
        // Invalidate unread count
        queryClient.invalidateQueries({ queryKey: ['unread', selectedConvId] });
      } catch (err) {
        console.error('Failed to mark message as read:', err);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [selectedConvId, currentUserId, messages, queryClient]);

  // Auto scroll is handled by flex-col-reverse layout
  
  // Debug logging
  console.log('🔥 ChatPage Debug:', {
    selectedConvId,
    messagesData,
    messages: messages.length,
    messagesLoading,
    messagesError,
    users,
    usersCount: (users as User[]).length
  });

  const handleSendMessage = async (content: string, parentId?: string) => {
    if (!selectedConvId || !currentUserId) return;

    const eventKey = generateId();
    
    await sendMessageMutation.mutateAsync({
      userId: currentUserId,
      data: {
        conversationId: selectedConvId,
        type: 'TEXT',
        content,
        parentId,
      },
      eventKey,
    });
  };

  const handleFileUpload = async (file: File) => {
    if (!selectedConvId || !currentUserId) return;

    try {
      console.log('🔥 Starting file upload:', file.name, file.type, file.size);
      
      // 1. Get presigned PUT URL
      const presign = await filesPresignPut(file.name, file.type || 'application/octet-stream', file.size);
      console.log('🔥 Got presigned URL:', presign);

      // 2. Upload directly to R2
      await r2DirectPut(presign, file);
      console.log('🔥 Upload to R2 completed');

      // 3. Complete upload (sniff mime type)
      const completed = await filesComplete(presign.fileId);
      console.log('🔥 File completed:', completed);

      // 4. Get file URL
      const { url } = await filesPresignGet(completed.key);
      console.log('🔥 Got file URL:', url);

      // 5. Create thumbnail for images
      let thumbUrl: string | undefined;
      if (completed.mime.startsWith('image/')) {
        try {
          const thumb = await filesCreateThumbnail(presign.fileId, 512);
          thumbUrl = thumb.thumbUrl;
          console.log('🔥 Generated thumbnail:', thumbUrl);
        } catch (e) {
          console.log('🔥 Thumbnail generation failed (using original):', e);
        }
      }

      // 6. Send message with complete file info
      const isImage = completed.mime.startsWith('image/');
      const payload = {
        fileId: presign.fileId,
        key: completed.key,
        filename: file.name,
        mime: completed.mime,
        size: completed.size,
        url,
        thumbUrl,
      };
      
      console.log('🔥 Sending message with payload:', payload);
      
      const eventKey = generateId();
      await sendMessageMutation.mutateAsync({
        userId: currentUserId,
        data: {
          conversationId: selectedConvId,
          type: isImage ? 'IMAGE' : 'FILE',
          content: JSON.stringify(payload),
        },
        eventKey,
      });
      
      console.log('🔥 File upload completed successfully!');
    } catch (error) {
      console.error('🔥 File upload failed:', error);
    }
  };

  // NEW: Handle paste image (PHẦN 30)
  const handlePasteImage = async (file: File) => {
    if (!selectedConvId || !currentUserId) return;

    try {
      console.log('📋 Pasting image:', file.name, file.type, file.size);
      
      const access = localStorage.getItem('access_token');
      if (!access) {
        throw new Error('Not authenticated');
      }

      // Use paste-image endpoint for fast upload
      const formData = new FormData();
      formData.append('file', file, file.name || 'paste.png');

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/messages/${selectedConvId}/paste-image`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access}`,
            'X-User-Id': currentUserId,
            'X-Workspace-Id': localStorage.getItem('x-workspace-id') || '',
          },
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(`Paste failed: ${response.status}`);
      }

      // Message will arrive via WebSocket
      console.log('📋 Paste image uploaded successfully!');
    } catch (error) {
      console.error('📋 Paste image failed:', error);
    }
  };

  const handleSearch = async (query: string, scope: 'current' | 'all' = 'current') => {
    await searchHook.search(query, {
      conversationId: scope === 'current' ? selectedConvId : undefined,
    });
    // Keep search modal open to show results
  };

  const handleJumpToMessage = async (hit: SearchHit) => {
    console.log('🔍 Jump to message:', hit);
    
    // Switch conversation if needed
    if (hit.conversationId !== selectedConvId) {
      setSelectedConvId(hit.conversationId);
    }
    
    // Close search
    setSearchOpen(false);
    
    // Wait for messages to load, then scroll
    setTimeout(() => {
      const messageElement = document.querySelector(`[data-message-id="${hit.id}"]`);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight the message
        messageElement.classList.add('ring-2', 'ring-yellow-400', 'ring-offset-2');
        setTimeout(() => {
          messageElement.classList.remove('ring-2', 'ring-yellow-400', 'ring-offset-2');
        }, 2000);
      }
    }, 500);
  };

  // Memoize user lookup to prevent re-renders
  const getUserById = useCallback((userId: string): User | undefined => {
    return (users as User[]).find((u: User) => u.id === userId);
  }, [users]);
  
  // Edit message handler
  const handleEdit = async (messageId: string, newContent: string) => {
    try {
      await updateMessage(currentUserId, messageId, { content: newContent });
      // TanStack Query will auto-refetch
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  };
  
  // Delete message handler
  const handleDelete = async (messageId: string) => {
    try {
      await deleteMessage(currentUserId, messageId);
      // TanStack Query will auto-refetch
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };
  
  // Reactions handlers
  const ensureReactions = async (messageId: string) => {
    if (reactions[messageId]) return;
    try {
      const rows = await listReactions(messageId) as ReactionResponse[];
      const grouped: Record<string, string[]> = {};
      rows.forEach((r: ReactionResponse) => {
        if (!grouped[r.emoji]) grouped[r.emoji] = [];
        grouped[r.emoji].push(r.userId);
      });
      setReactions(prev => ({ ...prev, [messageId]: grouped }));
    } catch (error) {
      console.error('Failed to load reactions:', error);
    }
  };
  
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    // Check if message is deleted
    const msg = messages.find((m: Message) => m.id === messageId);
    if (msg?.deletedAt) return;
    
    const byMe = (reactions[messageId]?.[emoji] || []).includes(currentUserId);
    
    // Optimistic update
    setReactions(prev => {
      const msgMap = prev[messageId] ? { ...prev[messageId] } : {};
      const userSet = new Set(msgMap[emoji] || []);
      if (byMe) userSet.delete(currentUserId);
      else userSet.add(currentUserId);
      return { ...prev, [messageId]: { ...msgMap, [emoji]: Array.from(userSet) } };
    });
    
    try {
      await toggleReaction(currentUserId, { messageId, emoji });
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
      // Rollback
      setReactions(prev => {
        const msgMap = prev[messageId] ? { ...prev[messageId] } : {};
        const userSet = new Set(msgMap[emoji] || []);
        if (byMe) userSet.add(currentUserId);
        else userSet.delete(currentUserId);
        return { ...prev, [messageId]: { ...msgMap, [emoji]: Array.from(userSet) } };
      });
    }
  };
  
  // Thread handlers
  const handleOpenThread = async (parentId: string) => {
    setOpenThreadId(cur => cur === parentId ? null : parentId);
    
    if (!threadMap[parentId]) {
      try {
        const rows = await getThread(parentId) as Message[];
        const ordered = [...rows].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
        setThreadMap(prev => ({ ...prev, [parentId]: ordered }));
        setReplyCounts(prev => ({ 
          ...prev, 
          [parentId]: ordered.filter(r => !r.deletedAt).length 
        }));
      } catch (error) {
        console.error('Failed to load thread:', error);
      }
    }
  };
  
  const handleSendThreadReply = async (parentId: string, text: string) => {
    if (!selectedConvId || !text.trim()) return;
    
    const tmpId = `tmp_thread_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const eventKey = generateId();
    
    // Optimistic add
    const optimistic: Partial<Message> = {
      id: tmpId,
      conversationId: selectedConvId,
      senderId: currentUserId,
      type: 'TEXT',
      content: text,
      parentId,
      createdAt: new Date().toISOString(),
    };
    
    setThreadMap(prev => {
      const arr = prev[parentId] || [];
      return { ...prev, [parentId]: [...arr, optimistic as Message] };
    });
    
    try {
      const real = await sendMessageIdempotent(
        currentUserId,
        {
          conversationId: selectedConvId,
          type: 'TEXT',
          content: text,
          parentId,
        },
        { key: eventKey }
      ) as Message;
      
      setThreadMap(prev => {
        const arr = prev[parentId] || [];
        return { ...prev, [parentId]: arr.map(m => m.id === tmpId ? real : m) };
      });
      
      // Don't increment here - realtime event will handle it
      setThreadInput('');
    } catch (error) {
      console.error('Failed to send thread reply:', error);
      // Remove optimistic
      setThreadMap(prev => {
        const arr = prev[parentId] || [];
        return { ...prev, [parentId]: arr.filter(m => m.id !== tmpId) };
      });
    }
  };

  // Create conversation handler with duplicate check
  const handleCreateConversation = async (
    type: 'DIRECT' | 'GROUP',
    members: string[],
    title?: string
  ) => {
    if (members.length === 0) return;

    // For DIRECT chats, check if conversation already exists
    if (type === 'DIRECT' && members.length === 1) {
      const existingDirect = (conversations as Conversation[]).find(
        (conv: Conversation) =>
          conv.type === 'DIRECT' &&
          conv.members.length === 2 &&
          conv.members.some((m: ConversationMember) => m.userId === members[0]) &&
          conv.members.some((m: ConversationMember) => m.userId === currentUserId)
      );

      if (existingDirect) {
        // Conversation exists, just select it
        setSelectedConvId(existingDirect.id);
        setNewConvOpen(false);
        return;
      }
    }

    // Create new conversation
    // Note: Backend automatically adds currentUserId, so only pass other members
    try {
      const result = await createConversationMutation.mutateAsync({
        type,
        title,
        members, // Don't add currentUserId - backend handles it
      });

      console.log('✅ Group created:', result);

      // Select the new conversation and close modal
      if (result && typeof result === 'object' && 'id' in result) {
        const newConvId = (result as { id: string }).id;
        
        console.log('🔄 Step 1: Invalidating conversations cache...');
        
        // ⚠️ CRITICAL: Force immediate refetch before selecting
        await queryClient.invalidateQueries({ 
          queryKey: ['conversations', currentUserId],
          refetchType: 'active' 
        });
        
        console.log('🔄 Step 2: Waiting for backend transaction...');
        
        // Wait a bit for backend consistency (Prisma transaction)
        await new Promise(resolve => setTimeout(resolve, 200)); // Increased to 200ms
        
        console.log('🔄 Step 3: Refetching conversations...');
        
        // Force a manual refetch to be sure
        await queryClient.refetchQueries({ 
          queryKey: ['conversations', currentUserId],
          exact: true 
        });
        
        console.log('🔄 Step 4: Selecting new conversation...');
        
        // Check if conversation appears in list
        const updatedConvs = queryClient.getQueryData(['conversations', currentUserId]) as Conversation[];
        const newConvExists = updatedConvs?.some(c => c.id === newConvId);
        
        if (!newConvExists) {
          console.error('❌ WARNING: New conversation not found in list!', {
            newConvId,
            totalConversations: updatedConvs?.length,
            conversationIds: updatedConvs?.map(c => c.id)
          });
        } else {
          console.log('✅ Conversation found in list!');
        }
        
        // Now select the conversation
        setSelectedConvId(newConvId);
        setNewConvOpen(false);
        setCreateGroupOpen(false);
        
        console.log('✅ Group should appear in sidebar now');
      }
    } catch (error) {
      console.error('❌ Failed to create group:', error);
    }
  };

  if (!currentUserId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-bold">Welcome to Chat</h2>
          <p className="mb-4 text-gray-600">Please set your user ID to start chatting</p>
          <Button onClick={() => {/* TODO: Open user selection modal */}}>
            Select User
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Notification Banner */}
      <NotificationBanner />
      
      {/* User Info Bar */}
      <div className="flex items-center justify-between px-4 py-2 text-white shadow-md bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 text-sm font-semibold rounded-full bg-white/20">
            {(users as User[]).find(u => u.id === currentUserId)?.name?.[0]?.toUpperCase() || currentUserId[0]?.toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold">
              {(users as User[]).find(u => u.id === currentUserId)?.name || 'You'}
            </div>
            <div className="text-xs text-white/80">
              {(users as User[]).find(u => u.id === currentUserId)?.email || currentUserId}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-2 h-2 rounded-full',
            isConnected ? 'bg-green-400' : 'bg-red-400'
          )} />
          <span className="text-xs">{isConnected ? 'Online' : 'Offline'}</span>
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* 🎨 Sidebar - Messenger Style */}
        <div className={cn(
          "md:flex md:w-80 lg:w-96 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col shadow-lg z-50",
          "fixed md:relative inset-y-0 left-0 transform transition-all duration-300 ease-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Chats</h1>
            <div className="flex items-center gap-2">
              {/* Close button - Mobile only */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 text-gray-600 dark:text-gray-300 transition-all rounded-full md:hidden hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {/* New Direct Chat Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setNewConvOpen(true)}
                className="transition-all rounded-full h-9 w-9 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110 active:scale-95"
                title="New direct chat"
              >
                <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </Button>

              {/* New Group Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCreateGroupOpen(true)}
                className="transition-all rounded-full h-9 w-9 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110 active:scale-95"
                title="Create group"
              >
                <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </Button>

              {/* Settings Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettingsOpen(true)}
                className="transition-all rounded-full h-9 w-9 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110 active:scale-95"
                title="Settings"
              >
                <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Button>
              
              {/* Connection Status */}
              <div className={cn(
                'w-2.5 h-2.5 rounded-full transition-all',
                isConnected ? 'bg-green-500' : 'bg-gray-400'
              )} />
            </div>
          </div>
          
          {/* Workspace Selector */}
          <div className="mb-3">
            <WorkspaceSelector />
          </div>
          
          <div className="flex gap-2 mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="justify-start flex-1 py-2 font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border-0 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <span className="mr-2">🔍</span>
              <span>Search...</span>
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {(conversations as Conversation[]).length === 0 ? (
            <div className="flex items-center justify-center h-full px-4">
              <div className="text-center">
                <div className="mb-3 text-5xl">💬</div>
                <p className="font-medium text-gray-600">No conversations yet</p>
              </div>
            </div>
          ) : (
            (conversations as Conversation[]).map((conv: Conversation) => (
              <div key={conv.id} className="relative">
                <ConversationItem
                  id={conv.id}
                  title={conv.title || undefined}
                  avatarUrl={conv.avatarUrl}
                  type={conv.type}
                  members={conv.members}
                  lastMessage={conv.lastMessage || undefined}
                  isSelected={conv.id === selectedConvId}
                  onClick={() => setSelectedConvId(conv.id)}
                  users={users as User[]}
                  currentUserId={currentUserId}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1">
        {!selectedConv ? (
          <div className="flex items-center justify-center h-full md:block">
            <div className="text-center md:hidden">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-4 mb-4 text-white transition-all bg-blue-500 rounded-full shadow-lg hover:bg-blue-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <p className="text-sm text-gray-500">Tap to view conversations</p>
            </div>
            <div className="items-center justify-center hidden h-full md:flex">
              <div className="text-center">
                <div className="mb-4 text-6xl">💬</div>
                <p className="text-xl font-medium text-gray-600 dark:text-gray-300">Select a conversation to start chatting</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* 💎 Chat Header - Messenger Style */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
              {/* Hamburger Menu - Mobile Only */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 transition-all rounded-full md:hidden hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Toggle menu"
              >
                <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {selectedConv.title || 
                    (selectedConv.type === 'DIRECT' 
                      ? getUserById(selectedConv.members.find((m: ConversationMember) => m.userId !== currentUserId)?.userId || '')?.name || 'Direct Chat'
                      : selectedConv.title || 'Group Chat'
                    )
                  }
                </h2>
                {selectedConv.type === 'DIRECT' ? (
                  peerPresence && (
                    <div className="text-xs mt-0.5">
                      {peerPresence.online ? (
                        <span className="font-medium text-green-600">Active now</span>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">
                          Active {peerPresence.lastSeen ? new Date(peerPresence.lastSeen).toLocaleString() : 'recently'}
                        </span>
                      )}
                    </div>
                  )
                ) : (
                  <div className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                    {selectedConv.members.length} members: {selectedConv.members
                      .map((m: ConversationMember) => getUserById(m.userId)?.name || m.userId)
                      .join(', ')
                      .substring(0, 50)}{selectedConv.members.length > 3 ? '...' : ''}
                  </div>
                )}
              </div>
              
              {/* Header Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Group Settings Button - Only for GROUP chats */}
                {selectedConv.type === 'GROUP' && (
                  <button
                    onClick={() => setGroupSettingsOpen(true)}
                    className="p-2 transition-all rounded-full hover:bg-purple-50 dark:hover:bg-purple-900/30"
                    title="Group settings"
                    aria-label="Group settings"
                  >
                    <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </button>
                )}
                
                {/* Export Conversation Button */}
                <button
                  onClick={() => setExportImportOpen(true)}
                  className="p-2 transition-all rounded-full hover:bg-green-50 dark:hover:bg-green-900/30"
                  title="Export conversation"
                  aria-label="Export conversation"
                >
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                
                {/* Pinned Messages Button */}
                <button
                  onMouseEnter={() => {
                    if (selectedConvId) {
                      queryClient.prefetchQuery({
                        queryKey: ['pins', selectedConvId, undefined],
                        queryFn: () => import('../lib/pins').then(m => m.listPins({ conversationId: selectedConvId })),
                      });
                    }
                  }}
                  onClick={() => setShowPinnedPanel(true)}
                  className="p-2 transition-all rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30"
                  title="View pinned messages"
                  aria-label="View pinned messages"
                >
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 📱 Messages Area - Messenger Style */}
            <div id="messages-container" className="flex flex-col-reverse flex-1 p-4 overflow-y-auto bg-white dark:bg-gray-900">
              {messagesLoading ? (
                <div className="flex items-center justify-center flex-1">
                  <div className="text-center">
                    <div className="w-10 h-10 border-3 border-gray-300 border-t-[#0084ff] rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
                  </div>
                </div>
              ) : messagesError ? (
                <div className="flex items-center justify-center flex-1">
                  <div className="text-center text-red-500 dark:text-red-400">
                    <p>Error: {messagesError.message}</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center flex-1">
                  <div className="text-center">
                    <div className="mb-2 text-5xl">💬</div>
                    <p className="text-gray-500 dark:text-gray-400">No messages yet</p>
                  </div>
                </div>
              ) : (
                <MessagesRenderer
                  messages={messages}
                  getUserById={getUserById}
                  currentUserId={currentUserId}
                  selectedConvId={selectedConvId!}
                  handleEdit={handleEdit}
                  handleDelete={handleDelete}
                  handleToggleReaction={handleToggleReaction}
                  reactions={reactions}
                  ensureReactions={ensureReactions}
                  replyCounts={replyCounts}
                  handleOpenThread={handleOpenThread}
                  openThreadId={openThreadId}
                  threadMap={threadMap}
                  threadInput={threadInput}
                  setThreadInput={setThreadInput}
                  handleSendThreadReply={handleSendThreadReply}
                />
              )}
            </div>

            {/* Typing Indicator */}
            {typingUsers.length > 0 && (
              <TypingIndicator
                typingUserIds={typingUsers}
                users={users as User[]}
                currentUserId={currentUserId}
              />
            )}

            {/* Message Input or Blocked Banner */}
            {isBlocked ? (
              <BlockedBanner
                type={blockDirection === 'blocker' ? 'blocker' : 'blocked'}
                userName={getDirectPeer(selectedConv)?.name || 'User'}
                onUnblock={blockDirection === 'blocker' ? handleUnblock : undefined}
              />
            ) : (
              <MessageInput
                conversationId={selectedConvId}
                onSend={handleSendMessage}
                onFileUpload={handleFileUpload}
                onPasteImage={handlePasteImage}
                disabled={sendMessageMutation.isPending}
                onTypingStart={startTyping}
                onTypingStop={stopTyping}
              />
            )}
          </>
        )}
      </div>

      {/* Search Modal with Results */}
      <Suspense fallback={null}>
      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSearch={handleSearch}
        conversations={conversations as Conversation[]}
        selectedConvId={selectedConvId}
        searchLoading={searchHook.loading}
        searchResults={searchHook.results}
        searchTotal={searchHook.total}
        searchError={searchHook.error}
        onJumpToMessage={handleJumpToMessage}
  />
      </Suspense>

      {/* New Conversation Modal */}
      <NewConversationModal
        open={newConvOpen}
        onOpenChange={setNewConvOpen}
        onCreateConversation={handleCreateConversation}
      />

      {/* Create Group Modal */}
      <CreateGroupModal
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
      />

      {/* Export Modal (Import removed) */}
      {exportImportOpen && selectedConvId && (
        <ExportModal
          conversationId={selectedConvId}
          open={exportImportOpen}
          onOpenChange={setExportImportOpen}
        />
      )}

      {/* Pinned Messages Panel */}
      {showPinnedPanel && selectedConvId && (
        <Suspense fallback={null}>
        <PinnedMessagesPanel
          conversationId={selectedConvId}
          onClose={() => setShowPinnedPanel(false)}
          onMessageClick={(messageId) => {
            // Scroll to message
            const el = document.querySelector(`[data-message-id="${messageId}"]`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setShowPinnedPanel(false);
          }}
          getUserById={getUserById}
        />
        </Suspense>
      )}

      {/* Group Settings Modal */}
      {groupSettingsOpen && selectedConv && selectedConv.type === 'GROUP' && (
        <GroupSettingsModal
          open={groupSettingsOpen}
          onOpenChange={setGroupSettingsOpen}
          conversation={selectedConv}
          getUserById={getUserById}
          currentUserId={currentUserId}
          onUpdateGroup={async () => {
            // Invalidate conversations to refresh the UI
            await queryClient.invalidateQueries({ queryKey: ['conversations', currentUserId] });
          }}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        currentUserId={currentUserId}
      />

      </div>
    </div>
  );
}