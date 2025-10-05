import { Pin, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAddPin, useRemovePin } from '../../hooks/usePins';

interface PinButtonProps {
  messageId: string;
  isPinned: boolean;
  canPin: boolean; // ADMIN/OWNER can pin
  canUnpin: boolean; // ADMIN/OWNER or original pinner can unpin
  className?: string;
}

export function PinButton({ messageId, isPinned, canPin, canUnpin, className }: PinButtonProps) {
  const addPin = useAddPin();
  const removePin = useRemovePin();

  const handleClick = () => {
    if (isPinned && canUnpin) {
      removePin.mutate(messageId);
    } else if (!isPinned && canPin) {
      addPin.mutate(messageId);
    }
  };

  const isLoading = addPin.isPending || removePin.isPending;
  const canInteract = isPinned ? canUnpin : canPin;

  if (!canInteract) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        // base
        'inline-flex items-center justify-center w-8 h-8 rounded-full transition-all shadow-sm hover:shadow-md hover:scale-110 active:scale-95',
        // ép màu text để SVG có stroke rõ
        isPinned
          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 border-2 border-blue-300 text-white [&>svg]:text-white hover:from-blue-600 hover:to-indigo-700'
          : 'bg-gray-200 border-2 border-gray-200 text-gray-700 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-400 [&>svg]:text-gray-700',
        // tránh bị parent làm mờ/ẩn
        '[&>svg]:opacity-100 [&>svg]:shrink-0',
        isLoading && 'opacity-50 cursor-not-allowed',
        className
      )}
      title={isPinned ? 'Unpin message' : 'Pin message'}
      aria-label={isPinned ? 'Unpin message' : 'Pin message'}
      aria-pressed={isPinned}
    >
      {isPinned ? (
        <X className="w-4 h-4" strokeWidth={2.25} />
      ) : (
        <Pin className="w-4 h-4" strokeWidth={2.25} />
      )}
    </button>
  );
}
