import { X, Pin as PinIcon } from 'lucide-react';
import { usePins } from '../../hooks/usePins';
import { formatTime } from '../../utils/helpers';
import type { User } from '../../types';

interface PinnedMessagesPanelProps {
  conversationId: string;
  onClose: () => void;
  onMessageClick?: (messageId: string) => void;
  getUserById?: (userId: string) => User | undefined;
}

export function PinnedMessagesPanel({
  conversationId,
  onClose,
  onMessageClick,
  getUserById,
}: PinnedMessagesPanelProps) {
  const { data: pinsData, isLoading } = usePins(conversationId);
  const pins = pinsData?.items || [];

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-blue-500 to-indigo-600">
        <div className="flex items-center gap-2 text-white">
          <PinIcon className="w-5 h-5" />
          <h2 className="text-lg font-bold">Pinned Messages</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-gradient-to-bl bg-white/20 transition-colors text-white"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : pins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 px-4 py-8">
            <PinIcon className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-center font-medium">No pinned messages</p>
            <p className="text-sm text-center mt-2 opacity-75">
              Admins can pin important messages
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {pins.map((pin) => {
              const sender = getUserById?.(pin.message.senderId);
              const pinner = getUserById?.(pin.pinnedBy);
              
              return (
                <div
                  key={pin.id}
                  onClick={() => onMessageClick?.(pin.message.id)}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  {/* Pinner info */}
                  <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                    <PinIcon className="w-3 h-3" />
                    <span>
                      Pinned by <span className="font-semibold">{pinner?.name || 'Unknown'}</span>
                    </span>
                    <span>·</span>
                    <span>{formatTime(pin.pinnedAt)}</span>
                  </div>

                  {/* Message preview */}
                  <div className="bg-gray-100 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-gray-900">
                        {sender?.name || 'Unknown'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTime(pin.message.createdAt)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 line-clamp-3">
                      {pin.message.type === 'TEXT' ? (
                        pin.message.content
                      ) : pin.message.type === 'IMAGE' ? (
                        <span className="italic flex items-center gap-1">
                          🖼️ Image
                        </span>
                      ) : pin.message.type === 'FILE' ? (
                        <span className="italic flex items-center gap-1">
                          📎 File
                        </span>
                      ) : (
                        <span className="italic">Message</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
