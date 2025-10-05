import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { useBlockUser } from '../../hooks/useModeration';
import { useAppContext } from '../../hooks/useAppContext';

interface BlockUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export function BlockUserModal({
  open,
  onOpenChange,
  userId,
  userName,
}: BlockUserModalProps) {
  const { currentUserId } = useAppContext();
  const [blocked, setBlocked] = useState(false);
  const blockUser = useBlockUser(currentUserId);

  const handleBlock = async () => {
    try {
      await blockUser.mutateAsync({ blockedUserId: userId });
      setBlocked(true);
      setTimeout(() => {
        onOpenChange(false);
        setBlocked(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to block user:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">
            Block User
          </DialogTitle>
        </DialogHeader>

        {blocked ? (
          <div className="py-8 text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              User Blocked
            </h3>
            <p className="text-sm text-gray-600">
              You won't receive messages from {userName} anymore.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex gap-3">
                <div className="text-2xl">⚠️</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">
                    Block {userName}?
                  </h4>
                  <p className="text-sm text-gray-700">
                    When you block someone:
                  </p>
                  <ul className="mt-2 text-sm text-gray-700 space-y-1 list-disc list-inside">
                    <li>They can't send you direct messages</li>
                    <li>You won't see their messages in groups</li>
                    <li>They won't be notified</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                disabled={blockUser.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBlock}
                disabled={blockUser.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {blockUser.isPending ? 'Blocking...' : 'Block User'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
