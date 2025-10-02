import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import clsx from 'classnames';
import type { Conversation, ConversationType, Message, User } from './types';
import {
  createConversation,
  createUser,
  getPresence,
  listConversations,
  listMessages,
  listUsers,
  sendMessage,
  updateMessage,
  deleteMessage,
} from './lib/api';
import { realtime } from './lib/realtime';

function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : initial;
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
    {children}
  </span>
);

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useLocalStorage<string>('x-user-id', '');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const [apiUrl] = useState<string>(import.meta.env.VITE_API_URL || 'http://localhost:3000');
  const [peerPresence, setPeerPresence] = useState<{ online: boolean; lastSeen: string | null } | null>(null);

  // chống trùng message khi event + optimistic
  const knownIdsRef = useRef<Set<string>>(new Set());

  const selectedConv = useMemo(
    () => conversations.find((c) => c.id === selectedConvId),
    [conversations, selectedConvId]
  );

  function getDirectPeer(conv: Conversation | undefined, users: User[], me: string) {
    if (!conv) return null;
    const otherId = conv.members.map((m) => m.userId).find((id) => id !== me);
    return users.find((u) => u.id === otherId) || (otherId ? ({ id: otherId, email: otherId } as any) : null);
  }

  // Initial data
  useEffect(() => {
    (async () => {
      try {
        setUsers(await listUsers());
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    (async () => {
      try {
        setError('');
        const convs = await listConversations(currentUserId);
        setConversations(convs);
        if (convs.length && !selectedConvId) setSelectedConvId(convs[0].id);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [currentUserId]);

  useEffect(() => {
    if (!selectedConvId) return;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const msgs = await listMessages(selectedConvId);
        const ordered = [...msgs].reverse();
        knownIdsRef.current = new Set(ordered.map((m) => m.id));
        setMessages(ordered);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedConvId]);

  const onCreateUser = async (email: string, name?: string) => {
    const u = await createUser({ email, name });
    setUsers((prev) => [u, ...prev]);
    if (!currentUserId) setCurrentUserId(u.id);
  };

  const onCreateConversation = async (payload: {
    type: ConversationType;
    title?: string;
    members: string[];
  }) => {
    const conv = await createConversation(currentUserId, payload);
    setConversations((prev) => [conv, ...prev]);
    setSelectedConvId(conv.id);
  };

  // Kết nối socket
  useEffect(() => {
    if (!currentUserId) return;
    const s = realtime.connect(apiUrl, currentUserId);

    const onCreated = (e: any) => {
      const m = e?.message;
      if (!m?.id) return;
      if (knownIdsRef.current.has(m.id)) return;
      setMessages((prev) => {
        if (!selectedConvId || m.conversationId !== selectedConvId) return prev;
        knownIdsRef.current.add(m.id);
        return [...prev, m];
      });
      listConversations(currentUserId).then(setConversations).catch(() => {});
    };

    // 👇 NEW: realtime edit
    const onUpdated = (e: any) => {
      const { id, content, editedAt } = e || {};
      if (!id) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content, editedAt } : m))
      );
    };

    // 👇 NEW: realtime delete
    const onDeleted = (e: any) => {
      const { id } = e || {};
      if (!id) return;
      setMessages((prev) => prev.filter((m) => m.id !== id));
    };

    s.on('message.created', onCreated);
    s.on('message.updated', onUpdated);
    s.on('message.deleted', onDeleted);

    return () => {
      s.off('message.created', onCreated);
      s.off('message.updated', onUpdated);
      s.off('message.deleted', onDeleted);
      realtime.disconnect();
      knownIdsRef.current.clear();
    };
  }, [currentUserId, apiUrl, selectedConvId]);

  // Join room khi chọn conversation
  useEffect(() => {
    if (!selectedConvId || !currentUserId) return;
    realtime.joinConversation(selectedConvId);
    knownIdsRef.current.clear();
  }, [selectedConvId, currentUserId]);

  const onSend = async (text: string) => {
    if (!selectedConv) return;
    const optimistic: Message = {
      id: `tmp_${Date.now()}`,
      conversationId: selectedConv.id,
      senderId: currentUserId,
      type: 'TEXT',
      content: text,
      createdAt: new Date().toISOString(),
    } as any;

    setMessages((prev) => [...prev, optimistic]);
    try {
      const real = await sendMessage(currentUserId, {
        conversationId: selectedConv.id,
        type: 'TEXT',
        content: text,
      });
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? real : m)));
      knownIdsRef.current.add(real.id);
      const convs = await listConversations(currentUserId);
      setConversations(convs);
    } catch (e: any) {
      setError(e.message);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
  };

  // Presence polling cho DIRECT
  useEffect(() => {
    const peer = getDirectPeer(selectedConv, users, currentUserId);
    if (!peer?.id) {
      setPeerPresence(null);
      return;
    }

    let stop = false;
    const load = async () => {
      try {
        const p = await getPresence(peer.id);
        if (!stop) setPeerPresence({ online: p.online, lastSeen: p.lastSeen });
      } catch {}
    };
    load();
    const t = setInterval(load, 20000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [selectedConv?.id, users.length, currentUserId]);

  // Handlers edit/delete được truyền xuống MessagePane
  const handleEdit = async (id: string, content: string) => {
    try {
      const updated = await updateMessage(currentUserId, id, { content });
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updated } : m)));
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMessage(currentUserId, id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  };

  return (
    <div className="h-screen grid grid-cols-[320px_1fr]">
      {/* Sidebar */}
      <aside className="border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold">Chat Frontend</h1>
          <p className="text-xs text-gray-500">API: {apiUrl}</p>
        </div>
        <div className="p-4 space-y-4">
          <UserSwitcher users={users} value={currentUserId} onChange={setCurrentUserId} onCreate={onCreateUser} />
          <NewConversationForm users={users} currentUserId={currentUserId} onCreate={onCreateConversation} />
        </div>
        <div className="px-4 py-2 text-xs text-gray-500">Conversations</div>
        <div className="flex-1 overflow-auto">
          <ConversationList
            conversations={conversations}
            users={users}
            currentUserId={currentUserId}
            selectedId={selectedConvId}
            onSelect={setSelectedConvId}
          />
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-col">
        <div className="h-14 border-b bg-white flex items-center px-4 justify-between">
          <div className="truncate">
            {selectedConv ? (
              <div>
                <div className="font-medium truncate">
                  {selectedConv.type === 'DIRECT'
                    ? directTitle(selectedConv, users, currentUserId)
                    : selectedConv.title || 'Untitled group'}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  <span className="mr-2"><Pill>{selectedConv.type}</Pill></span>
                  {selectedConv.type === 'DIRECT' ? (
                    peerPresence?.online
                      ? <span className="text-emerald-600">Online</span>
                      : <span>Last seen {peerPresence?.lastSeen ? new Date(peerPresence.lastSeen).toLocaleString() : '—'}</span>
                  ) : (
                    <span>{selectedConv.members.length} member(s)</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Select or create a conversation</div>
            )}
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>

        <div className="flex-1 overflow-hidden">
          {selectedConv ? (
            <MessagePane
              key={selectedConv.id}
              currentUserId={currentUserId}
              messages={messages}
              loading={loading}
              onSend={onSend}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ) : (
            <div className="h-full grid place-items-center text-gray-400">No conversation selected</div>
          )}
        </div>
      </main>
    </div>
  );
}

function directTitle(conv: Conversation, users: User[], me: string) {
  const other = conv.members.map((m) => m.userId).find((id) => id !== me);
  const u = users.find((x) => x.id === other);
  return u ? u.name || u.email : other || 'DIRECT';
}

function UserSwitcher({
  users,
  value,
  onChange,
  onCreate,
}: {
  users: User[];
  value: string;
  onChange: (v: string) => void;
  onCreate: (email: string, name?: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Current user</label>
      <select
        className="w-full rounded-md border-gray-300 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Select user —</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name || u.email} — {u.id.slice(0, 8)}
          </option>
        ))}
      </select>

      <div className="text-xs text-gray-500">Or create a user</div>
      <div className="grid grid-cols-2 gap-2">
        <input
          className="rounded-md border-gray-300 text-sm px-2 py-1"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="rounded-md border-gray-300 text-sm px-2 py-1"
          placeholder="name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <button
        className="w-full rounded-md bg-gray-900 text-white text-sm py-1.5 disabled:opacity-50"
        disabled={busy || !email}
        onClick={async () => {
          setBusy(true);
          try {
            await onCreate(email, name || undefined);
            setEmail('');
            setName('');
          } finally {
            setBusy(false);
          }
        }}
      >
        + Create user
      </button>
    </div>
  );
}

