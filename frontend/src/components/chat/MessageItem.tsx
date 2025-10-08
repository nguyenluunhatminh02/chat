import { memo, useState, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { formatTime } from '../../utils/helpers';
import { tryParseFileContent } from '../../utils/file';
import { ReactionPicker } from './ReactionPicker';
import { ThreadPanel } from './ThreadPanel';
import { ReportMessageModal } from './ReportMessageModal';
import { BlockUserModal } from './BlockUserModal';
import { PinButton } from './PinButton';
import { MessageActionsMenu } from './MessageActionsMenu';
import { TranslateButton } from './TranslateButton';
import { DevBoundary } from '../DevTools';
import { renderMarkdown } from '../../utils/markdown';
import { useLinkPreviews } from '../../hooks/useLinkPreviews';
import { LinkPreviewCard } from './LinkPreviewCard';
import { usePresignedUrl } from '../../hooks/usePresignedUrl';
import { api } from '../../lib/api';
import type { Message, User } from '../../types';
import type { LinkPreview } from '../../lib/link-preview';
import { ForwardMessageModal, type ConversationOption } from './ForwardMessageModal';
import toast from 'react-hot-toast';

interface PreviewReadyEvent {
  messageId?: string;
  previews?: LinkPreview[];
}

type SocketClient = {
  on: (event: string, callback: (data: PreviewReadyEvent) => void) => void;
  off: (event: string, callback: (data: PreviewReadyEvent) => void) => void;
};

declare global {
  interface Window {
    socket?: SocketClient;
  }
}

interface MessageItemProps {
  message: Message;
  user?: User;
  isOwn: boolean;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onReact?: (emoji: string) => void;
  reactions?: Record<string, string[]>; // emoji -> userIds
  onEnsureReactions?: () => void;
  replyCount?: number;
  onOpenThread?: () => void;
  threadOpen?: boolean;
  threadMessages?: Message[];
  threadInput?: string;
  onThreadInputChange?: (value: string) => void;
  onSendThreadReply?: () => void;
  getUserById?: (userId: string) => User | undefined;
  currentUserId?: string;
  isPinned?: boolean;
}

// 🎨 Generate 2-letter initials from name
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// 🌈 Generate gradient based on name hash (6 modern gradients)
function getAvatarGradient(name: string): string {
  const gradients = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-red-600',
    'from-pink-500 to-rose-600',
    'from-indigo-500 to-blue-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

// 🔎 helper nhận biết audio cả khi thiếu mime (dựa theo đuôi)
function isAudioLike(mime?: string, filename?: string) {
  if (mime?.startsWith('audio/')) return true;
  const ext = (filename || '').toLowerCase();
  return ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.opus', '.webm'].some(e => ext.endsWith(e));
}

function MessageItemInner({
  message,
  user,
  isOwn,
  onEdit,
  onDelete,
  onReact,
  reactions = {},
  onEnsureReactions,
  replyCount = 0,
  onOpenThread,
  threadOpen = false,
  threadMessages = [],
  threadInput = '',
  onThreadInputChange,
  onSendThreadReply,
  getUserById,
  currentUserId,
  isPinned,
}: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [linkPreviews, setLinkPreviews] = useState<LinkPreview[]>([]);
  const [showTranslate, setShowTranslate] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
   // ✅ Forward modal state
  const [forwardOpen, setForwardOpen] = useState(false);

  const fileContent = tryParseFileContent(message.content);

  // Lấy file từ attachment (khi BE gửi voice/file qua attachments)
  const fileFromAttachment = message.attachment?.[0]?.file as
    | { key?: string; url?: string; mime?: string; size?: number; filename?: string }
    | undefined;

  // Xin presigned URL nếu chỉ có key mà chưa có url
  const presignedUrl = usePresignedUrl(fileFromAttachment?.key);

  // Merge nguồn file
  const mergedFile = (fileFromAttachment || fileContent) as
    | { key?: string; url?: string; mime?: string; size?: number; filename?: string }
    | undefined;

  const resolvedUrl =
    (fileContent as any)?.url ||
    fileFromAttachment?.url ||
    presignedUrl ||
    undefined;

  const resolvedMime = mergedFile?.mime || (fileContent as any)?.mime;
  const resolvedName =
    (mergedFile && 'filename' in mergedFile && mergedFile.filename) ||
    mergedFile?.key?.split('/').pop() ||
    (fileContent as any)?.filename ||
    'Unknown file';

  const isDeleted = message.deletedAt;

  // Link previews
  const shouldFetchPreviews =
    message.type === 'TEXT' && !!message.content && /https?:\/\//.test(message.content);
  const { data: fetchedPreviews } = useLinkPreviews(
    shouldFetchPreviews ? message.id : undefined,
    shouldFetchPreviews
  );

  useEffect(() => {
    const handlePreviewReady = (data: PreviewReadyEvent) => {
      if (data.messageId === message.id && Array.isArray(data.previews)) {
        setLinkPreviews(data.previews);
      }
    };
    if (window.socket) {
      window.socket.on('preview.ready', handlePreviewReady);
      return () => window.socket?.off('preview.ready', handlePreviewReady);
    }
  }, [message.id]);

  useEffect(() => {
    if (fetchedPreviews && fetchedPreviews.length > 0) setLinkPreviews(fetchedPreviews);
  }, [fetchedPreviews]);

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditText(message.content || '');
  };
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText('');
  };
  const handleSaveEdit = () => {
    if (editText.trim() && onEdit) {
      onEdit(message.id, editText.trim());
      setIsEditing(false);
      setEditText('');
    }
  };

  // ✅ Forward handler (không dùng modal): prompt conversationId(s) & call API
  const handleForward = async () => {
    try {
       
      const raw = window.prompt(
        'Nhập conversationId cần forward (có thể nhập nhiều, cách nhau bằng dấu phẩy):',
        ''
      );
      if (!raw) return;
      const targetConversationIds = raw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      if (targetConversationIds.length === 0) return;

      const res = await api.post('/forwarding/forward', {
        messageId: message.id,
        targetConversationIds,
        includeAttribution: true,
      });

       
      alert(`Forwarded thành công: ${res.data?.forwardedCount ?? 0} cuộc trò chuyện.`);
    } catch (err: any) {
       
      alert(err?.response?.data?.message || err?.message || 'Forward failed');
    }
  };

   // ✅ Loader ví dụ: lấy list cuộc trò chuyện của user để hiển thị trong modal
  const loadConversations = useCallback(async (): Promise<ConversationOption[]> => {
    // Đổi endpoint cho đúng BE của bạn
    const res = await api.get('/conversations');
    const list = Array.isArray(res.data) ? res.data : [];
    return list.map((c: any) => ({
      id: c.id,
      name: c.name || c.title || 'Untitled',
      avatarUrl: c.avatarUrl || null,
      membersCount: Array.isArray(c.members) ? c.members.length : undefined,
    }));
  }, []);

  const renderContent = () => {
    if (isDeleted) {
      return <div className="text-sm italic text-gray-400">This message was deleted</div>;
    }

    // IMAGE
    if (message.type === 'IMAGE' && fileContent) {
      if ((fileContent as any).url) {
        return (
          <a
            href={(fileContent as any).url}
            target="_blank"
            rel="noreferrer"
            className="block max-w-full group"
          >
            <img
              src={(fileContent as any).thumbUrl || (fileContent as any).url}
              alt={(fileContent as any).filename}
              loading="lazy"
              decoding="async"
              className="object-contain max-w-full transition-shadow shadow-md max-h-72 rounded-xl group-hover:shadow-xl"
            />
            <div className="mt-2 text-xs font-medium opacity-80">
              {(fileContent as any).filename}{' '}
              {(fileContent as any).size
                ? `· ${((fileContent as any).size / 1024).toFixed(1)} KB`
                : ''}
            </div>
          </a>
        );
      }
      return (
        <div className="p-4 text-center border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
          <div className="mb-2 text-4xl animate-pulse">🖼️</div>
          <p className="text-sm font-semibold text-gray-700">{(fileContent as any).filename}</p>
          <p className="mt-1 text-xs font-medium text-blue-600">Uploading image...</p>
        </div>
      );
    }

    // FILE & VOICE_MESSAGE
    if (message.type === 'FILE' || message.type === 'VOICE_MESSAGE') {
      if (!mergedFile) {
        return (
          <div className="flex items-center p-3 space-x-3 border border-gray-200 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-center flex-shrink-0 w-10 h-10 text-xl bg-gray-300 rounded-lg">
              📎
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-600">File not available</p>
              <p className="text-xs text-gray-500">Please check the server logs.</p>
            </div>
          </div>
        );
      }

      const audioLike = isAudioLike(resolvedMime, resolvedName);

      // Audio player
      if (audioLike && resolvedUrl) {
        const durationSeconds = (() => {
          const raw = (message.metadata as Record<string, any> | null)?.duration;
          return typeof raw === 'number' && raw > 0 ? raw : null;
        })();

        const formatDuration = (seconds: number) => {
          const mins = Math.floor(seconds / 60);
          const secs = Math.round(seconds % 60);
          return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        return (
          <div className="p-3 space-y-2 border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
            <div className="flex items-center space-x-2">
              <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-lg rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500">
                🎤
              </div>
              <p className="text-sm font-semibold text-gray-800">
                {message.type === 'VOICE_MESSAGE' ? 'Voice Message' : 'Audio File'}
              </p>
            </div>
            <audio controls className="w-full" style={{ maxHeight: '40px' }}>
              <source src={resolvedUrl} type={resolvedMime || 'audio/webm'} />
              Your browser does not support audio playback.
            </audio>
            {durationSeconds && (
              <p className="text-xs font-semibold text-blue-600">
                Duration: {formatDuration(durationSeconds)}
              </p>
            )}
            {mergedFile?.size && (
              <p className="text-xs text-gray-500">{(mergedFile.size / 1024).toFixed(1)} KB</p>
            )}
          </div>
        );
      }

      // File thường
      if (resolvedUrl) {
        return (
          <a href={resolvedUrl} target="_blank" rel="noreferrer" className="block group">
            <div className="flex items-center p-3 space-x-3 transition-all border-2 border-gray-200 bg-white/90 rounded-xl hover:border-blue-400 hover:shadow-md">
              <div className="flex items-center justify-center flex-shrink-0 w-10 h-10 text-xl rounded-lg shadow-sm bg-gradient-to-br from-blue-400 to-indigo-500">
                📎
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-blue-600">
                  {resolvedName}
                </p>
                {mergedFile?.size && (
                  <p className="text-xs font-medium text-gray-500">
                    {(mergedFile.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>
            </div>
          </a>
        );
      }

      // Chưa có URL
      return (
        <div className="flex items-center p-3 space-x-3 border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
          <div className="flex items-center justify-center flex-shrink-0 w-10 h-10 text-xl rounded-lg shadow-sm bg-gradient-to-br from-blue-400 to-indigo-500 animate-pulse">
            📎
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-700 truncate">{resolvedName}</p>
            <p className="text-xs font-medium text-blue-600">Uploading...</p>
          </div>
        </div>
      );
    }

    // TEXT
    if (message.type === 'TEXT' && message.content) {
      const html = renderMarkdown(message.content);
      return (
        <>
          <div
            className="leading-relaxed prose-sm prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {linkPreviews.length > 0 && (
            <div className="mt-2 space-y-2">
              {linkPreviews.slice(0, 3).map((preview, idx) => (
                <LinkPreviewCard key={`${preview.url}-${idx}`} preview={preview} />
              ))}
              {linkPreviews.length > 3 && (
                <div className="text-xs italic text-gray-400">
                  +{linkPreviews.length - 3} more link
                  {linkPreviews.length - 3 > 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}
        </>
      );
    }

    // Fallback
    if (message.content) {
      const html = renderMarkdown(message.content);
      return (
        <div
          className="leading-relaxed prose-sm prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    return <p className="italic text-gray-400">Empty message</p>;
  };

  return (
    <DevBoundary name="MessageItem" filePath="src/components/chat/MessageItem.tsx">
      <div
        data-message-id={message.id}
        className={cn('flex w-full mb-2 transition-all duration-200', isOwn ? 'justify-end' : 'justify-start')}
      >
        <div className={cn('flex gap-2 max-w-[80%] sm:max-w-[70%] md:max-w-[65%] group', isOwn ? 'flex-row-reverse' : 'flex-row')}>
          {/* Avatar */}
          <div className="flex-shrink-0 self-end mb-0.5 flex items-end gap-1">
            <div
              className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md transition-all duration-200 select-none bg-gradient-to-br hover:scale-110',
                getAvatarGradient(user?.name || user?.email || 'User')
              )}
            >
              {getInitials(user?.name || user?.email || 'User')}
            </div>

            {/* Menu */}
            {!isEditing && !isDeleted && (
              <MessageActionsMenu
                isOwn={isOwn}
                canEdit={!!onEdit}
                canDelete={!!onDelete}
                onEdit={onEdit ? handleStartEdit : undefined}
                onDelete={onDelete ? () => onDelete(message.id) : undefined}
                onReport={!isOwn && user ? () => setReportModalOpen(true) : undefined}
                onBlock={!isOwn && user ? () => setBlockModalOpen(true) : undefined}
                onCopy={
                  message.type === 'TEXT' && message.content
                    ? () => navigator.clipboard.writeText(message.content || '')
                    : undefined
                }
                onTranslate={
                  message.type === 'TEXT' && message.content ? () => setShowTranslate(!showTranslate) : undefined
                }
                onForward={() => setForwardOpen(true)} // ✅ NEW
                className="text-gray-600 transition-opacity opacity-0 group-hover:opacity-100"
              />
            )}
          </div>

          <div className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
            {/* Timestamp */}
            <div
              className={cn(
                'flex items-center gap-1 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
                isOwn ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              <p className="text-[11px] font-normal text-gray-500 whitespace-nowrap">
                {formatTime(message.createdAt)}
              </p>
            </div>

            {/* Pinned */}
            {isPinned && (
              <div className="flex items-center gap-1.5 mb-1 px-2 py-1 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full w-fit shadow-md">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <span className="text-[10px] font-bold text-white uppercase tracking-wide">PINNED</span>
              </div>
            )}

            {/* Bubble */}
            <div className="relative group/bubble">
              {!isEditing && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute -bottom-0.5 w-3 h-3 pointer-events-none',
                    isOwn ? 'right-0 translate-x-[6px]' : 'left-0 -translate-x-[6px]'
                  )}
                >
                  <svg viewBox="0 0 8 13" className={isOwn ? 'text-[#0084ff]' : 'text-[#e4e6eb]'}>
                    <path
                      d={
                        isOwn
                          ? 'M1.533,3.568L8,12.193V1H2.812 C1.042,1,0.474,2.156,1.533,3.568z'
                          : 'M5.188,1H0v11.193l6.467-8.625 C7.526,2.156,6.958,1,5.188,1z'
                      }
                      fill="currentColor"
                    />
                  </svg>
                </span>
              )}

              <div
                className={cn(
                  'relative rounded-2xl px-3 py-2 min-w-[60px] max-w-full transition-all duration-200',
                  isOwn ? 'bg-[#0084ff] text-white shadow-sm' : 'bg-[#e4e6eb] text-[#050505]',
                  isEditing && 'ring-2 ring-blue-400 shadow-md'
                )}
                onMouseEnter={onEnsureReactions}
              >
                {isEditing ? (
                  <div className="space-y-4">
                    <input
                      autoFocus
                      type="text"
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="w-full px-4 py-3 text-sm font-medium border-2 border-indigo-300 shadow-inner rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/95"
                    />
                    <div className="flex gap-2.5">
                      <button
                        onClick={handleSaveEdit}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-2xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-md transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-[16px] leading-relaxed break-words min-w-0">{renderContent()}</div>
                    {message.editedAt && (
                      <div
                        className={cn(
                          'mt-2 flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider',
                          isOwn ? 'text-white/70' : 'text-gray-400'
                        )}
                      >
                        <span className={cn('px-2 py-0.5 rounded-full font-bold', isOwn ? 'bg-white/20' : 'bg-gray-200')}>
                          Edited
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Translation */}
            {showTranslate && message.type === 'TEXT' && message.content && (
              <div className="mt-2">
                <TranslateButton
                  messageId={message.id}
                  onTranslated={(translatedText, lang) => {
                    setTranslations(prev => ({ ...prev, [lang]: translatedText }));
                  }}
                />
                {Object.entries(translations).length > 0 && (
                  <div className="mt-2 space-y-2">
                    
                    {Object.entries(translations).map(([lang, text]) => {
                      const unchanged = (message.content || '').trim().toLowerCase() === text.trim().toLowerCase();
 
                      const languageNames: Record<string, string> = {
                        en: 'English 🇬🇧',
                        vi: 'Tiếng Việt 🇻🇳',
                        ja: '日本語 🇯🇵',
                        zh: '中文 🇨🇳',
                        ko: '한국어 🇰🇷',
                        fr: 'Français 🇫🇷',
                        es: 'Español 🇪🇸',
                        de: 'Deutsch 🇩🇪',
                        ru: 'Русский 🇷🇺',
                        ar: 'العربية 🇸🇦',
                      };
                      return (
                        <div key={lang} className="p-3 border border-blue-200 rounded-lg bg-blue-50">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 text-xs font-semibold text-blue-800 bg-blue-100 rounded">
                              {lang.toUpperCase()}
                            </span>
                            <span className="text-sm font-medium text-blue-900">{languageNames[lang] || lang}</span>
                          </div>
                          <p className="text-sm leading-relaxed text-gray-700">{text}</p>
                          {unchanged && (
                          <p className="mt-1 text-xs text-amber-600">
                            Bản dịch giống như văn bản gốc (có thể engine không dịch được cụm này).
                            Hãy thử lại hoặc chọn ngôn ngữ khác.
                          </p>
                        )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {!isDeleted && (
              <>
                {/* Reactions & Reply */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {Object.keys(reactions)
                    .sort()
                    .map(emoji => {
                      const userIds = reactions[emoji] || [];
                      const count = userIds.length;
                      if (count === 0) return null;
                      const byMe = currentUserId ? userIds.includes(currentUserId) : false;
                      return (
                        <button
                          key={emoji}
                          type="button"
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all duration-200 transform hover:scale-110 active:scale-95 font-medium',
                            byMe
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg ring-2 ring-blue-300'
                              : 'bg-white text-gray-800 shadow-md border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg'
                          )}
                          onClick={() => onReact?.(emoji)}
                          title={`${count} reaction${count > 1 ? 's' : ''}${byMe ? ' · you reacted' : ''}`}
                          aria-pressed={byMe}
                        >
                          <span className="text-lg leading-none">{emoji}</span>
                          <span className="text-sm font-bold tabular-nums">{count}</span>
                        </button>
                      );
                    })}

                  {onReact && (
                    <ReactionPicker onPick={onReact}>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center w-8 h-8 text-gray-500 transition-all bg-white border-2 border-gray-200 rounded-full shadow-sm hover:bg-gray-50 hover:border-blue-400 hover:shadow-md hover:scale-110 active:scale-95"
                        title="Add reaction"
                      >
                        <span className="text-base font-semibold">➕</span>
                      </button>
                    </ReactionPicker>
                  )}

                  <PinButton messageId={message.id} isPinned={isPinned || false} canPin={true} canUnpin={true} />

                  {onOpenThread && replyCount > 0 && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 transition-all shadow-sm hover:shadow-md"
                      onClick={onOpenThread}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Thread */}
            {threadOpen && getUserById && currentUserId && onThreadInputChange && onSendThreadReply && (
              <ThreadPanel
                parentId={message.id}
                messages={threadMessages}
                currentUserId={currentUserId}
                getUserById={getUserById}
                threadInput={threadInput}
                setThreadInput={onThreadInputChange}
                onSendReply={onSendThreadReply}
              />
            )}
          </div>
        </div>
      </div>

      {/* Moderation Modals */}
      {!isOwn && user && (
        <>
          <ReportMessageModal
            open={reportModalOpen}
            onOpenChange={setReportModalOpen}
            messageId={message.id}
            messageContent={message.content || undefined}
          />
          <BlockUserModal
            open={blockModalOpen}
            onOpenChange={setBlockModalOpen}
            userId={user.id}
            userName={user.name || user.email}
          />
        </>
        
      )}
      <ForwardMessageModal
        open={forwardOpen}
        onClose={() => setForwardOpen(false)}
        messageId={message.id}
        defaultPreview={{
          content: message.content || undefined,
          attachmentCount: message.attachment?.length,
        }}
        loadConversations={loadConversations}
        onDone={({ forwardedCount }) => {
          // Bạn có thể thay alert bằng toast
          
          toast.success(`Forwarded tới ${forwardedCount} cuộc trò chuyện`);
        }}
      />
    </DevBoundary>
  );
}

// Memoized to prevent unnecessary re-renders unless relevant props change
export const MessageItem = memo(MessageItemInner, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.deletedAt === next.message.deletedAt &&
    prev.message.editedAt === next.message.editedAt &&
    prev.isOwn === next.isOwn &&
    prev.isPinned === next.isPinned &&
    prev.replyCount === next.replyCount &&
    prev.threadOpen === next.threadOpen &&
    prev.threadInput === next.threadInput &&
    prev.onEdit === next.onEdit &&
    prev.onDelete === next.onDelete &&
    prev.onReact === next.onReact &&
    prev.onEnsureReactions === next.onEnsureReactions &&
    prev.onOpenThread === next.onOpenThread &&
    prev.onThreadInputChange === next.onThreadInputChange &&
    prev.onSendThreadReply === next.onSendThreadReply &&
    prev.reactions === next.reactions &&
    (prev.user?.id === next.user?.id && prev.user?.name === next.user?.name)
  );
});
