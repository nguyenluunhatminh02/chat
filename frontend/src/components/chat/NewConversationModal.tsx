// NewConversationModal.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  // DialogDescription, // nếu cần mô tả phụ
} from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../utils/cn';
import { useUsers } from '../../hooks/useUsers';
import { useAppContext } from '../../hooks/useAppContext';
import { useConversations } from '../../hooks/useConversations';
import type { User, Conversation } from '../../types';
import { X } from 'lucide-react';
// Nếu muốn ẩn tiêu đề:
// import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface NewConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateConversation: (
    type: 'DIRECT' | 'GROUP',
    members: string[],
    title?: string
  ) => Promise<void>;
}

export function NewConversationModal({
  open,
  onOpenChange,
  onCreateConversation,
}: NewConversationModalProps) {
  // data
  const { data: users = [] } = useUsers();
  const { currentUserId } = useAppContext();
  const { data: conversations = [] } = useConversations(currentUserId);

  const typedUsers = users as User[];
  const typedConversations = conversations as Conversation[];

  // state
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // reset state khi modal đóng
  useEffect(() => {
    if (!open) {
      setSelectedUsers([]);
      setGroupTitle('');
      setSearchQuery('');
      setLoading(false);
    }
  }, [open]);

  const availableUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return typedUsers
      .filter((u) => u.id !== currentUserId)
      .filter((u) =>
        q
          ? (u.name || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q)
          : true
      );
  }, [typedUsers, currentUserId, searchQuery]);

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) return;
    setLoading(true);
    try {
      if (selectedUsers.length === 1) {
        // check DIRECT exists
        const existingDirect = typedConversations.find(
          (conv) =>
            conv.type === 'DIRECT' &&
            conv.members.length === 2 &&
            conv.members.some((m) => m.userId === selectedUsers[0]) &&
            conv.members.some((m) => m.userId === currentUserId)
        );

        if (existingDirect) {
          // đóng modal, parent có thể chuyển chọn hội thoại sẵn có
          onOpenChange(false);
          await onCreateConversation('DIRECT', selectedUsers);
          return;
        }
        await onCreateConversation('DIRECT', selectedUsers);
      } else {
        await onCreateConversation('GROUP', selectedUsers, groupTitle || undefined);
      }
      onOpenChange(false);
    } catch (e) {
      console.error('Failed to create conversation:', e);
    } finally {
      setLoading(false);
    }
  };

  const isGroup = selectedUsers.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'z-[100] bg-white !p-0 flex flex-col', // z-index cao để không bị component fixed đè
          'w-[95vw] max-w-[480px] h-auto max-h-[85vh]',
          'sm:w-[480px]'
        )}
      >
        {/* Header sticky */}
        <div className="sticky top-0 z-20 px-4 pt-4 pb-3 bg-white border-b sm:px-6 sm:pt-6 sm:pb-4">
          <div className="flex items-center justify-between mb-4">
            {/* A11y: BẮT BUỘC phải có DialogTitle */}
            <DialogTitle asChild>
              <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
                New Conversation
              </h2>
            </DialogTitle>

            {/* Nếu muốn ẩn tiêu đề nhưng vẫn A11y, dùng:
            <VisuallyHidden asChild>
              <DialogTitle>New Conversation</DialogTitle>
            </VisuallyHidden>
            */}

            {/* Close button đúng chuẩn Radix */}
            <DialogClose asChild>
              <Button
                aria-label="Close"
                className="inline-flex items-center justify-center w-8 h-8 text-gray-700 rounded-full hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200"
              >
                X
              </Button>
            </DialogClose>
          </div>

          {/* Search */}
          <Input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-3"
          />

          {/* Group name input (conditional) */}
          {isGroup && (
            <Input
              type="text"
              placeholder="Group name (optional)"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              className="mb-3"
            />
          )}

          {/* Selection counter */}
          <div className="text-sm text-gray-600">
            {selectedUsers.length === 0 ? (
              <span>Select users to start a conversation</span>
            ) : (
              <span className="font-medium text-blue-600">
                {selectedUsers.length === 1
                  ? '1 user selected'
                  : `${selectedUsers.length} users selected`}
                {isGroup && ' · Group chat'}
              </span>
            )}
          </div>
        </div>

        {/* Body scroll area */}
        <div className="flex-1 min-h-0 px-4 py-3 overflow-y-auto sm:px-6 sm:py-4">
          {availableUsers.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <div className="text-center">
                <div className="mb-2 text-4xl">👥</div>
                <div className="text-sm">
                  {searchQuery ? 'No users found' : 'No users available'}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {availableUsers.map((user) => {
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
                      'w-full rounded-lg px-3 py-2.5 transition-all',
                      'flex items-center gap-3 text-left',
                      'hover:bg-gray-50 active:bg-gray-100',
                      isSelected && 'bg-blue-50 ring-2 ring-blue-400 hover:bg-blue-100'
                    )}
                  >
                    {/* Avatar */}
                    <div className="flex items-center justify-center flex-shrink-0 w-10 h-10 text-sm font-bold text-white rounded-full bg-gradient-to-br from-blue-400 to-indigo-500">
                      {initials}
                    </div>

                    {/* User info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">
                        {user.name || 'Unknown User'}
                      </div>
                      <div className="text-xs text-gray-500 truncate sm:text-sm">
                        {user.email}
                      </div>
                    </div>

                    {/* Checkbox */}
                    <div
                      className={cn(
                        'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-all',
                        isSelected
                          ? 'border-blue-500 bg-blue-500 scale-110'
                          : 'border-gray-300'
                      )}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-white"
                          viewBox="0 0 24 24"
                          fill="none"
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
              })}
            </div>
          )}
        </div>

        {/* Footer sticky */}
        <div className="sticky bottom-0 z-20 px-4 py-3 bg-white border-t sm:px-6 sm:py-4">
          <div className="flex gap-2 sm:gap-3">
            <DialogClose asChild>
              <Button variant="outline" className="flex-1" disabled={loading}>
                Cancel
              </Button>
            </DialogClose>

            <Button
              onClick={handleCreate}
              disabled={selectedUsers.length === 0 || loading}
              className="flex-1 bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" />
                  Creating...
                </span>
              ) : (
                'Create'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
