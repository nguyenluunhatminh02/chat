import { useDrafts } from '../../hooks/useDrafts';
import { useEffect, useState } from 'react';
import { Loader2, Check, Edit3 } from 'lucide-react';
import { Badge } from '../ui/ui/badge';

/**
 * Example 1: Basic Message Input with Draft Auto-Save
 */
export function MessageInputWithDrafts({ conversationId, onSend }: {
  conversationId: string;
  onSend: (content: string) => Promise<void>;
}) {
  const { saveDraft, getDraft, deleteDraft, loading } = useDrafts();
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load draft when entering conversation
  useEffect(() => {
    const loadDraft = async () => {
      const draft = await getDraft(conversationId);
      if (draft) {
        setContent(draft.content);
      }
    };
    loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]); // Only run when conversationId changes

  // Auto-save on content change (debounced 1 second)
  useEffect(() => {
    if (!content.trim()) {
      // Delete draft if empty
      deleteDraft(conversationId);
      return;
    }

    setIsSaving(true);
    const timer = setTimeout(() => {
      saveDraft(conversationId, content).finally(() => {
        setIsSaving(false);
      });
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, conversationId]); // Don't include saveDraft/deleteDraft to avoid infinite loop

  const handleSend = async () => {
    if (!content.trim()) return;

    await onSend(content);
    await deleteDraft(conversationId);
    setContent('');
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type a message..."
          className="w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2"
          rows={3}
        />
        
        {/* Saving indicator */}
        {isSaving && (
          <div className="absolute flex items-center gap-1 text-xs top-2 right-2 text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Saving...
          </div>
        )}
      </div>

      <button
        onClick={handleSend}
        disabled={!content.trim() || loading}
        className="px-4 py-2 text-white rounded-lg bg-primary disabled:opacity-50"
      >
        Send
      </button>
    </div>
  );
}

/**
 * Example 2: Conversation List with Draft Indicators
 */
export function ConversationListWithDrafts({ conversations }: {
  conversations: Array<{ id: string; name: string }>;
}) {
  const { getAllDrafts } = useDrafts();
  const [draftMap, setDraftMap] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    const loadDrafts = async () => {
      const drafts = await getAllDrafts();
      const map = new Map(drafts.map(d => [d.conversationId, true]));
      setDraftMap(map);
    };
    loadDrafts();
  }, [getAllDrafts]);

  return (
    <div className="space-y-2">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          className="flex items-center justify-between p-3 rounded-lg hover:bg-accent"
        >
          <span>{conv.name}</span>
          
          {draftMap.has(conv.id) && (
            <Badge variant="secondary" className="ml-auto">
              <Edit3 className="w-3 h-3 mr-1" />
              Draft
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Example 3: Advanced Draft with Mentions and Attachments
 */
export function AdvancedDraftInput({ conversationId }: {
  conversationId: string;
}) {
  const { saveDraft, getDraft } = useDrafts();
  const [content, setContent] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);

  // Load draft with metadata
  useEffect(() => {
    const loadDraft = async () => {
      const draft = await getDraft(conversationId);
      if (draft) {
        setContent(draft.content);
        if (draft.metadata) {
          const metadata = draft.metadata as Record<string, unknown>;
          setMentions((metadata.mentions as string[]) || []);
          setAttachments((metadata.attachments as string[]) || []);
        }
      }
    };
    loadDraft();
  }, [conversationId, getDraft]);

  // Auto-save with metadata
  useEffect(() => {
    if (content.trim()) {
      saveDraft(conversationId, content, {
        mentions,
        attachments,
      });
    }
  }, [content, mentions, attachments, conversationId, saveDraft]);

  return (
    <div className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type a message..."
        className="w-full p-3 border rounded-lg"
      />
      
      {mentions.length > 0 && (
        <div className="flex gap-2">
          {mentions.map((userId) => (
            <Badge key={userId}>@{userId}</Badge>
          ))}
        </div>
      )}
      
      {attachments.length > 0 && (
        <div className="flex gap-2">
          {attachments.map((fileId) => (
            <Badge key={fileId} variant="outline">
              📎 {fileId}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Example 5: Complete Integration
 */
export function CompleteDraftExample({ conversationId }: {
  conversationId: string;
}) {
  const { saveDraft, getDraft, deleteDraft } = useDrafts();
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // Load draft
  useEffect(() => {
    const loadDraft = async () => {
      const draft = await getDraft(conversationId);
      if (draft) {
        setContent(draft.content);
      } else {
        setContent('');
      }
    };
    loadDraft();
  }, [conversationId, getDraft]);

  // Auto-save (debounced in hook)
  useEffect(() => {
    if (content.trim()) {
      setIsSaving(true);
      saveDraft(conversationId, content)
        .then(() => {
          setIsSaving(false);
          setShowSaved(true);
          setTimeout(() => setShowSaved(false), 2000);
        })
        .catch(() => setIsSaving(false));
    } else if (content === '') {
      deleteDraft(conversationId);
    }
  }, [content, conversationId, saveDraft, deleteDraft]);

  const handleSend = async () => {
    if (!content.trim()) return;

    try {
      // Send message
      await fetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ conversationId, content }),
      });

      // Delete draft after successful send
      await deleteDraft(conversationId);
      setContent('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={() => {
            // Save immediately on blur
            if (content.trim()) {
              saveDraft(conversationId, content, undefined, true);
            }
          }}
          placeholder="Type a message..."
          className="w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2"
          rows={4}
        />
        
        {/* Status indicator in top-right corner */}
        <div className="absolute top-2 right-2">
          {isSaving && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving...
            </div>
          )}
          
          {showSaved && !isSaving && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <Check className="w-3 h-3" />
              Saved
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {content.length} / 10000 characters
        </span>
        
        <button
          onClick={handleSend}
          disabled={!content.trim()}
          className="px-4 py-2 text-white rounded-lg bg-primary disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