function NewConversationForm({
  users,
  currentUserId,
  onCreate,
}: {
  users: User[];
  currentUserId: string;
  onCreate: (p: { type: ConversationType; title?: string; members: string[] }) => Promise<void>;
}) {
  const [type, setType] = useState<ConversationType>('DIRECT');
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelected([]);
  }, [type]);

  const candidates = users.filter((u) => u.id !== currentUserId);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">New conversation</label>
      <div className="flex gap-2 text-sm">
        <button
          className={clsx(
            'px-2 py-1 rounded-md border',
            type === 'DIRECT' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white'
          )}
          onClick={() => setType('DIRECT')}
        >
          DIRECT
        </button>
        <button
          className={clsx(
            'px-2 py-1 rounded-md border',
            type === 'GROUP' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white'
          )}
          onClick={() => setType('GROUP')}
        >
          GROUP
        </button>
      </div>

      {type === 'GROUP' && (
        <input
          className="w-full rounded-md border-gray-300 text-sm px-2 py-1"
          placeholder="Group title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      )}

      <div className="max-h-28 overflow-auto border rounded-md">
        {candidates.length === 0 ? (
          <div className="p-2 text-xs text-gray-500">No other users yet.</div>
        ) : (
          candidates.map((u) => {
            const checked = selected.includes(u.id);
            const disabled = type === 'DIRECT' && selected.length === 1 && !checked;
            return (
              <label key={u.id} className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => {
                    if (e.target.checked) setSelected((a) => [...a, u.id]);
                    else setSelected((a) => a.filter((x) => x !== u.id));
                  }}
                />
                <span className="truncate">
                  {u.name || u.email} <span className="text-gray-400">— {u.id.slice(0, 8)}</span>
                </span>
              </label>
            );
          })
        )}
      </div>

      <button
        className="w-full rounded-md bg-emerald-600 text-white text-sm py-1.5 disabled:opacity-50"
        disabled={busy || !currentUserId || selected.length === 0 || (type === 'DIRECT' && selected.length !== 1)}
        onClick={async () => {
          setBusy(true);
          try {
            await onCreate({ type, title: title || undefined, members: selected });
            setSelected([]);
            setTitle('');
          } finally {
            setBusy(false);
          }
        }}
      >
        + Create {type}
      </button>
    </div>
  );
}

