// src/components/chat/ForwardMessageModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';
import { useForwarding } from '../../hooks/useForwarding';
import { cn } from '../../utils/cn';
import { Checkbox } from '@radix-ui/react-checkbox';

// You may already have a Conversation type somewhere
export type ConversationOption = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  membersCount?: number;
};

interface ForwardMessageModalProps {
  open: boolean;
  onClose: () => void;
  messageId: string; // the message we are forwarding
  defaultPreview?: {
    content?: string | null;
    attachmentCount?: number;
  };
  // Provide data one of these 2 ways:
  // 1) pass a ready list of conversations
  conversations?: ConversationOption[];
  // 2) or pass a loader that fetches the list (called when modal opens)
  loadConversations?: () => Promise<ConversationOption[]>;
  // callback after success
  onDone?: (payload: { forwardedCount: number }) => void;
}

export function ForwardMessageModal({
  open,
  onClose,
  messageId,
  defaultPreview,
  conversations,
  loadConversations,
  onDone,
}: ForwardMessageModalProps) {
  const { forwardMessage, loading, error } = useForwarding();
  const [items, setItems] = useState<ConversationOption[]>(conversations || []);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [includeAttribution, setIncludeAttribution] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function boot() {
      if (!open) return;
      setLocalError(null);
      if (!conversations && loadConversations) {
        try {
          const list = await loadConversations();
          if (!ignore) setItems(list || []);
        } catch (e: any) {
          if (!ignore) setLocalError(e?.message || 'Failed to load conversations');
        }
      } else if (conversations) {
        setItems(conversations);
      }
    }
    boot();
    return () => {
      ignore = true;
    };
  }, [open, conversations, loadConversations]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelected({});
      setIncludeAttribution(true);
      setLocalError(null);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => c.name.toLowerCase().includes(q));
  }, [items, query]);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected]
  );

  const canSubmit = selectedIds.length > 0 && !loading;

  const toggle = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const res = await forwardMessage({
      messageId,
      targetConversationIds: selectedIds,
      includeAttribution,
    });
    if (!res) return; // error is handled in hook
    onDone?.({ forwardedCount: res.forwardedCount });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Forward message</DialogTitle>
          <DialogDescription>
            Choose one or more conversations to forward this message to.
          </DialogDescription>
        </DialogHeader>

        {/* Preview */}
        {defaultPreview && (
          <div className="p-3 mb-2 text-sm border rounded-md bg-muted/50">
            {defaultPreview.content ? (
              <p className="line-clamp-2">{defaultPreview.content}</p>
            ) : (
              <p className="italic text-muted-foreground">(No text content)</p>
            )}
            {defaultPreview.attachmentCount ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Attachments: {defaultPreview.attachmentCount}
              </p>
            ) : null}
          </div>
        )}

        {/* Search */}
        <div className="mb-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations..."
          />
        </div>

        {/* List */}
        <div className="overflow-y-auto border rounded-md max-h-64">
          {filtered.length === 0 ? (
            <div className="p-4 text-sm text-center text-muted-foreground">
              No conversations
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((c) => (
                <li
                  key={c.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50',
                    selected[c.id] && 'bg-muted'
                  )}
                  onClick={() => toggle(c.id)}
                >
                  {c.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.avatarUrl}
                      alt={c.name}
                      className="object-cover w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="grid w-8 h-8 text-xs font-bold rounded-full bg-primary/20 place-items-center">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    {typeof c.membersCount === 'number' && (
                      <p className="text-xs text-muted-foreground">{c.membersCount} members</p>
                    )}
                  </div>
                  <Checkbox checked={!!selected[c.id]} onCheckedChange={() => toggle(c.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Options */}
        <div className="flex items-center gap-2 mt-3">
          <Checkbox
            id="includeAttribution"
            checked={includeAttribution}
            onCheckedChange={(v) => setIncludeAttribution(!!v)}
          />
          <label htmlFor="includeAttribution" className="text-sm select-none">
            Show “Forwarded from …” attribution
          </label>
        </div>

        {/* Errors */}
        {(error || localError) && (
          <div className="mt-2 text-sm text-red-600">
            {localError || error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {loading ? 'Forwarding…' : `Forward (${selectedIds.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}