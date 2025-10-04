import { useState } from 'react';
import { cn } from '../../utils/cn';
import { formatTime } from '../../utils/helpers';
import { tryParseFileContent } from '../../utils/file';
import { ReactionPicker } from './ReactionPicker';
import { ThreadPanel } from './ThreadPanel';
import type { Message, User } from '../../types';

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

export function MessageItem({
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
}: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  
  const fileContent = tryParseFileContent(message.content);
  const isDeleted = message.deletedAt;
  
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
        <div className="italic text-gray-500 bg-gray-100 rounded p-2">
          This message was deleted
        </div>
      );
    }

    // Handle IMAGE type messages
    if (message.type === 'IMAGE' && fileContent) {
      if (fileContent.url) {
        return (
          <a href={fileContent.url} target="_blank" rel="noreferrer" className="block max-w-full">
            <img
              src={fileContent.thumbUrl || fileContent.url}
              alt={fileContent.filename}
              className="max-h-72 max-w-full rounded-lg object-contain"
            />
            <div className="mt-1 text-xs opacity-70">
              {fileContent.filename} {fileContent.size ? `· ${(fileContent.size / 1024).toFixed(1)} KB` : ''}
            </div>
          </a>
        );
      } else {
        return (
          <div className="bg-gray-100 rounded p-3 text-center">
            <div className="text-4xl mb-2">🖼️</div>
            <p className="text-sm font-medium">{fileContent.filename}</p>
            <p className="text-xs text-gray-500 mt-1">Image uploading...</p>
          </div>
        );
      }
    }

    // Handle FILE type messages
    if (message.type === 'FILE' && fileContent) {
      if (fileContent.url) {
        return (
          <a href={fileContent.url} target="_blank" rel="noreferrer" className="block">
            <div className="flex items-center space-x-2 bg-gray-100 rounded p-2">
              <div className="flex-shrink-0 text-2xl">📎</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{fileContent.filename}</p>
                {fileContent.size && (
                  <p className="text-xs text-gray-500">{(fileContent.size / 1024).toFixed(1)} KB</p>
                )}
              </div>
            </div>
          </a>
        );
      } else {
        return (
          <div className="flex items-center space-x-2 bg-gray-100 rounded p-2">
            <div className="flex-shrink-0 text-2xl">📎</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fileContent.filename}</p>
              <p className="text-xs text-gray-500">Uploading...</p>
            </div>
          </div>
        );
      }
    }

    // Text message
    if (message.type === 'TEXT' && message.content) {
      return <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>;
    }

    // Fallback - show content anyway if exists
    if (message.content) {
      return <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>;
    }

    return <p className="text-gray-400 italic">Empty message</p>;
  };

  return (
    <div 
      data-message-id={message.id}
      className={cn(
        'flex w-full mb-6 transition-all duration-200',
        isOwn ? 'justify-end' : 'justify-start'
      )}
    >
      <div className={cn(
        'flex max-w-[85%] sm:max-w-[75%] md:max-w-[70%] lg:max-w-[65%] group',
        isOwn ? 'flex-row-reverse' : 'flex-row'
      )}>
        {/* 🎨 Modern Avatar with Gradient & Initials - Responsive */}
        <div className="flex-shrink-0">
          <div className={cn(
            'h-9 w-9 sm:h-10 sm:w-10 md:h-11 md:w-11 rounded-xl sm:rounded-2xl flex items-center justify-center text-xs sm:text-sm font-bold text-white shadow-lg transition-all duration-300 hover:scale-110 hover:rotate-3 select-none bg-gradient-to-br',
            getAvatarGradient(user?.name || user?.email || 'User')
          )}>
            {getInitials(user?.name || user?.email || 'User')}
          </div>
        </div>
        
        <div className={cn(
          'flex flex-col',
          isOwn ? 'items-end mr-2 sm:mr-3 md:mr-3.5' : 'items-start ml-2 sm:ml-3 md:ml-3.5'
        )}>
          {/* Name & Timestamp Header - Responsive */}
          <div className={cn(
            'flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-1.5',
            isOwn ? 'flex-row-reverse' : 'flex-row'
          )}>
            <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate max-w-[120px] sm:max-w-none">
              {user?.name || user?.email || 'Unknown User'}
            </p>
            <p className="text-[10px] sm:text-xs font-medium text-slate-500 whitespace-nowrap">
              {formatTime(message.createdAt)}
            </p>
          </div>
          
          {/* 💬 Messenger-style Bubble - Bo tròn tự nhiên */}
          <div 
            className={cn(
              'rounded-[20px] px-5 py-3 min-w-[140px] max-w-full transition-all duration-200 hover:shadow-lg',
              isOwn 
                ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md' 
                : 'bg-white border border-gray-200 text-gray-900 shadow-sm'
            )}
            onMouseEnter={onEnsureReactions}
          >
            {isEditing ? (
              <div className="space-y-3">
                <input
                  autoFocus
                  type="text"
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  className="w-full px-3 py-2 text-sm rounded-xl border-2 border-indigo-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-md hover:shadow-lg transition-all"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 text-sm font-semibold rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-[15px] leading-normal break-words min-w-0">
                {renderContent()}
              </div>
            )}
          </div>

          {!isDeleted && (
            <>
              {/* 🎨 Reactions & Reply Row - Responsive */}
              <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
                {/* Reactions */}
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
                        className={cn(
                          'group relative inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl font-bold transition-all',
                          byMe 
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5' 
                            : 'bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300 text-gray-900 shadow hover:shadow-md'
                        )}
                        onClick={() => onReact?.(emoji)}
                        title={`${count} reaction${count > 1 ? 's' : ''} ${byMe ? ' (including you)' : ''}`}
                      >
                        <span className="text-lg sm:text-2xl leading-none filter drop-shadow-sm">{emoji}</span>
                        <span className={cn(
                          'text-sm sm:text-base font-extrabold tabular-nums',
                          byMe ? 'text-white' : 'text-gray-700'
                        )}>{count}</span>
                      </button>
                    );
                  })}
                
                {/* Add reaction button */}
                {onReact && <ReactionPicker onPick={onReact} />}
                
                {/* Reply button - Responsive */}
                {onOpenThread && (
                  <button
                    className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl font-semibold bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300 text-gray-900 transition-all shadow hover:shadow-md"
                    onClick={onOpenThread}
                  >
                    <span className="text-lg sm:text-xl leading-none">💬</span>
                    <span className="text-xs sm:text-sm font-bold text-gray-700">{replyCount > 0 ? `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}` : 'Reply'}</span>
                  </button>
                )}
              </div>
              
              {/* ✏️ Edit/Delete buttons */}
              {!isEditing && (
                <div className="mt-2 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-200">
                  {isOwn && onEdit && (
                    <button
                      onClick={handleStartEdit}
                      className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
                    >
                      ✏️ Edit
                    </button>
                  )}
                  {isOwn && onDelete && (
                    <button
                      onClick={() => onDelete(message.id)}
                      className="text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              )}
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
  );
}