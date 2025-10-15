import { memo, useMemo } from 'react';
import { cn } from '../../utils/cn';
import { formatTime } from '../../utils/helpers';
import type { User } from '../../types';
import { DevBoundary } from '../DevTools';
import { useQuery } from '@tanstack/react-query';
import * as api from '../../lib/api';
import type { PresenceResponse } from '../../lib/api';
import { UnreadBadge } from './UnreadBadge';
import { useUnreadCount } from '../../hooks/useReads';
import { Users } from 'lucide-react';

interface ConversationItemProps {
  id: string;
  title?: string;
  avatarUrl?: string | null;
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

export const ConversationItem = memo(function ConversationItem({
  id,
  title,
  avatarUrl,
  type,
  members,
  lastMessage,
  isSelected,
  onClick,
  users,
  currentUserId,
}: ConversationItemProps) {
  const otherUserId = useMemo(
    () =>
      type === 'DIRECT'
        ? members.find((m) => m.userId !== currentUserId)?.userId ?? null
        : null,
    [type, members, currentUserId],
  );

  const shouldTrackPresence =
    type === 'DIRECT' && Boolean(otherUserId) && isSelected;

  const presenceQueryKey = useMemo(
    () => ['presence', otherUserId] as const,
    [otherUserId],
  );

  const { data: presenceData } = useQuery<PresenceResponse>({
    queryKey: presenceQueryKey,
    queryFn: () => {
      if (!otherUserId) {
        throw new Error('otherUserId is required for presence lookup');
      }
      return api.getPresence(otherUserId);
    },
    enabled: shouldTrackPresence,
    refetchInterval: shouldTrackPresence ? 15000 : false,
    staleTime: 15000,
  });

  const isOnline = presenceData?.online ?? false;

  // Use proper hook with includeSelf=false to exclude own messages
  const { data: unreadData } = useUnreadCount(id, false);
  const unreadCount = unreadData?.count || 0;

  const memberCount = members.length;

  const displayTitle = useMemo(() => {
    if (title) {
      return title;
    }

    if (type === 'DIRECT') {
      const otherUser = otherUserId
        ? users.find((u) => u.id === otherUserId)
        : undefined;
      return otherUser?.name || otherUser?.email || 'Unknown User';
    }

    return `Group Chat (${memberCount})`;
  }, [title, type, users, otherUserId, memberCount]);

  const lastMessagePreview = useMemo(() => {
    if (!lastMessage || !lastMessage.content) return 'No messages yet';

    if (lastMessage.content.startsWith('{')) {
      try {
        const parsed = JSON.parse(lastMessage.content);
        if (parsed.filename) {
          return `📎 ${parsed.filename}`;
        }
      } catch {
        // ignore parsing errors and fall back to raw content
      }
    }

    return lastMessage.content.length > 50
      ? `${lastMessage.content.substring(0, 50)}...`
      : lastMessage.content;
  }, [lastMessage]);

  const initials = useMemo(() => {
    const words = displayTitle.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return displayTitle.substring(0, 2).toUpperCase();
  }, [displayTitle]);

  const avatarGradient = useMemo(() => {
    const hash = displayTitle
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const gradients = [
      'from-violet-500 to-purple-600',
      'from-blue-500 to-cyan-600',
      'from-emerald-500 to-teal-600',
      'from-amber-500 to-orange-600',
      'from-rose-500 to-pink-600',
      'from-indigo-500 to-blue-600',
    ];
    return gradients[hash % gradients.length];
  }, [displayTitle]);

  return (
    <DevBoundary 
          name="ConversationItem" 
          filePath="src/components/chat/ConversationItem.tsx"
        >
    <div
      className={cn(
        'group relative flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-all duration-150',
        'hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600',
        isSelected && 'bg-gray-100 dark:bg-gray-700'
      )}
      onClick={onClick}
    >
      {/* Avatar - Messenger circular style */}
      <div className="relative flex-shrink-0">
        <div
          className={cn(
            'h-14 w-14 rounded-full bg-gradient-to-br flex items-center justify-center overflow-hidden',
            'text-white font-semibold text-base shadow-sm',
            avatarGradient,
          )}
        >
          {avatarUrl && type === 'GROUP' ? (
            <img 
              src={avatarUrl} 
              alt={displayTitle} 
              className="object-cover w-full h-full"
            />
          ) : (
            initials
          )}
        </div>
        {/* Online/Offline indicator for DIRECT chats */}
        {type === 'DIRECT' && (
          <div className={cn(
            "absolute bottom-0 right-0 w-4 h-4 border-2 border-white dark:border-gray-800 rounded-full",
            isOnline ? "bg-green-500" : "bg-red-500"
          )}></div>
        )}
      </div>
      
      {/* Content - Messenger style */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold truncate text-gray-900 dark:text-gray-100">
              {displayTitle}
            </h3>
            {/* GROUP indicator */}
            {type === 'GROUP' && (
              <Users className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center flex-shrink-0 gap-2 ml-2">
            {lastMessage && (
              <span className="text-[12px] text-gray-500 dark:text-gray-400">
                {formatTime(lastMessage.createdAt)}
              </span>
            )}
            <UnreadBadge conversationId={id} className="bg-[#0084ff]" />
          </div>
        </div>
        
        <p className={cn(
          "text-[13px] truncate",
          unreadCount > 0 ? "text-gray-900 dark:text-gray-100 font-semibold" : "text-gray-600 dark:text-gray-400"
        )}>
          {lastMessage ? (
            <span>{lastMessagePreview}</span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">
              No messages yet
            </span>
          )}
        </p>
      </div>
    </div>
    </DevBoundary>
  );
});
