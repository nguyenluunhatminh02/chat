import { cn } from '../../utils/cn';
import { formatTime } from '../../utils/helpers';
import type { User } from '../../types';
import { DevBoundary } from '../DevTools';
import { useQuery } from '@tanstack/react-query';
import * as api from '../../lib/api';

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
  id,
  title,
  type,
  members,
  lastMessage,
  isSelected,
  onClick,
  users,
  currentUserId,
}: ConversationItemProps) {
  // Fetch unread count for this conversation
  const { data: unreadData } = useQuery({
    queryKey: ['unread', currentUserId, id],
    queryFn: () => api.getUnreadCount(currentUserId, id),
    enabled: !!currentUserId && !!id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const unreadCount = unreadData?.unread || 0;

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
    <DevBoundary 
          name="ConversationItem" 
          filePath="src/components/chat/ConversationItem.tsx"
        >
    <div
      className={cn(
        'group relative flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-all duration-150',
        'hover:bg-gray-100 active:bg-gray-200',
        isSelected && 'bg-gray-100'
      )}
      onClick={onClick}
    >
      {/* Avatar - Messenger circular style */}
      <div className="flex-shrink-0 relative">
        <div className={cn(
          'h-14 w-14 rounded-full bg-gradient-to-br flex items-center justify-center',
          'text-white font-semibold text-base shadow-sm',
          getAvatarGradient()
        )}>
          {getInitials()}
        </div>
        {/* Online indicator for DIRECT chats */}
        {type === 'DIRECT' && (
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
        )}
      </div>
      
      {/* Content - Messenger style */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <h3 className="text-[15px] font-semibold truncate text-gray-900">
            {getDisplayTitle()}
          </h3>
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            {lastMessage && (
              <span className="text-[12px] text-gray-500">
                {formatTime(lastMessage.createdAt)}
              </span>
            )}
            {unreadCount > 0 && (
              <div className="bg-[#0084ff] text-white text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
          </div>
        </div>
        
        <p className={cn(
          "text-[13px] truncate",
          unreadCount > 0 ? "text-gray-900 font-semibold" : "text-gray-600"
        )}>
          {lastMessage ? (
            <span>{getLastMessagePreview()}</span>
          ) : (
            <span className="text-gray-400">No messages yet</span>
          )}
        </p>
      </div>
    </div>
    </DevBoundary>
  );
}