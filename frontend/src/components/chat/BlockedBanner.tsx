import { Ban, AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

interface BlockedBannerProps {
  type: 'blocker' | 'blocked';
  userName?: string;
  onUnblock?: () => void;
  className?: string;
}

export function BlockedBanner({ type, userName, onUnblock, className }: BlockedBannerProps) {
  const isBlocker = type === 'blocker';

  return (
    <div className={cn(
      'px-4 py-3 bg-gray-100 border-t border-gray-200 flex items-center justify-between',
      className
    )}>
      <div className="flex items-center gap-3">
        {isBlocker ? (
          <Ban className="w-5 h-5 text-gray-500" />
        ) : (
          <AlertCircle className="w-5 h-5 text-gray-500" />
        )}
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {isBlocker ? 'You blocked this person' : 'You cannot message this person'}
          </p>
          <p className="text-xs text-gray-600">
            {isBlocker
              ? `You won't be able to message each other or see each other's messages.`
              : `${userName || 'This person'} has restricted their messaging.`
            }
          </p>
        </div>
      </div>

      {isBlocker && onUnblock && (
        <button
          onClick={onUnblock}
          className="px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          Unblock
        </button>
      )}
    </div>
  );
}
