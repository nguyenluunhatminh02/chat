import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../utils/cn';
import { DevBoundary } from '../DevTools';

interface MessageInputProps {
  onSend: (content: string, parentId?: string) => void;
  onFileUpload?: (file: File) => void;
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
  onSend,
  onFileUpload,
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled) return;
    
    onSend(message.trim(), replyingTo?.id);
    setMessage('');
    
    // Stop typing when message is sent
    onTypingStop?.();
    setWasTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
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

  return (
    <DevBoundary 
              name="MessageInput" 
              filePath="src/components/chat/MessageInput.tsx"
            >
    <div className="border-t border-gray-200 bg-white shadow-sm p-4">
      {replyingTo && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-gray-100 border-l-4 border-[#0084ff] p-3">
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-600">Replying to {replyingTo.userName}</p>
            <p className="text-sm text-gray-900 truncate">{replyingTo.content}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancelReply}
            className="ml-3 h-7 w-7 rounded-full hover:bg-gray-200 text-gray-500"
          >
            ✕
          </Button>
        </div>
      )}
      
      <div
        className={cn(
          'relative',
          isDragging && 'bg-indigo-50 border-2 border-dashed border-indigo-400 rounded-2xl'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-50 bg-opacity-95 rounded-xl z-10 border-2 border-dashed border-blue-400">
            <div className="text-center">
              <div className="text-5xl mb-2">📤</div>
              <p className="text-blue-600 font-semibold">Drop file to upload</p>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <Input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="pr-12 rounded-full border-2 border-gray-200 bg-white hover:border-gray-300 focus:border-[#0084ff] focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 py-2.5 px-4 text-[15px] transition-all shadow-sm focus:shadow-md"
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
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-9 w-9 rounded-full hover:bg-gray-100 transition-all hover:scale-110 active:scale-95"
                  title="Attach file"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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