import { useEffect } from 'react';
import { useMessageReaders, useMarkRead } from '../../hooks/useReads';
import type { Message } from '../../types';

interface ReadReceiptsDisplayProps {
  message: Message;
  conversationId: string;
  currentUserId: string;
}

/**
 * ReadReceiptsDisplay - Hiển thị "✓✓ Seen by..." cho mỗi message
 * 
 * Rules:
 * - Chỉ hiển thị cho tin nhắn CỦA BẠN gửi
 * - Hiển thị danh sách người đã đọc
 * - Real-time update khi có người đọc
 */
export function ReadReceiptsDisplay({ 
  message, 
  currentUserId 
}: ReadReceiptsDisplayProps) {
  const { data: readersData } = useMessageReaders(message.id);
  const readers = readersData?.readers || [];

  // Chỉ hiển thị read receipts cho tin nhắn của chính mình
  if (message.senderId !== currentUserId) {
    return null;
  }

  if (readers.length === 0) {
    return (
      <div className="mt-1 text-xs text-gray-400">
        ✓ Sent
      </div>
    );
  }

  return (
    <div className="mt-1 text-xs text-blue-500">
      ✓✓ Seen by {readers.map((r: { userId: string; readAt: string }) => r.userId).join(', ')}
    </div>
  );
}

interface AutoMarkReadProps {
  conversationId: string;
  latestMessageId?: string;
  isVisible: boolean;
}

/**
 * AutoMarkRead - Component tự động mark read khi user xem conversation
 * 
 * Triggers:
 * - Conversation được mở
 * - User scroll đến tin nhắn mới nhất
 * - New message arrives và chat đang focus
 */
export function AutoMarkRead({ 
  conversationId, 
  latestMessageId,
  isVisible 
}: AutoMarkReadProps) {
  const markRead = useMarkRead();

  useEffect(() => {
    if (isVisible && latestMessageId && conversationId) {
      markRead.mutate({
        conversationId,
        opts: { messageId: latestMessageId }
      });
    }
  }, [conversationId, latestMessageId, isVisible, markRead]);

  return null; // Invisible component
}

interface ReadStatusIndicatorProps {
  messageId: string;
  senderId: string;
  currentUserId: string;
}

/**
 * ReadStatusIndicator - Simple checkmark indicator
 * ✓ = Sent
 * ✓✓ = Read by someone
 */
export function ReadStatusIndicator({
  messageId,
  senderId,
  currentUserId
}: ReadStatusIndicatorProps) {
  const { data: readersData } = useMessageReaders(messageId);
  const readers = readersData?.readers || [];

  // Only show for own messages
  if (senderId !== currentUserId) {
    return null;
  }

  const hasReaders = readers.length > 0;

  return (
    <span className={hasReaders ? 'text-blue-500' : 'text-gray-400'}>
      {hasReaders ? '✓✓' : '✓'}
    </span>
  );
}