function ConversationList({
  conversations,
  users,
  currentUserId,
  selectedId,
  onSelect,
}: {
  conversations: Conversation[];
  users: User[];
  currentUserId: string;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="divide-y">
      {conversations.map((c) => {
        const isSelected = selectedId === c.id;
        const title = c.type === 'DIRECT' ? directTitle(c, users, currentUserId) : c.title || 'Untitled group';
        return (
          <button
            key={c.id}
            className={clsx('w-full text-left p-3 hover:bg-gray-50', isSelected && 'bg-gray-100')}
            onClick={() => onSelect(c.id)}
          >
            <div className="flex items-center justify-between">
              <div className="font-medium truncate">{title}</div>
              <div className="text-[10px] text-gray-500">{dayjs(c.updatedAt).format('HH:mm')}</div>
            </div>
            <div className="mt-1 text-xs text-gray-500 flex items-center gap-2">
              <Pill>{c.type}</Pill>
              <span>{c.members.length} member(s)</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MessagePane({
  currentUserId,
  messages,
  loading,
  onSend,
  onEdit,
  onDelete,
}: {
  currentUserId: string;
  messages: Message[];
  loading: boolean;
  onSend: (text: string) => Promise<void>;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const startEdit = (m: Message) => {
    setEditingId(m.id);
    setEditingText(m.content ?? '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText('');
    setSaving(false);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const trimmed = editingText.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onEdit(editingId, trimmed);
      cancelEdit();
    } finally {
      setSaving(false);
    }
  };

  const delMessage = async (id: string) => {
    await onDelete(id);
    if (editingId === id) cancelEdit();
  };

  return (
    <div className="h-full flex flex-col">
      <div ref={listRef} className="flex-1 overflow-auto px-4 py-3 space-y-2">
        {loading && <div className="text-xs text-gray-500">Loading…</div>}
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          const isEditing = editingId === m.id;

          return (
            <div key={m.id} className={clsx('flex group', mine ? 'justify-end' : 'justify-start')}>
              <div className="relative">
                {/* Actions (chỉ hiện với tin của mình) */}
                {mine && !isEditing && (
                  <div className="absolute -top-2 right-0 opacity-0 group-hover:opacity-100 transition">
                    <div className="flex gap-1">
                      <button
                        className="text-[11px] px-2 py-0.5 rounded border bg-white hover:bg-gray-50"
                        onClick={() => startEdit(m)}
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        className="text-[11px] px-2 py-0.5 rounded border bg-white hover:bg-gray-50"
                        onClick={() => delMessage(m.id)}
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                <div
                  className={clsx(
                    'max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow',
                    mine ? 'bg-gray-900 text-white rounded-br-sm' : 'bg-white border rounded-bl-sm'
                  )}
                >
                  {!isEditing ? (
                    <>
                      <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      <div
                        className={clsx(
                          'mt-1 text-[10px] flex items-center gap-2',
                          mine ? 'text-gray-300' : 'text-gray-500'
                        )}
                      >
                        <span>{dayjs(m.createdAt).format('HH:mm')}</span>
                        {m.editedAt && <span className="opacity-80">· edited</span>}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        className={clsx(
                          'flex-1 rounded-md px-2 py-1 text-sm',
                          mine ? 'text-black bg-white' : 'bg-white'
                        )}
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') await saveEdit();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                      <button
                        className="text-[11px] px-2 py-1 rounded bg-emerald-600 text-white disabled:opacity-50"
                        disabled={saving || !editingText.trim()}
                        onClick={saveEdit}
                      >
                        Save
                      </button>
                      <button
                        className="text-[11px] px-2 py-1 rounded border bg-white"
                        disabled={saving}
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t bg-white p-3 flex items-center gap-2">
        <input
          className="flex-1 rounded-full border-gray-300 px-4 py-2 text-sm"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && text.trim()) {
              await onSend(text.trim());
              setText('');
            }
          }}
        />
        <button
          className="rounded-full bg-emerald-600 text-white px-4 py-2 text-sm disabled:opacity-50"
          disabled={!text.trim()}
          onClick={async () => {
            await onSend(text.trim());
            setText('');
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
