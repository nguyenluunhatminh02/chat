import { useEffect, useRef, useState } from 'react';
import {
  MoreVertical,
  Edit,
  Trash2,
  Flag,
  Ban,
  Copy,
  Globe,
  ArrowRight, // dùng làm icon Forward
} from 'lucide-react';
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
  onTranslate?: () => void;
  onForward?: () => void; // ✅ NEW
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
  onTranslate,
  onForward, // ✅ NEW
  className,
}: MessageActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // đóng menu khi click ra ngoài / nhấn ESC
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  const handleAction = (action?: () => void) => {
    if (action) action();
    setIsOpen(false);
  };

  const hasOwnGroup = isOwn && ((canEdit && !!onEdit) || (canDelete && !!onDelete));
  const hasOtherGroup = !isOwn && (!!onReport || !!onBlock);
  const hasCopyOrTranslate = !!onCopy || !!onTranslate;
  const hasForward = !!onForward;

  // helper: render separator nếu trước đó có items
  const Separator = ({ show }: { show: boolean }) =>
    show ? <div className="my-1 border-t border-gray-200" /> : null;

  return (
    <div ref={ref} className={cn('relative', className)}>
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
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Menu popover */}
          <div
            className={cn(
              'absolute z-50 bottom-full mb-1 py-1 bg-white rounded-lg shadow-lg border border-gray-200',
              'min-w-[180px] text-sm',
              isOwn ? 'right-0' : 'left-0'
            )}
          >
            {/* Own message actions */}
            {isOwn && (
              <>
                {canEdit && onEdit && (
                  <button
                    onClick={() => handleAction(onEdit)}
                    className="flex items-center w-full gap-2 px-4 py-2 text-left transition-colors hover:bg-gray-100"
                  >
                    <Edit className="w-4 h-4 text-blue-500" />
                    <span>Edit</span>
                  </button>
                )}
                {canDelete && onDelete && (
                  <button
                    onClick={() => handleAction(onDelete)}
                    className="flex items-center w-full gap-2 px-4 py-2 text-left text-red-600 transition-colors hover:bg-red-50"
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
                    className="flex items-center w-full gap-2 px-4 py-2 text-left text-orange-600 transition-colors hover:bg-orange-50"
                  >
                    <Flag className="w-4 h-4" />
                    <span>Report</span>
                  </button>
                )}
                {onBlock && (
                  <button
                    onClick={() => handleAction(onBlock)}
                    className="flex items-center w-full gap-2 px-4 py-2 text-left text-red-600 transition-colors hover:bg-red-50"
                  >
                    <Ban className="w-4 h-4" />
                    <span>Block User</span>
                  </button>
                )}
              </>
            )}

            {/* Forward */}
            <Separator show={hasForward && (hasOwnGroup || hasOtherGroup)} />
            {onForward && (
              <button
                onClick={() => handleAction(onForward)}
                className="flex items-center w-full gap-2 px-4 py-2 text-left text-blue-600 transition-colors hover:bg-blue-50"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Forward</span>
              </button>
            )}

            {/* Copy */}
            <Separator show={!!onCopy && (hasOwnGroup || hasOtherGroup || hasForward)} />
            {onCopy && (
              <button
                onClick={() => handleAction(onCopy)}
                className="flex items-center w-full gap-2 px-4 py-2 text-left transition-colors hover:bg-gray-100"
              >
                <Copy className="w-4 h-4 text-gray-600" />
                <span>Copy Text</span>
              </button>
            )}

            {/* Translate */}
            <Separator show={!!onTranslate && (hasOwnGroup || hasOtherGroup || hasCopyOrTranslate || hasForward)} />
            {onTranslate && (
              <button
                onClick={() => handleAction(onTranslate)}
                className="flex items-center w-full gap-2 px-4 py-2 text-left text-blue-600 transition-colors hover:bg-blue-50"
              >
                <Globe className="w-4 h-4" />
                <span>Translate</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
