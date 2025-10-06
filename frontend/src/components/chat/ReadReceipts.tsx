import { useState } from 'react';
import { Eye } from 'lucide-react';
import { useMessageReaders } from '../../hooks/useReads';
import { formatTime } from '../../utils/helpers';
import type { User } from '../../types';

interface ReadReceiptsProps {
  messageId: string;
  getUserById?: (userId: string) => User | undefined;
  className?: string;
}

export function ReadReceipts({ messageId, getUserById, className = '' }: ReadReceiptsProps) {
  const { data } = useMessageReaders(messageId);
  const [showDetails, setShowDetails] = useState(false);

  if (!data || data.readers.length === 0) return null;

  const readers = data.readers;
  const count = readers.length;

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        title={`Seen by ${count} ${count === 1 ? 'person' : 'people'}`}
      >
        <Eye className="w-3 h-3" />
        <span className="font-medium">{count}</span>
      </button>

      {showDetails && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDetails(false)}
          />
          
          {/* Popup */}
          <div className="absolute bottom-full right-0 mb-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-80 overflow-auto">
            <div className="p-3 border-b bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-700">Seen by</h4>
            </div>
            <div className="divide-y">
              {readers.map((reader) => {
                const user = getUserById?.(reader.userId);
                return (
                  <div key={reader.userId} className="p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                        {(user?.name || user?.email || 'U').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {user?.name || user?.email || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          {formatTime(reader.readAt)}
                          {reader.inferred && (
                            <span className="text-[10px] text-gray-400">(inferred)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
