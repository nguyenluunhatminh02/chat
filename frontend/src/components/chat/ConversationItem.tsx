import { cn } from '../../utils/cn';
import { formatTime } from '../../utils/helpers';
import type { User } from '../../types';

interface ConversationItemProps {
  id: string;
  title?: string;
  type: 'DIRECT' | 'GROUP';
  members: { userId: string }[];
  lastMessage?: {
    content: string;
    createdAt: string;
    user: User;
  };
  isSelected: boolean;
  onClick: () => void;
  users: User[];
  currentUserId: string;
}

export function ConversationItem({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  id: _id,
  title,
  type,
  members,
  lastMessage,
  isSelected,
  onClick,
  users,
  currentUserId,
}: ConversationItemProps) {
  const getDisplayTitle = () => {
    if (title) return title;
    if (type === 'DIRECT') {
      const otherId = members.find(m => m.userId !== currentUserId)?.userId;
      const otherUser = users.find(u => u.id === otherId);
      return otherUser?.name || otherUser?.email || 'Unknown User';
    }
    return `Group Chat (${members.length})`;
  };

  const getLastMessagePreview = () => {
    if (!lastMessage || !lastMessage.content) return 'No messages yet';
    
    // Handle IMAGE/FILE type messages (content is JSON)
    if (lastMessage.content.startsWith('{')) {
      try {
        const parsed = JSON.parse(lastMessage.content);
        if (parsed.filename) {
          return `📎 ${parsed.filename}`;
        }
      } catch {
        // Fall through to regular content
      }
    }
    
    return lastMessage.content.length > 50 
      ? lastMessage.content.substring(0, 50) + '...'
      : lastMessage.content;
  };

  const getInitials = () => {
    const title = getDisplayTitle();
    const words = title.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return title.substring(0, 2).toUpperCase();
  };

  const getAvatarGradient = () => {
    const title = getDisplayTitle();
    const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const gradients = [
      'from-violet-500 to-purple-600',
      'from-blue-500 to-cyan-600',
      'from-emerald-500 to-teal-600',
      'from-amber-500 to-orange-600',
      'from-rose-500 to-pink-600',
      'from-indigo-500 to-blue-600',
    ];
    return gradients[hash % gradients.length];
  };

  return (
    <div
      className={cn(
        'group relative flex cursor-pointer items-center gap-3 px-4 py-3 transition-all duration-200',
        'hover:bg-white/60 active:scale-[0.98]',
        isSelected 
          ? 'bg-white shadow-md' 
          : 'bg-transparent'
      )}
      onClick={onClick}
    >
      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-r-full" />
      )}
      
      {/* Avatar with Gradient - Responsive */}
      <div className="flex-shrink-0 relative">
        <div className={cn(
          'h-11 w-11 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-gradient-to-br flex items-center justify-center',
          'text-white font-bold text-xs sm:text-sm shadow-lg transform transition-transform group-hover:scale-105',
          getAvatarGradient()
        )}>
          {getInitials()}
        </div>
        {/* Online indicator for DIRECT chats */}
        {type === 'DIRECT' && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className={cn(
            'text-[15px] font-semibold truncate',
            isSelected ? 'text-gray-900' : 'text-gray-800'
          )}>
            {getDisplayTitle()}
          </h3>
          {lastMessage && (
            <span className="text-[11px] font-medium text-gray-500 ml-2">
              {formatTime(lastMessage.createdAt)}
            </span>
          )}
        </div>
        
        <p className={cn(
          'text-[13px] truncate leading-tight',
          isSelected ? 'text-gray-600' : 'text-gray-500'
        )}>
          {lastMessage ? (
            <>
              <span className="font-semibold">{lastMessage.user.name || lastMessage.user.email.split('@')[0]}</span>
              <span className="text-gray-400 mx-1">·</span>
              <span>{getLastMessagePreview()}</span>
            </>
          ) : (
            <span className="italic">Start a conversation</span>
          )}
        </p>
      </div>
      
      {/* Unread badge - Future feature */}
    </div>
  );
}