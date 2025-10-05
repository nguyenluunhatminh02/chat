import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../utils/cn';
import { useUsers } from '../../hooks/useUsers';
import { useAppContext } from '../../hooks/useAppContext';
import { useConversations } from '../../hooks/useConversations';
import type { User, Conversation } from '../../types';

interface NewConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateConversation: (type: 'DIRECT' | 'GROUP', members: string[], title?: string) => Promise<void>;
}

export function NewConversationModal({
  open,
  onOpenChange,
  onCreateConversation,
}: NewConversationModalProps) {
  // Get data from hooks
  const { data: users = [] } = useUsers();
  const { currentUserId } = useAppContext();
  const { data: conversations = [] } = useConversations(currentUserId);
  
  const typedUsers = users as User[];
  const typedConversations = conversations as Conversation[];
  
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Filter out current user and search
  const availableUsers = typedUsers
    .filter((u) => u.id !== currentUserId)
    .filter((u) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query)
      );
    });

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) return;

    setLoading(true);
    try {
      // Check if DIRECT conversation already exists
      if (selectedUsers.length === 1) {
        const existingDirect = typedConversations.find(
          (conv) =>
            conv.type === 'DIRECT' &&
            conv.members.length === 2 &&
            conv.members.some((m) => m.userId === selectedUsers[0]) &&
            conv.members.some((m) => m.userId === currentUserId)
        );

        if (existingDirect) {
          // Conversation exists, just close modal and let parent handle it
          onOpenChange(false);
          // Signal parent to select this conversation
          onCreateConversation('DIRECT', selectedUsers).then(() => {
            // Parent will handle selecting the existing conversation
          });
          return;
        }

        // Create new DIRECT conversation
        await onCreateConversation('DIRECT', selectedUsers);
      } else {
        // Create GROUP conversation
        await onCreateConversation('GROUP', selectedUsers, groupTitle || undefined);
      }

      // Reset and close
      setSelectedUsers([]);
      setGroupTitle('');
      setSearchQuery('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setGroupTitle('');
    setSearchQuery('');
    onOpenChange(false);
  };

  const isGroup = selectedUsers.length > 1;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">
            New Conversation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div>
            <Input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Group Title (only for groups) */}
          {isGroup && (
            <div>
              <Input
                type="text"
                placeholder="Group name (optional)"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                className="w-full"
              />
            </div>
          )}

          {/* Selected Users Count */}
          <div className="text-sm text-gray-600">
            {selectedUsers.length === 0 ? (
              'Select users to start a conversation'
            ) : selectedUsers.length === 1 ? (
              '1 user selected'
            ) : (
              `${selectedUsers.length} users selected (Group chat)`
            )}
          </div>

          {/* User List */}
          <div className="max-h-80 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
            {availableUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? 'No users found' : 'No users available'}
              </div>
            ) : (
              availableUsers.map((user) => {
                const isSelected = selectedUsers.includes(user.id);
                const initials = (user.name || user.email || 'U')
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleUser(user.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                      'hover:bg-gray-100',
                      isSelected && 'bg-blue-50 border-2 border-blue-500'
                    )}
                  >
                    {/* Avatar */}
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm',
                        'bg-gradient-to-br from-blue-400 to-indigo-500'
                      )}
                    >
                      {initials}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-gray-900">
                        {user.name || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>

                    {/* Checkbox */}
                    <div
                      className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                        isSelected
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-gray-300'
                      )}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={selectedUsers.length === 0 || loading}
              className="flex-1 bg-[#0084ff] hover:bg-[#0073e6]"
            >
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
