import { useEffect, useState, useRef } from 'react';
import { useMentionSuggestions } from '../../hooks/useMentions';
import { User } from 'lucide-react';

interface Props {
  conversationId: string;
  query: string; // text after @
  position: { top: number; left: number }; // cursor position
  onSelect: (userId: string, name: string) => void;
  onClose: () => void;
}

export function MentionAutocomplete({
  conversationId,
  query,
  position,
  onSelect,
  onClose,
}: Props) {
  const { data: users, isLoading } = useMentionSuggestions(
    conversationId,
    query
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!users?.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % users.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + users.length) % users.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const user = users[selectedIndex];
        if (user) {
          onSelect(user.id, user.name || user.email);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [users, selectedIndex, onSelect, onClose]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (isLoading) {
    return (
      <div
        ref={ref}
        className="absolute z-50 bg-white rounded-lg shadow-lg border p-2"
        style={{ top: position.top, left: position.left }}
      >
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!users?.length) {
    return null;
  }

  return (
    <div
      ref={ref}
      className="absolute z-50 bg-white rounded-lg shadow-lg border max-h-64 overflow-y-auto"
      style={{ top: position.top, left: position.left, minWidth: '250px' }}
    >
      {users.map((user, i) => (
        <button
          key={user.id}
          className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-blue-50 transition-colors ${
            i === selectedIndex ? 'bg-blue-50' : ''
          }`}
          onClick={() => onSelect(user.id, user.name || user.email)}
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name || user.email}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-gray-900">
              {user.name || user.email}
            </div>
            {user.name && (
              <div className="text-xs text-gray-500">{user.email}</div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
