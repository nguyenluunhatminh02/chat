import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../utils/cn';

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
}

export function MessageInput({
  onSend,
  onFileUpload,
  placeholder = 'Type a message...',
  replyingTo,
  onCancelReply,
  disabled = false,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled) return;
    
    onSend(message.trim(), replyingTo?.id);
    setMessage('');
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
    <div className="border-t border-slate-200 bg-white shadow-xl p-3 sm:p-4 md:p-5">
      {replyingTo && (
        <div className="mb-3 flex items-center justify-between rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 p-3 animate-fadeIn">
          <div className="flex-1">
            <p className="text-xs font-semibold text-indigo-600 mb-0.5">💬 Replying to {replyingTo.userName}</p>
            <p className="text-sm text-slate-700 font-medium truncate">{replyingTo.content}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancelReply}
            className="ml-3 h-8 w-8 rounded-full hover:bg-red-100 text-slate-500 hover:text-red-600 transition-all"
          >
            ✕
          </Button>
        </div>
      )}
      
      <div
        className={cn(
          'relative',
          isDragging && 'bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-indigo-50 bg-opacity-95 backdrop-blur-sm rounded-2xl z-10 border-2 border-dashed border-indigo-400">
            <div className="text-center">
              <div className="text-5xl mb-2">📤</div>
              <p className="text-indigo-600 font-bold text-lg">Drop file to upload</p>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <Input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="pr-14 rounded-2xl border-2 border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 py-3 px-4 text-base shadow-sm transition-all"
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
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 h-9 w-9 rounded-xl hover:bg-slate-100 text-xl transition-all"
                >
                  📎
                </Button>
              </>
            )}
          </div>
          
          <Button 
            type="submit" 
            disabled={!message.trim() || disabled}
            className="rounded-2xl h-12 px-4 sm:px-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            <span className="text-lg mr-1 sm:mr-2">✈️</span>
            <span className="hidden sm:inline">Send</span>
            <span className="sm:hidden">Go</span>
          </Button>
        </form>
      </div>
    </div>
  );
}