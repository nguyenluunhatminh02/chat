import { useState, useRef, useEffect } from 'react';

const COMMON_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '😮', '😢', '🙏'];

interface ReactionPickerProps {
  onPick: (emoji: string) => void;
}

export function ReactionPicker({ onPick }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-800 transition-all shadow hover:shadow-md"
        title="Add reaction"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 bottom-full mb-2 left-0 p-4 bg-white border-2 border-gray-200 rounded-2xl shadow-2xl w-max">
          <div className="grid grid-cols-4 gap-2">
            {COMMON_EMOJIS.map(emoji => (
              <button
                key={emoji}
                className="w-14 h-14 text-3xl rounded-xl hover:bg-gray-100 transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
                onClick={() => {
                  onPick(emoji);
                  setOpen(false);
                }}
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
