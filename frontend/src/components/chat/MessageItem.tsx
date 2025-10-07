import { memo, useState, useEffect } from 'react';
import { cn } from '../../utils/cn';
import { formatTime } from '../../utils/helpers';
import { tryParseFileContent } from '../../utils/file';
import { ReactionPicker } from './ReactionPicker';
import { ThreadPanel } from './ThreadPanel';
import { ReportMessageModal } from './ReportMessageModal';
import { BlockUserModal } from './BlockUserModal';
import { PinButton } from './PinButton';
import { MessageActionsMenu } from './MessageActionsMenu';
import { DevBoundary } from '../DevTools';
import { renderMarkdown } from '../../utils/markdown';
import { useLinkPreviews } from '../../hooks/useLinkPreviews';
import { LinkPreviewCard } from './LinkPreviewCard';
import type { Message, User } from '../../types';
import type { LinkPreview } from '../../lib/link-preview';

interface PreviewReadyEvent {
  messageId?: string;
  previews?: LinkPreview[];
}

type SocketClient = {
  on: (event: string, callback: (data: PreviewReadyEvent) => void) => void;
  off: (event: string, callback: (data: PreviewReadyEvent) => void) => void;
};

declare global {
  interface Window {
    socket?: SocketClient;
  }
}

interface MessageItemProps {
  message: Message;
  user?: User;
  isOwn: boolean;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onReact?: (emoji: string) => void;
  reactions?: Record<string, string[]>; // emoji -> userIds
  onEnsureReactions?: () => void;
  replyCount?: number;
  onOpenThread?: () => void;
  threadOpen?: boolean;
  threadMessages?: Message[];
  threadInput?: string;
  onThreadInputChange?: (value: string) => void;
  onSendThreadReply?: () => void;
  getUserById?: (userId: string) => User | undefined;
  currentUserId?: string;
  isPinned?: boolean;
}

// 🎨 Generate 2-letter initials from name
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// 🌈 Generate gradient based on name hash (6 modern gradients)
function getAvatarGradient(name: string): string {
  const gradients = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-red-600',
    'from-pink-500 to-rose-600',
    'from-indigo-500 to-blue-600',
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return gradients[Math.abs(hash) % gradients.length];
}

