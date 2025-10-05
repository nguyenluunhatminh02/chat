import { Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/Popover';
import { Button } from '../ui/Button';
import { DevBoundary } from '../DevTools';

const COMMON_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '😮', '😢', '🙏'];

interface ReactionPickerProps {
  onPick: (emoji: string) => void;
  children?: React.ReactNode;
}

export function ReactionPicker({ onPick, children }: ReactionPickerProps) {
  return (
    <DevBoundary
      name="ReactionPicker" 
      filePath="src/components/chat/ReactionPicker.tsx"
    >
      <Popover>
        <PopoverTrigger asChild>
          {children || (
            <Button 
              variant="ghost" 
              size="icon"
              className="w-8 h-8 rounded-full bg-secondary/50 hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-105 active:scale-95"
              title="Add reaction"
              aria-label="Add reaction"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </PopoverTrigger>
        
        <PopoverContent className="w-auto p-3 bg-card border border-border rounded-2xl shadow-xl" align="center" side="top">
          <div className="grid grid-cols-4 gap-1">
            {COMMON_EMOJIS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                className="w-10 h-10 text-xl rounded-xl hover:bg-accent transition-all duration-200 transform hover:scale-110 active:scale-95 p-0"
                onClick={() => onPick(emoji)}
                title={`React with ${emoji}`}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </DevBoundary>
  );
}
