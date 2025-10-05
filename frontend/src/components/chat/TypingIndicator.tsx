import { useMemo } from 'react';
import type { User } from '../../types';
import { cn } from '../../utils/cn';

interface TypingIndicatorProps {
  typingUserIds: string[];
  users: User[];
  currentUserId: string;
  className?: string;
}

export function TypingIndicator({
  typingUserIds,
  users,
  currentUserId,
  className,
}: TypingIndicatorProps) {
  const typingNames = useMemo(() => {
    return typingUserIds
      .filter((uid) => uid !== currentUserId)
      .map((uid) => {
        const user = users.find((u) => u.id === uid);
        return user?.name || user?.email?.split('@')[0] || 'Someone';
      });
  }, [typingUserIds, users, currentUserId]);

  if (typingNames.length === 0) return null;

  const getMessage = () => {
    if (typingNames.length === 1) {
      return `${typingNames[0]} is typing`;
    } else if (typingNames.length === 2) {
      return `${typingNames[0]} and ${typingNames[1]} are typing`;
    } else {
      return `${typingNames[0]} and ${typingNames.length - 1} others are typing`;
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-2 text-sm text-gray-500',
        className,
      )}
    >
      <div className="flex gap-1">
        <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
        <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
        <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
      </div>
      <span className="font-medium">{getMessage()}...</span>
    </div>
  );
}
