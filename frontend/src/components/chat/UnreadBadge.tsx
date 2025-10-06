import { useUnreadCount } from '../../hooks/useReads';

interface UnreadBadgeProps {
  conversationId: string;
  className?: string;
}

export function UnreadBadge({ conversationId, className = '' }: UnreadBadgeProps) {
  const { data: unread } = useUnreadCount(conversationId);

  if (!unread || unread.count === 0) return null;

  return (
    <div
      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full ${className}`}
    >
      {unread.count > 99 ? '99+' : unread.count}
    </div>
  );
}
