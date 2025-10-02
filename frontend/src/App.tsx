import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import clsx from 'classnames';
import type { Conversation, ConversationType, Message, User } from './types';
import {
  createConversation,
  createUser,
  listConversations,
  listMessages,
  listUsers,
  sendMessage,
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

  // 🔔 Giữ set id để chống trùng message khi event + optimistic
  const knownIdsRef = useRef<Set<string>>(new Set());

  const selectedConv = useMemo(
    () => conversations.find((c) => c.id === selectedConvId),
    [conversations, selectedConvId]
  );

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
        knownIdsRef.current = new Set(ordered.map(m => m.id));
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

  // 🔔 Kết nối socket khi chọn currentUserId
  useEffect(() => {
    if (!currentUserId) return;
    const s = realtime.connect(apiUrl, currentUserId);

    const onCreated = (e: any) => {
      const m = e?.message;
      if (!m?.id) return;
      if (knownIdsRef.current.has(m.id)) return; // đã có
      // chỉ thêm vào UI nếu đúng room đang mở
      setMessages(prev => {
        if (!selectedConvId || m.conversationId !== selectedConvId) return prev;
        knownIdsRef.current.add(m.id);
        return [...prev, m];
      });
      // có thể refresh conv order nhẹ nhàng (tuỳ chọn)
      listConversations(currentUserId).then(setConversations).catch(() => {});
    };

    s.on('message.created', onCreated);
    return () => {
      s.off('message.created', onCreated);
      realtime.disconnect();
      knownIdsRef.current.clear();
    };
  }, [currentUserId, apiUrl, selectedConvId]);

  // Khi chọn conversation → join room
  useEffect(() => {
    if (!selectedConvId || !currentUserId) return;
    realtime.joinConversation(selectedConvId);
    // reset known ids theo room
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

    setMessages(prev => [...prev, optimistic]);
    try {
      const real = await sendMessage(currentUserId, {
        conversationId: selectedConv.id,
        type: 'TEXT',
        content: text,
      });
      // thay thế optimistic → real; đánh dấu id đã biết để tránh event đẩy lần nữa
      setMessages(prev => prev.map(m => (m.id === optimistic.id ? real : m)));
      knownIdsRef.current.add(real.id);
      // conv order
      const convs = await listConversations(currentUserId);
      setConversations(convs);
    } catch (e: any) {
      setError(e.message);
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
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
          <UserSwitcher
            users={users}
            value={currentUserId}
            onChange={setCurrentUserId}
            onCreate={onCreateUser}
          />

          <NewConversationForm
            users={users}
            currentUserId={currentUserId}
            onCreate={onCreateConversation}
          />
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
                  {selectedConv.members.length} member(s)
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
}: {
  currentUserId: string;
  messages: Message[];
  loading: boolean;
  onSend: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  return (
    <div className="h-full flex flex-col">
      <div ref={listRef} className="flex-1 overflow-auto px-4 py-3 space-y-2">
        {loading && <div className="text-xs text-gray-500">Loading…</div>}
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          return (
            <div key={m.id} className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={clsx(
                  'max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow',
                  mine ? 'bg-gray-900 text-white rounded-br-sm' : 'bg-white border rounded-bl-sm'
                )}
              >
                {m.content}
                <div className={clsx('mt-1 text-[10px]', mine ? 'text-gray-300' : 'text-gray-500')}>
                  {dayjs(m.createdAt).format('HH:mm')}
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