function MessageItemInner({
  message,
  user,
  isOwn,
  onEdit,
  onDelete,
  onReact,
  reactions = {},
  onEnsureReactions,
  replyCount = 0,
  onOpenThread,
  threadOpen = false,
  threadMessages = [],
  threadInput = '',
  onThreadInputChange,
  onSendThreadReply,
  getUserById,
  currentUserId,
  isPinned,
}: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [linkPreviews, setLinkPreviews] = useState<LinkPreview[]>([]);
  
  const fileContent = tryParseFileContent(message.content);
  const isDeleted = message.deletedAt;
  
  // Fetch link previews for text messages with URLs
  const shouldFetchPreviews = message.type === 'TEXT' && !!message.content && /https?:\/\//.test(message.content);
  const { data: fetchedPreviews } = useLinkPreviews(shouldFetchPreviews ? message.id : undefined, shouldFetchPreviews);
  
  // Listen for realtime preview.ready events
  useEffect(() => {
      const handlePreviewReady = (data: PreviewReadyEvent) => {
        if (data.messageId === message.id && Array.isArray(data.previews)) {
          setLinkPreviews(data.previews);
      }
    };
    
    // Subscribe to socket event (you'll need to add this to your socket listeners)
      if (window.socket) {
        window.socket.on('preview.ready', handlePreviewReady);
        return () => {
          window.socket?.off('preview.ready', handlePreviewReady);
        };
    }
  }, [message.id]);
  
  // Update link previews from fetched data
  useEffect(() => {
    if (fetchedPreviews && fetchedPreviews.length > 0) {
      setLinkPreviews(fetchedPreviews);
    }
  }, [fetchedPreviews]);
  
  const handleStartEdit = () => {
    setIsEditing(true);
    setEditText(message.content || '');
  };
  
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText('');
  };
  
  const handleSaveEdit = () => {
    if (editText.trim() && onEdit) {
      onEdit(message.id, editText.trim());
      setIsEditing(false);
      setEditText('');
    }
  };

  const renderContent = () => {
    if (isDeleted) {
      return (
        <div className="text-sm italic text-gray-400">
          This message was deleted
        </div>
      );
    }

    // Handle IMAGE type messages
    if (message.type === 'IMAGE' && fileContent) {
      if (fileContent.url) {
        return (
          <a href={fileContent.url} target="_blank" rel="noreferrer" className="block max-w-full group">
            <img
              src={fileContent.thumbUrl || fileContent.url}
              alt={fileContent.filename}
              loading="lazy"
              decoding="async"
              className="object-contain max-w-full transition-shadow shadow-md max-h-72 rounded-xl group-hover:shadow-xl"
            />
            <div className="mt-2 text-xs font-medium opacity-80">
              {fileContent.filename} {fileContent.size ? `· ${(fileContent.size / 1024).toFixed(1)} KB` : ''}
            </div>
          </a>
        );
      } else {
        return (
          <div className="p-4 text-center border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
            <div className="mb-2 text-4xl animate-pulse">🖼️</div>
            <p className="text-sm font-semibold text-gray-700">{fileContent.filename}</p>
            <p className="mt-1 text-xs font-medium text-blue-600">Uploading image...</p>
          </div>
        );
      }
    }

    // Handle FILE type messages
    if (message.type === 'FILE' && fileContent) {
      if (fileContent.url) {
        return (
          <a href={fileContent.url} target="_blank" rel="noreferrer" className="block group">
            <div className="flex items-center p-3 space-x-3 transition-all border-2 border-gray-200 bg-white/90 rounded-xl hover:border-blue-400 hover:shadow-md">
              <div className="flex items-center justify-center flex-shrink-0 w-10 h-10 text-xl rounded-lg shadow-sm bg-gradient-to-br from-blue-400 to-indigo-500">📎</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-blue-600">{fileContent.filename}</p>
                {fileContent.size && (
                  <p className="text-xs font-medium text-gray-500">{(fileContent.size / 1024).toFixed(1)} KB</p>
                )}
              </div>
            </div>
          </a>
        );
      } else {
        return (
          <div className="flex items-center p-3 space-x-3 border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
            <div className="flex items-center justify-center flex-shrink-0 w-10 h-10 text-xl rounded-lg shadow-sm bg-gradient-to-br from-blue-400 to-indigo-500 animate-pulse">📎</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-700 truncate">{fileContent.filename}</p>
              <p className="text-xs font-medium text-blue-600">Uploading...</p>
            </div>
          </div>
        );
      }
    }

    // Text message with Markdown rendering
    if (message.type === 'TEXT' && message.content) {
      const html = renderMarkdown(message.content);
      return (
        <>
          <div
            className="leading-relaxed prose-sm prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {/* Link previews */}
          {linkPreviews.length > 0 && (
            <div className="mt-2 space-y-2">
              {linkPreviews.slice(0, 3).map((preview, idx) => (
                <LinkPreviewCard key={`${preview.url}-${idx}`} preview={preview} />
              ))}
              {linkPreviews.length > 3 && (
                <div className="text-xs italic text-gray-400">
                  +{linkPreviews.length - 3} more link{linkPreviews.length - 3 > 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}
        </>
      );
    }

    // Fallback - show content anyway if exists
    if (message.content) {
      const html = renderMarkdown(message.content);
      return (
        <div
          className="leading-relaxed prose-sm prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    return <p className="italic text-gray-400">Empty message</p>;
  };

  return (
    <DevBoundary 
      name="MessageItem" 
      filePath="src/components/chat/MessageItem.tsx"
    >
      <div 
        data-message-id={message.id}
        className={cn(
          'flex w-full mb-2 transition-all duration-200',
          isOwn ? 'justify-end' : 'justify-start'
        )}
      >
        <div className={cn(
          'flex gap-2 max-w-[80%] sm:max-w-[70%] md:max-w-[65%] group',
          isOwn ? 'flex-row-reverse' : 'flex-row'
        )}>
        {/* 🎨 Messenger Avatar - Circular */}
        <div className="flex-shrink-0 self-end mb-0.5 flex items-end gap-1">
          <div className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md transition-all duration-200 select-none bg-gradient-to-br hover:scale-110',
            getAvatarGradient(user?.name || user?.email || 'User')
          )}>
            {getInitials(user?.name || user?.email || 'User')}
          </div>
          
          {/* Three-dots menu next to avatar */}
          {!isEditing && !isDeleted && (
            <MessageActionsMenu
              isOwn={isOwn}
              canEdit={!!onEdit}
              canDelete={!!onDelete}
              onEdit={onEdit ? handleStartEdit : undefined}
              onDelete={onDelete ? () => onDelete(message.id) : undefined}
              onReport={!isOwn && user ? () => setReportModalOpen(true) : undefined}
              onBlock={!isOwn && user ? () => setBlockModalOpen(true) : undefined}
              onCopy={message.type === 'TEXT' && message.content ? () => {
                navigator.clipboard.writeText(message.content || '');
              } : undefined}
              className="text-gray-600 transition-opacity opacity-0 group-hover:opacity-100"
            />
          )}
        </div>
        
        <div className={cn(
          'flex flex-col',
          isOwn ? 'items-end' : 'items-start'
        )}>
          {/* Timestamp - Messenger style (shows on hover) */}
          <div className={cn(
            'flex items-center gap-1 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
            isOwn ? 'flex-row-reverse' : 'flex-row'
          )}>
            <p className="text-[11px] font-normal text-gray-500 whitespace-nowrap">
              {formatTime(message.createdAt)}
            </p>
          </div>
          
          {/* � Pinned Badge (visible to all users) */}
          {isPinned && (
            <div className="flex items-center gap-1.5 mb-1 px-2 py-1 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full w-fit shadow-md">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span className="text-[10px] font-bold text-white uppercase tracking-wide">PINNED</span>
            </div>
          )}
          
          {/* �💬 Messenger Style Message Bubble - Improved */}
          <div className="relative group/bubble">
            {/* Message Tail - Messenger style */}
            {!isEditing && (
              <span 
                aria-hidden 
                className={cn(
                  'absolute -bottom-0.5 w-3 h-3 pointer-events-none',
                  isOwn 
                    ? 'right-0 translate-x-[6px]'
                    : 'left-0 -translate-x-[6px]'
                )}
              >
                <svg viewBox="0 0 8 13" className={isOwn ? 'text-[#0084ff]' : 'text-[#e4e6eb]'}>
                  <path d={isOwn ? "M1.533,3.568L8,12.193V1H2.812 C1.042,1,0.474,2.156,1.533,3.568z" : "M5.188,1H0v11.193l6.467-8.625 C7.526,2.156,6.958,1,5.188,1z"} fill="currentColor"/>
                </svg>
              </span>
            )}
            
            <div 
              className={cn(
                'relative rounded-2xl px-3 py-2 min-w-[60px] max-w-full transition-all duration-200',
                isOwn 
                  ? 'bg-[#0084ff] text-white shadow-sm' 
                  : 'bg-[#e4e6eb] text-[#050505]',
                isEditing && 'ring-2 ring-blue-400 shadow-md'
              )}
              onMouseEnter={onEnsureReactions}
            >
              {isEditing ? (
                <div className="space-y-4">
                  <input
                    autoFocus
                    type="text"
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="w-full px-4 py-3 text-sm font-medium border-2 border-indigo-300 shadow-inner rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/95"
                  />
                  <div className="flex gap-2.5">
                    <button
                      onClick={handleSaveEdit}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-2xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-md transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-[16px] leading-relaxed break-words min-w-0">
                    {renderContent()}
                  </div>
                  {message.editedAt && (
                    <div className={cn(
                      'mt-2 flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider',
                      isOwn ? 'text-white/70' : 'text-gray-400'
                    )}>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full font-bold',
                        isOwn ? 'bg-white/20' : 'bg-gray-200'
                      )}>
                        Edited
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {!isDeleted && (
            <>
              {/* 🎨 Reactions & Reply Row - Always Visible */}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {/* Reactions - Always visible when they exist */}
                {Object.keys(reactions)
                  .sort()
                  .map(emoji => {
                    const userIds = reactions[emoji] || [];
                    const count = userIds.length;
                    if (count === 0) return null;
                    const byMe = currentUserId ? userIds.includes(currentUserId) : false;
                    return (
                      <button
                        key={emoji}
                        type="button"
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all duration-200 transform hover:scale-110 active:scale-95 font-medium',
                          byMe 
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg ring-2 ring-blue-300'
                            : 'bg-white text-gray-800 shadow-md border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg'
                        )}
                        onClick={() => onReact?.(emoji)}
                        title={`${count} reaction${count > 1 ? 's' : ''}${byMe ? ' · you reacted' : ''}`}
                        aria-pressed={byMe}
                      >
                        <span className="text-lg leading-none">{emoji}</span>
                        <span className="text-sm font-bold tabular-nums">{count}</span>
                      </button>
                    );
                  })}
                
                {/* Add reaction button - Always visible with icon */}
                {onReact && (
                  <ReactionPicker onPick={onReact}>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center w-8 h-8 text-gray-500 transition-all bg-white border-2 border-gray-200 rounded-full shadow-sm hover:bg-gray-50 hover:border-blue-400 hover:shadow-md hover:scale-110 active:scale-95"
                      title="Add reaction"
                    >
                      <span className="text-base font-semibold">➕</span>
                    </button>
                  </ReactionPicker>
                )}
                
                {/* Pin button (Messenger style) - Everyone can pin/unpin */}
                <PinButton 
                  messageId={message.id} 
                  isPinned={isPinned || false} 
                  canPin={true}
                  canUnpin={true}
                />
                
                {/* Reply button - Messenger style */}
                {onOpenThread && replyCount > 0 && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 transition-all shadow-sm hover:shadow-md"
                    onClick={onOpenThread}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                  </button>
                )}
              </div>
              

            </>
          )}
          
          {/* Thread Panel */}
          {threadOpen && getUserById && currentUserId && onThreadInputChange && onSendThreadReply && (
            <ThreadPanel
              parentId={message.id}
              messages={threadMessages}
              currentUserId={currentUserId}
              getUserById={getUserById}
              threadInput={threadInput}
              setThreadInput={onThreadInputChange}
              onSendReply={onSendThreadReply}
            />
          )}
        </div>
      </div>
    </div>

    {/* Moderation Modals */}
    {!isOwn && user && (
      <>
        <ReportMessageModal
          open={reportModalOpen}
          onOpenChange={setReportModalOpen}
          messageId={message.id}
          messageContent={message.content || undefined}
        />
        <BlockUserModal
          open={blockModalOpen}
          onOpenChange={setBlockModalOpen}
          userId={user.id}
          userName={user.name || user.email}
        />
      </>
    )}
    </DevBoundary>
  );
}

// Memoized to prevent unnecessary re-renders unless relevant props change
export const MessageItem = memo(MessageItemInner, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.deletedAt === next.message.deletedAt &&
    prev.message.editedAt === next.message.editedAt &&
    prev.isOwn === next.isOwn &&
    prev.isPinned === next.isPinned &&
    prev.replyCount === next.replyCount &&
    prev.threadOpen === next.threadOpen &&
    prev.threadInput === next.threadInput &&
    // Shallow checks for handlers (assumed stable from parents via useCallback)
    prev.onEdit === next.onEdit &&
    prev.onDelete === next.onDelete &&
    prev.onReact === next.onReact &&
    prev.onEnsureReactions === next.onEnsureReactions &&
    prev.onOpenThread === next.onOpenThread &&
    prev.onThreadInputChange === next.onThreadInputChange &&
    prev.onSendThreadReply === next.onSendThreadReply &&
    // Reactions object can be large; if reference stable, assume unchanged
    prev.reactions === next.reactions &&
    // User minimal fields for avatar display
    (prev.user?.id === next.user?.id && prev.user?.name === next.user?.name)
  );
});