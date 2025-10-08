import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { cn } from '../../utils/cn';

interface TypingIndicatorProps {
  conversationId: string;
  currentUserId: string;
  className?: string;
}

export function TypingIndicator({
  conversationId,
  currentUserId,
  className,
}: TypingIndicatorProps) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    // Poll for typing users every 2 seconds
    const fetchTyping = async () => {
      try {
        const response = await api.get<{ users: string[] }>(
          `/presence/typing/${conversationId}`,
        );
        // Safe filter with fallback
        const users = response.data?.users || [];
        const others = users.filter((uid) => uid !== currentUserId);
        setTypingUsers(others);
      } catch {
        // Silently fail if backend not running
        setTypingUsers([]);
      }
    };

    fetchTyping();
    const interval = setInterval(fetchTyping, 2000);

    return () => clearInterval(interval);
  }, [conversationId, currentUserId]);

  if (typingUsers.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <div className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>
        {typingUsers.length === 1 && 'Someone is typing...'}
        {typingUsers.length === 2 && '2 people are typing...'}
        {typingUsers.length > 2 && `${typingUsers.length} people are typing...`}
      </span>
    </div>
  );
}
