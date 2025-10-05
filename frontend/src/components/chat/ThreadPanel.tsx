import { formatTime } from '../../utils/helpers';
import type { Message, User } from '../../types';
import { DevBoundary } from '../DevTools';

interface ThreadPanelProps {
  parentId: string;
  messages: Message[];
  currentUserId: string;
  getUserById: (userId: string) => User | undefined;
  threadInput: string;
  setThreadInput: (value: string) => void;
  onSendReply: () => void;
}

export function ThreadPanel({
  messages,
  currentUserId,
  getUserById,
  threadInput,
  setThreadInput,
  onSendReply,
}: ThreadPanelProps) {
  return (
    <DevBoundary 
              name="ThreadPanel" 
              filePath="src/components/chat/ThreadPanel.tsx"
            >
    <div className="mt-2 border rounded-lg bg-gray-50">
      <div className="px-3 py-2 text-xs text-gray-600 border-b">Thread</div>
      
      <div className="max-h-56 overflow-auto px-3 pb-2 space-y-2">
        {messages.map(msg => {
          const user = getUserById(msg.senderId);
          const isOwn = msg.senderId === currentUserId;
          const isDeleted = !!msg.deletedAt;
          
          return (
            <div
              key={msg.id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${
                  isOwn
                    ? 'bg-gray-900 text-white rounded-br-sm'
                    : 'bg-white border rounded-bl-sm'
                } ${isDeleted ? 'opacity-80' : ''}`}
              >
                {!isDeleted ? (
                  <>
                    <div className="whitespace-pre-wrap break-words">
                      {msg.content}
                    </div>
                    <div
                      className={`mt-1 text-[10px] ${
                        isOwn ? 'text-gray-300' : 'text-gray-500'
                      }`}
                    >
                      {user?.name || user?.email || 'Unknown'} · {formatTime(msg.createdAt)}
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className={`italic ${
                        isOwn ? 'text-white' : 'text-gray-600'
                      }`}
                    >
                      This message was deleted
                    </div>
                    <div
                      className={`mt-1 text-[10px] ${
                        isOwn ? 'text-gray-300' : 'text-gray-500'
                      }`}
                    >
                      {formatTime(msg.createdAt)}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="border-t bg-white p-2 flex items-center gap-2">
        <input
          className="flex-1 rounded-full border-gray-300 px-3 py-1.5 text-sm"
          placeholder="Reply in thread…"
          value={threadInput}
          onChange={e => setThreadInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && threadInput.trim()) {
              onSendReply();
            }
          }}
        />
        <button
          className="rounded-full bg-emerald-600 text-white px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={!threadInput.trim()}
          onClick={onSendReply}
        >
          Send
        </button>
      </div>
    </div>
    </DevBoundary>
  );
}
