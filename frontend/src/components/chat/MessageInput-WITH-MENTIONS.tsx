import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../utils/cn';
import { DevBoundary } from '../DevTools';
import { MentionAutocomplete } from './MentionAutocomplete';

interface MessageInputProps {
  conversationId?: string;
  onSend: (content: string, parentId?: string) => void;
  onFileUpload?: (file: File) => void;
  onPasteImage?: (file: File) => void;
  placeholder?: string;
  replyingTo?: {
    id: string;
    content: string;
    userName: string;
  };
  onCancelReply?: () => void;
  disabled?: boolean;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}

export function MessageInput({
  conversationId,
  onSend,
  onFileUpload,
  onPasteImage,
  placeholder = 'Type a message...',
  replyingTo,
  onCancelReply,
  disabled = false,
  onTypingStart,
  onTypingStop,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [wasTyping, setWasTyping] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Handle typing indicators
  useEffect(() => {
    const isTyping = message.trim().length > 0;

    if (isTyping && !wasTyping) {
      // Started typing
      onTypingStart?.();
      setWasTyping(true);
    } else if (!isTyping && wasTyping) {
      // Stopped typing
      onTypingStop?.();
      setWasTyping(false);
    }

    // Auto-stop typing after 3 seconds of no input
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        onTypingStop?.();
        setWasTyping(false);
      }, 3000);
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [message, wasTyping, onTypingStart, onTypingStop]);

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart || 0;
    
    setMessage(value);
    setCursorPosition(cursor);

    // Detect mention trigger (@)
    if (conversationId) {
      const textBeforeCursor = value.substring(0, cursor);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex !== -1) {
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
        // Only show autocomplete if there's no space after @
        if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
          setMentionQuery(textAfterAt);
          setMentionStart(lastAtIndex);
          return;
        }
      }
    }

    // Close mention autocomplete if conditions not met
    setMentionQuery(null);
    setMentionStart(-1);
  };

  const handleMentionSelect = (_userId: string, name: string) => {
    if (mentionStart === -1) return;

    // Replace @query with @name
    const before = message.substring(0, mentionStart);
    const after = message.substring(cursorPosition);
    const newMessage = `${before}@${name} ${after}`;

    setMessage(newMessage);
    setMentionQuery(null);
    setMentionStart(-1);

    // Focus back on input
    setTimeout(() => {
      inputRef.current?.focus();
      const newCursorPos = mentionStart + name.length + 2; // +2 for @ and space
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled) return;

    // Close mention autocomplete
    setMentionQuery(null);
    setMentionStart(-1);
    
    onSend(message.trim(), replyingTo?.id);
    setMessage('');
    
    // Stop typing when message is sent
    onTypingStop?.();
    setWasTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Don't submit if mention autocomplete is open
    if (mentionQuery !== null && (e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      // Let MentionAutocomplete handle these keys
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }

    if (e.key === 'Escape') {
      setMentionQuery(null);
      setMentionStart(-1);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Handle paste events for images
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    
    if (imageItem && onPasteImage) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        setIsPasting(true);
        try {
          await onPasteImage(file);
        } finally {
          setIsPasting(false);
        }
      }
    }
  };

  // Calculate mention autocomplete position
  const getMentionPosition = () => {
    if (!inputRef.current) return { top: 0, left: 0 };
    
    const rect = inputRef.current.getBoundingClientRect();
    // Position above the input
    return {
      top: rect.top - 10, // 10px above input, will be positioned relative to viewport
      left: rect.left + 10,
    };
  };

  return (
    <DevBoundary 
              name="MessageInput" 
              filePath="src/components/chat/MessageInput.tsx"
            >
    <div className="border-t border-gray-200 bg-white dark:bg-gray-800 shadow-sm p-4 relative">
      {/* Mention Autocomplete */}
      {mentionQuery !== null && conversationId && (
        <MentionAutocomplete
          conversationId={conversationId}
          query={mentionQuery}
          position={getMentionPosition()}
          onSelect={handleMentionSelect}
          onClose={() => {
            setMentionQuery(null);
            setMentionStart(-1);
          }}
        />
      )}

      {replyingTo && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-gray-100 dark:bg-gray-700 border-l-4 border-[#0084ff] p-3">
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Replying to {replyingTo.userName}</p>
            <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{replyingTo.content}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancelReply}
            className="ml-3 h-7 w-7 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400"
          >
            ✕
          </Button>
        </div>
      )}
      
      <div
        className={cn(
          'relative',
          isDragging && 'bg-indigo-50 dark:bg-indigo-900/30 border-2 border-dashed border-indigo-400 rounded-2xl'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-50 dark:bg-blue-900/50 bg-opacity-95 rounded-xl z-10 border-2 border-dashed border-blue-400">
            <div className="text-center">
              <div className="text-5xl mb-2">📤</div>
              <p className="text-blue-600 dark:text-blue-400 font-semibold">Drop file to upload</p>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              type="text"
              value={message}
              onChange={handleMessageChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={isPasting ? 'Uploading image...' : `${placeholder}${conversationId ? ' (type @ to mention)' : ''}`}
              disabled={disabled || isPasting}
              className="pr-12 rounded-full border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 hover:border-gray-300 dark:hover:border-gray-500 focus:border-[#0084ff] dark:focus:border-[#0084ff] focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 py-2.5 px-4 text-[15px] transition-all shadow-sm focus:shadow-md"
            />
            
            {onFileUpload && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-9 w-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-all hover:scale-110 active:scale-95"
                  title="Attach file"
                >
                  <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </Button>
              </>
            )}
          </div>
          
          <Button 
            type="submit" 
            disabled={!message.trim() || disabled}
            className="h-9 w-9 rounded-full bg-[#0084ff] hover:bg-[#0073e6] text-white p-0 flex items-center justify-center shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </Button>
        </form>
      </div>
    </div>
    </DevBoundary>
  );
}
