import { useState } from 'react';
import { MoreVertical, Edit, Trash2, Flag, Ban, Copy } from 'lucide-react';
import { cn } from '../../utils/cn';

interface MessageActionsMenuProps {
  isOwn: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
  onBlock?: () => void;
  onCopy?: () => void;
  className?: string;
}

export function MessageActionsMenu({
  isOwn,
  canEdit = true,
  canDelete = true,
  onEdit,
  onDelete,
  onReport,
  onBlock,
  onCopy,
  className,
}: MessageActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      {/* Three-dots trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'p-1.5 rounded-full transition-all',
          'hover:bg-gray-200 active:bg-gray-300',
          'text-gray-600 hover:text-gray-800',
          isOpen && 'bg-gray-200'
        )}
        aria-label="Message actions"
        title="More actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop to close menu when clicking outside */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu popover */}
          <div
            className={cn(
              'absolute z-50 bottom-full mb-1 py-1 bg-white rounded-lg shadow-lg border border-gray-200',
              'min-w-[160px] text-sm',
              isOwn ? 'right-0' : 'left-0'
            )}
          >
            {/* Own message actions */}
            {isOwn && (
              <>
                {canEdit && onEdit && (
                  <button
                    onClick={() => handleAction(onEdit)}
                    className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-gray-100 transition-colors"
                  >
                    <Edit className="w-4 h-4 text-blue-500" />
                    <span>Edit</span>
                  </button>
                )}
                {canDelete && onDelete && (
                  <button
                    onClick={() => handleAction(onDelete)}
                    className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-red-50 text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                )}
              </>
            )}

            {/* Other's message actions */}
            {!isOwn && (
              <>
                {onReport && (
                  <button
                    onClick={() => handleAction(onReport)}
                    className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-orange-50 text-orange-600 transition-colors"
                  >
                    <Flag className="w-4 h-4" />
                    <span>Report</span>
                  </button>
                )}
                {onBlock && (
                  <button
                    onClick={() => handleAction(onBlock)}
                    className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-red-50 text-red-600 transition-colors"
                  >
                    <Ban className="w-4 h-4" />
                    <span>Block User</span>
                  </button>
                )}
              </>
            )}

            {/* Copy action - available for all messages */}
            {onCopy && (
              <>
                {((isOwn && (canEdit || canDelete)) || (!isOwn && (onReport || onBlock))) && (
                  <div className="border-t border-gray-200 my-1" />
                )}
                <button
                  onClick={() => handleAction(onCopy)}
                  className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-gray-100 transition-colors"
                >
                  <Copy className="w-4 h-4 text-gray-600" />
                  <span>Copy Text</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
