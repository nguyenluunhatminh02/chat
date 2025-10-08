import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../utils/cn';
import { DevBoundary } from '../DevTools';
import { MentionAutocomplete } from './MentionAutocomplete';
import { VoiceRecorder } from './VoiceRecorder';
import { ScheduleMessageModal } from './ScheduleMessageModal';
import { useDrafts } from '../../hooks/useDrafts';
import { Mic, Clock } from 'lucide-react';
import { useScheduledMessages } from '../../hooks/useScheduledMessages';
import toast from 'react-hot-toast';

interface MessageInputProps {
  conversationId?: string | null;
  onSend: (content: string, parentId?: string) => void;
  onFileUpload?: (file: File) => void;
  onVoiceUpload?: (file: File, meta: { duration: number }) => void;
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
  onVoiceUpload,
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
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { saveDraft, getDraft, deleteDraft } = useDrafts();

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const [cursorPosition, setCursorPosition] = useState(0);

  const { scheduleMessage, error } = useScheduledMessages();

  useEffect(() => {
    if (!conversationId) return;
    const loadDraft = async () => {
      const draft = await getDraft(conversationId);
      if (draft?.content) setMessage(draft.content);
    };
    loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    if (!message.trim()) {
      deleteDraft(conversationId);
      return;
    }
    const timer = setTimeout(() => {
      saveDraft(conversationId, message);
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, conversationId]);

  useEffect(() => {
    const isTyping = message.trim().length > 0;
    if (isTyping && !wasTyping) {
      onTypingStart?.();
      setWasTyping(true);
    } else if (!isTyping && wasTyping) {
      onTypingStop?.();
      setWasTyping(false);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        onTypingStop?.();
        setWasTyping(false);
      }, 3000);
    }
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [message, wasTyping, onTypingStart, onTypingStop]);

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart || 0;
    setMessage(value);
    setCursorPosition(cursor);

    if (conversationId) {
      const textBeforeCursor = value.substring(0, cursor);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
        if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
          setMentionQuery(textAfterAt);
          setMentionStart(lastAtIndex);
          return;
        }
      }
    }
    setMentionQuery(null);
    setMentionStart(-1);
  };

  const handleMentionSelect = (_userId: string, name: string) => {
    if (mentionStart === -1) return;
    const before = message.substring(0, mentionStart);
    const after = message.substring(cursorPosition);
    const newMessage = `${before}@${name} ${after}`;
    setMessage(newMessage);
    setMentionQuery(null);
    setMentionStart(-1);
    setTimeout(() => {
      inputRef.current?.focus();
      const newCursorPos = mentionStart + name.length + 2;
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled) return;
    setMentionQuery(null);
    setMentionStart(-1);
    onSend(message.trim(), replyingTo?.id);
    if (conversationId) deleteDraft(conversationId);
    setMessage('');
    onTypingStop?.();
    setWasTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (
      mentionQuery !== null &&
      (e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown')
    ) {
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
    if (file && onFileUpload) onFileUpload(file);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (imageItem && onPasteImage) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        setIsPasting(true);
        try { await onPasteImage(file); } finally { setIsPasting(false); }
      }
    }
  };

  const getMentionPosition = () => {
    if (!inputRef.current) return { top: 0, left: 0 };
    const rect = inputRef.current.getBoundingClientRect();
    return { top: rect.top, left: rect.left };
  };

  return (
    <DevBoundary name="MessageInput" filePath="src/components/chat/MessageInput.tsx">
      <div className="relative p-4 bg-white border-t border-gray-200 shadow-sm dark:bg-gray-800">
        {mentionQuery !== null && conversationId && (
          <div className="absolute mb-2 bottom-full left-4 right-4">
            <MentionAutocomplete
              conversationId={conversationId}
              query={mentionQuery}
              position={getMentionPosition()}
              onSelect={handleMentionSelect}
              onClose={() => { setMentionQuery(null); setMentionStart(-1); }}
            />
          </div>
        )}

        {replyingTo && (
          <div className="mb-3 flex items-center justify-between rounded-lg bg-gray-100 dark:bg-gray-700 border-l-4 border-[#0084ff] p-3">
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Replying to {replyingTo.userName}</p>
              <p className="text-sm text-gray-900 truncate dark:text-gray-100">{replyingTo.content}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onCancelReply} className="ml-3 text-gray-500 rounded-full h-7 w-7 hover:bg-gray-200 dark:hover:bg-gray-600 dark:text-gray-400">✕</Button>
          </div>
        )}

        <div
          className={cn('relative', isDragging && 'bg-indigo-50 dark:bg-indigo-900/30 border-2 border-dashed border-indigo-400 rounded-2xl')}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center border-2 border-blue-400 border-dashed bg-blue-50 dark:bg-blue-900/50 bg-opacity-95 rounded-xl">
              <div className="text-center">
                <div className="mb-2 text-5xl">📤</div>
                <p className="font-semibold text-blue-600 dark:text-blue-400">Drop file to upload</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <div className="relative flex-1">
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
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute transition-all transform -translate-y-1/2 rounded-full right-2 top-1/2 h-9 w-9 hover:bg-gray-100 dark:hover:bg-gray-600 hover:scale-110 active:scale-95"
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
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
              className={cn(
                'h-9 w-9 rounded-full transition-all transform hover:scale-110 active:scale-95',
                showVoiceRecorder ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300',
              )}
              title="Voice message"
            >
              <Mic className="w-5 h-5" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowScheduleModal(true)}
              className="text-gray-600 transition-all transform rounded-full h-9 w-9 hover:bg-gray-100 dark:hover:bg-gray-600 dark:text-gray-300 hover:scale-110 active:scale-95"
              title="Schedule message"
            >
              <Clock className="w-5 h-5" />
            </Button>

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

          {/* ✅ Voice Recorder Component FIXED */}
          {showVoiceRecorder && (onVoiceUpload || onFileUpload) && (
            <div className="p-4 mt-3 border border-red-200 rounded-lg bg-red-50">
              <VoiceRecorder
                onRecordComplete={(blob, seconds) => {
                  const mime = blob.type || 'audio/webm';
                  const ext = mime.includes('mp4') || mime.includes('m4a')
                    ? 'm4a'
                    : mime.includes('ogg')
                    ? 'ogg'
                    : 'webm';
                  const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mime });
                  if (onVoiceUpload) {
                    onVoiceUpload(file, { duration: seconds });
                  } else if (onFileUpload) {
                    onFileUpload(file);
                  }
                  setShowVoiceRecorder(false);
                }}
              />
            </div>
          )}
        </div>

        <ScheduleMessageModal
    open={showScheduleModal}
    onClose={() => setShowScheduleModal(false)}
    onSchedule={async (date) => {
      if (!message.trim() || !conversationId) return;

      const res = await scheduleMessage({
        conversationId,
        content: message.trim(),
        scheduledFor: date,
      });

      if (res) {
        // tuỳ bạn: toast thành công
        setMessage('');
        toast.success("Schedule success")
      } else {
        // tuỳ bạn: toast lỗi (error từ hook)
        console.error(error || 'Failed to schedule message');
        toast.error("SFailed to schedule message")
      }
      setShowScheduleModal(false);
    }}
  />

      </div>
    </DevBoundary>
  );
}
