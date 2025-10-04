import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ConversationItem } from '../components/chat/ConversationItem';
import { MessageItem } from '../components/chat/MessageItem';
import { MessageInput } from '../components/chat/MessageInput';
import { SearchModal } from '../components/chat/SearchModal';
import { Button } from '../components/ui/Button';
import { useAppContext } from '../hooks/useAppContext';
import { useUsers } from '../hooks/useUsers';
import { useConversations } from '../hooks/useConversations';
import { useMessages, useSendMessage } from '../hooks/useMessages';
import { useSearch, type SearchHit } from '../hooks/useSearch';
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
import { realtime } from '../lib/realtime';
import type { Conversation, ConversationMember, Message, User } from '../types';

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
  const { data: conversations = [] } = useConversations(currentUserId);
  const { data: messagesData, isLoading: messagesLoading, error: messagesError } = useMessages(selectedConvId);
  const sendMessageMutation = useSendMessage();
  
  const selectedConv = (conversations as Conversation[]).find((c: Conversation) => c.id === selectedConvId);
  
  // Get peer user for DIRECT chat
  const getDirectPeer = useCallback((conv: Conversation | undefined): User | null => {
    if (!conv || conv.type !== 'DIRECT') return null;
    const otherId = conv.members.find((m: ConversationMember) => m.userId !== currentUserId)?.userId;
    return (users as User[]).find((u: User) => u.id === otherId) || null;
  }, [users, currentUserId]);
  
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
    
    // Register event handlers
    realtime.on('message.created', handleMessageCreated);
    realtime.on('message.updated', handleMessageUpdated);
    realtime.on('message.deleted', handleMessageDeleted);
    realtime.on('reaction.added', handleReactionAdded);
    realtime.on('reaction.removed', handleReactionRemoved);
    
    return () => {
      realtime.off('message.created', handleMessageCreated);
      realtime.off('message.updated', handleMessageUpdated);
      realtime.off('message.deleted', handleMessageDeleted);
      realtime.off('reaction.added', handleReactionAdded);
      realtime.off('reaction.removed', handleReactionRemoved);
    };
  }, [currentUserId, selectedConvId, queryClient, openThreadId]);

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

  const getUserById = (userId: string): User | undefined => {
    return (users as User[]).find((u: User) => u.id === userId);
  };
  
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

  if (!currentUserId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Welcome to Chat</h2>
          <p className="text-gray-600 mb-4">Please set your user ID to start chatting</p>
          <Button onClick={() => {/* TODO: Open user selection modal */}}>
            Select User
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* 🎨 Sidebar - Responsive with Mobile Overlay */}
      <div className={cn(
        "md:flex md:w-80 lg:w-96 bg-white border-r border-gray-200 flex-col shadow-lg z-50",
        "fixed md:relative inset-y-0 left-0 transform transition-transform duration-300 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-4 border-b border-gray-200 bg-gradient-to-br from-blue-500 to-blue-600">
          {/* Close button - Mobile only */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-white">💬 Chats</h1>
            <div className={cn(
              'w-3 h-3 rounded-full shadow-lg transition-all',
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
            )} />
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchOpen(true)}
            className="w-full justify-start text-white border-white/30 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl font-semibold shadow-md"
          >
            🔍 Search messages... <span className="ml-auto text-xs opacity-75">⌘K</span>
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {(conversations as Conversation[]).map((conv: Conversation) => (
            <ConversationItem
              key={conv.id}
              id={conv.id}
              title={conv.title || undefined}
              type={conv.type}
              members={conv.members}
              lastMessage={conv.lastMessage || undefined}
              isSelected={conv.id === selectedConvId}
              onClick={() => setSelectedConvId(conv.id)}
              users={users as User[]}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConv ? (
          <>
            {/* 💎 Chat Header - Responsive with Hamburger */}
            <div className="bg-white border-b border-gray-200 p-3 sm:p-4 flex items-center gap-3 shadow-sm">
              {/* Hamburger Menu - Mobile Only */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Toggle menu"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-900">
                {selectedConv.title || 
                  (selectedConv.type === 'DIRECT' 
                    ? getUserById(selectedConv.members.find((m: ConversationMember) => m.userId !== currentUserId)?.userId || '')?.name || 'Direct Chat'
                    : `Group Chat (${selectedConv.members.length})`
                  )
                }
              </h2>
              </div>
              {selectedConv.type === 'DIRECT' && peerPresence && (
                <div className="flex-shrink-0">
                <div className="text-sm mt-2">
                  {peerPresence.online ? (
                    <span className="text-emerald-600 flex items-center gap-2 font-semibold">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50"></span>
                      Online
                    </span>
                  ) : (
                    <span className="text-slate-500 font-medium">
                      Last seen {peerPresence.lastSeen ? new Date(peerPresence.lastSeen).toLocaleString() : '—'}
                    </span>
                  )}
                </div>
                </div>
              )}
            </div>

            {/* 📱 Messages Area - Messenger Style */}
            <div id="messages-container" className="flex-1 overflow-y-auto p-4 md:p-6 bg-gradient-to-b from-blue-50/30 to-transparent flex flex-col-reverse">
              {messagesLoading ? (
                <div className="flex items-center justify-center flex-1">
                  <div className="text-gray-500">Loading messages...</div>
                </div>
              ) : messagesError ? (
                <div className="flex items-center justify-center flex-1">
                  <div className="text-red-500">Error loading messages: {messagesError.message}</div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center flex-1">
                  <div className="text-center">
                    <div className="text-4xl mb-2">💬</div>
                    <div className="text-gray-500">No messages yet. Start a conversation!</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 flex flex-col-reverse">
                  {messages.map((message: Message) => {
                    const user = getUserById(message.senderId);
                    console.log('🔥 Message user lookup:', { 
                      messageId: message.id, 
                      senderId: message.senderId,
                      user,
                      allUsers: users 
                    });
                    return (
                      <MessageItem
                        key={message.id}
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
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Message Input */}
            <MessageInput
              onSend={handleSendMessage}
              onFileUpload={handleFileUpload}
              disabled={sendMessageMutation.isPending}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
              <p>Choose a conversation from the sidebar to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* Search Modal with Results */}
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
    </div>
  );
}