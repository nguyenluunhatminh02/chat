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
  sendMessageIdempotent,
  updateMessage,
  deleteMessage,
  listReactions,
  toggleReaction,
  getThread,
} from './lib/api';
import { realtime } from './lib/realtime';

/* ------------------------------ utilities ------------------------------ */

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

// A few common emojis for quick reactions
const COMMON_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '😮', '😢', '🙏'];

/* --------------------------- pending send types -------------------------- */

type SendPayload = {
  conversationId: string;
  type: 'TEXT' | 'IMAGE' | 'FILE';
  content?: string;
  parentId?: string;
};
type Pending = { key: string; status: 'sending' | 'failed'; attempts: number; payload: SendPayload };

/* ---------------------------------- App --------------------------------- */

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

  // reactions: messageId -> emoji -> list of userIds
  const [reactions, setReactions] = useState<Record<string, Record<string, string[]>>>({});

  // reply count: parentId -> number
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});

  // thread state
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [threadMap, setThreadMap] = useState<Record<string, Message[]>>({});
  const [threadInput, setThreadInput] = useState<string>('');

  // pending sends (persist) keyed by tmpId (optimistic bubble id)
  const [pendingSends, setPendingSends] = useLocalStorage<Record<string, Pending>>('pending-sends', {});

  const selectedConv = useMemo(
    () => conversations.find((c) => c.id === selectedConvId),
    [conversations, selectedConvId]
  );

  function getDirectPeer(conv: Conversation | undefined, users: User[], me: string) {
    if (!conv) return null;
    const otherId = conv.members.map((m) => m.userId).find((id) => id !== me);
    return users.find((u) => u.id === otherId) || (otherId ? ({ id: otherId, email: otherId } as any) : null);
  }

  /* --------------------------- initial bootstrap -------------------------- */

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
        const msgs = await listMessages(selectedConvId, undefined, 30, true); // includeDeleted=1
        const ordered = [...msgs].reverse();
        knownIdsRef.current = new Set(ordered.map((m) => m.id));
        setMessages(ordered);

        // reset per-room states
        setOpenThreadId(null);
        setThreadMap({});
        setReactions({});
        setReplyCounts({});
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedConvId]);

  /* ---------------------------- create entities --------------------------- */

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

  /* ------------------------------- realtime ------------------------------- */

  // connect socket
  useEffect(() => {
    if (!currentUserId) return;
    const s = realtime.connect(apiUrl, currentUserId);

    const onCreated = (e: any) => {
      const m = e?.message as Message | undefined;
      if (!m?.id) return;

      if (m.conversationId === selectedConvId) {
        if (!knownIdsRef.current.has(m.id)) {
          knownIdsRef.current.add(m.id);
          setMessages((prev) => [...prev, m]);
        }
        // reply count bump if this is a reply
        if (m.parentId) {
          setReplyCounts((c) => ({ ...c, [m.parentId!]: (c[m.parentId!] || 0) + 1 }));
          if (openThreadId === m.parentId) {
            setThreadMap((prev) => {
              const arr = prev[m.parentId!] || [];
              const next = [...arr, m].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              );
              return { ...prev, [m.parentId!]: next };
            });
          }
        }
        // refresh conv order
        listConversations(currentUserId).then(setConversations).catch(() => {});
      }
    };

    const onUpdated = (e: any) => {
      const { id, content, editedAt } = e || {};
      if (!id) return;
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content, editedAt } : m)));
      setThreadMap((prev) => {
        const p = { ...prev };
        Object.keys(p).forEach((pid) => {
          p[pid] = p[pid].map((m) => (m.id === id ? { ...m, content, editedAt } : m));
        });
        return p;
      });
    };

    const onDeleted = (e: any) => {
      const { id, deletedAt, parentId } = e || {};
      if (!id) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content: null, deletedAt: deletedAt || new Date().toISOString() } : m))
      );
      setThreadMap((prev) => {
        const p = { ...prev };
        Object.keys(p).forEach((pid) => {
          p[pid] = p[pid].map((m) =>
            m.id === id ? { ...m, content: null, deletedAt: deletedAt || new Date().toISOString() } : m
          );
        });
        return p;
      });
      // clear reactions cache for deleted msg
      setReactions((prev) => {
        if (!prev[id]) return prev;
        const { [id]: _drop, ...rest } = prev;
        return rest;
      });
      // reply count decrease if this msg was a reply
      if (parentId) {
        setReplyCounts((c) => ({ ...c, [parentId]: Math.max(0, (c[parentId] || 0) - 1) }));
      }
    };

    const onReactionAdded = (e: any) => {
      const { messageId, userId, emoji } = e || {};
      if (!messageId || !emoji || !userId) return;
      setReactions((prev) => {
        const forMsg = prev[messageId] ? { ...prev[messageId] } : {};
        const users = new Set(forMsg[emoji] || []);
        users.add(userId);
        forMsg[emoji] = Array.from(users);
        return { ...prev, [messageId]: forMsg };
      });
    };

    const onReactionRemoved = (e: any) => {
      const { messageId, userId, emoji } = e || {};
      if (!messageId || !emoji || !userId) return;
      setReactions((prev) => {
        const forMsg = prev[messageId] ? { ...prev[messageId] } : {};
        const arr = forMsg[emoji] || [];
        const next = arr.filter((u) => u !== userId);
        if (next.length === 0) {
          const { [emoji]: _drop, ...rest } = forMsg;
          return { ...prev, [messageId]: rest };
        }
        return { ...prev, [messageId]: { ...forMsg, [emoji]: next } };
      });
    };

    // optional: if you emit 'thread.count.bump' on backend
    const onThreadBump = (e: any) => {
      const { parentId, delta } = e || {};
      if (!parentId || !delta) return;
      setReplyCounts((c) => ({ ...c, [parentId]: Math.max(0, (c[parentId] || 0) + delta) }));
    };

    s.on('message.created', onCreated);
    s.on('message.updated', onUpdated);
    s.on('message.deleted', onDeleted);
    s.on('reaction.added', onReactionAdded);
    s.on('reaction.removed', onReactionRemoved);
    s.on('thread.count.bump', onThreadBump);

    return () => {
      s.off('message.created', onCreated);
      s.off('message.updated', onUpdated);
      s.off('message.deleted', onDeleted);
      s.off('reaction.added', onReactionAdded);
      s.off('reaction.removed', onReactionRemoved);
      s.off('thread.count.bump', onThreadBump);
      realtime.disconnect();
      knownIdsRef.current.clear();
    };
  }, [currentUserId, apiUrl, selectedConvId, openThreadId]);

  // join room when selecting conversation
  useEffect(() => {
    if (!selectedConvId || !currentUserId) return;
    realtime.joinConversation(selectedConvId);
    knownIdsRef.current.clear();
    setOpenThreadId(null);
  }, [selectedConvId, currentUserId]);

  /* ---------------------------- idempotent send --------------------------- */

  // Retry a pending tmp bubble using same Idempotency-Key
  const retrySend = async (tmpId: string) => {
    const p = pendingSends[tmpId];
    if (!p) return;

    setPendingSends((m) => ({ ...m, [tmpId]: { ...p, status: 'sending', attempts: p.attempts + 1 } }));
    try {
      const real = await sendMessageIdempotent(currentUserId, p.payload, { key: p.key });

      setMessages((prev) => prev.map((m) => (m.id === tmpId ? real : m)));
      setPendingSends(({ [tmpId]: _drop, ...rest }) => rest);

      const convs = await listConversations(currentUserId);
      setConversations(convs);
    } catch {
      setPendingSends((m) => ({ ...m, [tmpId]: { ...p, status: 'failed' } }));
    }
  };

  // Resume pending sends after reload
  useEffect(() => {
    Object.entries(pendingSends).forEach(([tmpId, v]) => {
      if (v.status === 'sending') retrySend(tmpId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSend = async (text: string) => {
    if (!selectedConv) return;

    // tmp bubble & idem key
    const tmpId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const idemKey = (crypto as any)?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const optimistic: Message = {
      id: tmpId,
      conversationId: selectedConv.id,
      senderId: currentUserId,
      type: 'TEXT',
      content: text,
      createdAt: new Date().toISOString(),
    } as any;

    setMessages((prev) => [...prev, optimistic]);

    const payload: SendPayload = { conversationId: selectedConv.id, type: 'TEXT', content: text };
    setPendingSends((m) => ({ ...m, [tmpId]: { key: idemKey, status: 'sending', attempts: 0, payload } }));

    try {
      const real = await sendMessageIdempotent(currentUserId, payload, { key: idemKey });

      setMessages((prev) => prev.map((m) => (m.id === tmpId ? real : m)));
      knownIdsRef.current.add(real.id);
      setPendingSends(({ [tmpId]: _drop, ...rest }) => rest);

      const convs = await listConversations(currentUserId);
      setConversations(convs);
    } catch (e: any) {
      setError(e.message);
      setPendingSends((m) => ({ ...m, [tmpId]: { ...m[tmpId], status: 'failed' } }));
    }
  };

  /* ------------------------------ presence poll ------------------------------ */

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

  /* ------------------------------ edit / delete ------------------------------ */

  const handleEdit = async (id: string, content: string) => {
    try {
      const updated = await updateMessage(currentUserId, id, { content });
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updated } : m)));
      setThreadMap((prev) => {
        const p = { ...prev };
        Object.keys(p).forEach((pid) => {
          p[pid] = p[pid].map((m) => (m.id === id ? { ...m, ...updated } : m));
        });
        return p;
      });
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  };

  const handleDelete = async (id: string) => {
    // optimistic placeholder
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: null, deletedAt: new Date().toISOString() } : m))
    );
    setThreadMap((prev) => {
      const p = { ...prev };
      Object.keys(p).forEach((pid) => {
        p[pid] = p[pid].map((m) => (m.id === id ? { ...m, content: null, deletedAt: new Date().toISOString() } : m));
      });
      return p;
    });

    try {
      await deleteMessage(currentUserId, id);
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  };

  /* ------------------------------ reactions ------------------------------ */

  const ensureReactions = async (messageId: string) => {
    if (reactions[messageId]) return;
    try {
      const rows = await listReactions(messageId);
      const grouped: Record<string, string[]> = {};
      rows.forEach((r) => {
        grouped[r.emoji] = grouped[r.emoji] || [];
        grouped[r.emoji].push(r.userId);
      });
      setReactions((prev) => ({ ...prev, [messageId]: grouped }));
    } catch {}
  };

  const onToggleReact = async (messageId: string, emoji: string) => {
    const byMe = (reactions[messageId]?.[emoji] || []).includes(currentUserId);
    // optimistic
    setReactions((prev) => {
      const msgMap = prev[messageId] ? { ...prev[messageId] } : {};
      const set = new Set(msgMap[emoji] || []);
      if (byMe) set.delete(currentUserId);
      else set.add(currentUserId);
      const next = Array.from(set);
      return { ...prev, [messageId]: { ...msgMap, [emoji]: next } };
    });

    try {
      await toggleReaction(currentUserId, { messageId, emoji });
    } catch {
      // rollback
      setReactions((prev) => {
        const msgMap = prev[messageId] ? { ...prev[messageId] } : {};
        const set = new Set(msgMap[emoji] || []);
        if (byMe) set.add(currentUserId);
        else set.delete(currentUserId);
        const next = Array.from(set);
        return { ...prev, [messageId]: { ...msgMap, [emoji]: next } };
      });
    }
  };

  /* --------------------------------- thread -------------------------------- */

  const openThread = async (parentId: string) => {
    setOpenThreadId((cur) => (cur === parentId ? null : parentId));
    if (!threadMap[parentId]) {
      try {
        const rows = await getThread(parentId);
        const ordered = [...rows].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setThreadMap((prev) => ({ ...prev, [parentId]: ordered }));
        // sync reply count from server data (not counting deleted)
        setReplyCounts((c) => ({ ...c, [parentId]: ordered.filter((r) => !r.deletedAt).length }));
      } catch {}
    }
  };

  const sendThreadReply = async (parentId: string, text: string) => {
    if (!selectedConv) return;
    // Reuse sending pipeline with idempotent? For brevity, do a lightweight optimistic + sendMessageIdempotent:
    const tmpId = `tmp_t_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const idemKey = (crypto as any)?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const optimistic: Message = {
      id: tmpId,
      conversationId: selectedConv.id,
      senderId: currentUserId,
      type: 'TEXT',
      content: text,
      parentId,
      createdAt: new Date().toISOString(),
    } as any;

    setThreadMap((prev) => {
      const arr = prev[parentId] || [];
      return { ...prev, [parentId]: [...arr, optimistic] };
    });

    const payload: SendPayload = {
      conversationId: selectedConv.id,
      type: 'TEXT',
      content: text,
      parentId,
    };

    try {
      const real = await sendMessageIdempotent(currentUserId, payload, { key: idemKey });
      setThreadMap((prev) => {
        const arr = prev[parentId] || [];
        return { ...prev, [parentId]: arr.map((m) => (m.id === tmpId ? real : m)) };
      });
      setReplyCounts((c) => ({ ...c, [parentId]: (c[parentId] || 0) + 1 }));
    } catch (e: any) {
      setError(e.message);
      // rollback
      setThreadMap((prev) => {
        const arr = prev[parentId] || [];
        return { ...prev, [parentId]: arr.filter((m) => m.id !== tmpId) };
      });
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
                  <span className="mr-2">
                    <Pill>{selectedConv.type}</Pill>
                  </span>
                  {selectedConv.type === 'DIRECT' ? (
                    peerPresence?.online ? (
                      <span className="text-emerald-600">Online</span>
                    ) : (
                      <span>
                        Last seen{' '}
                        {peerPresence?.lastSeen ? new Date(peerPresence.lastSeen).toLocaleString() : '—'}
                      </span>
                    )
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
              conversationId={selectedConv.id}
              currentUserId={currentUserId}
              messages={messages}
              loading={loading}
              onSend={onSend}
              onEdit={handleEdit}
              onDelete={handleDelete}
              reactions={reactions}
              ensureReactions={ensureReactions}
              onToggleReact={onToggleReact}
              replyCounts={replyCounts}
              openThreadId={openThreadId}
              openThread={openThread}
              threadMap={threadMap}
              threadInput={threadInput}
              setThreadInput={setThreadInput}
              sendThreadReply={sendThreadReply}
              pendingSends={pendingSends}
              retrySend={retrySend}
            />
          ) : (
            <div className="h-full grid place-items-center text-gray-400">No conversation selected</div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ------------------------------ small helpers ----------------------------- */

function directTitle(conv: Conversation, users: User[], me: string) {
  const other = conv.members.map((m) => m.userId).find((id) => id !== me);
  const u = users.find((x) => x.id === other);
  return u ? u.name || u.email : other || 'DIRECT';
}

/* ------------------------------- components ------------------------------- */

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
  conversationId,
  currentUserId,
  messages,
  loading,
  onSend,
  onEdit,
  onDelete,
  reactions,
  ensureReactions,
  onToggleReact,
  replyCounts,
  openThreadId,
  openThread,
  threadMap,
  threadInput,
  setThreadInput,
  sendThreadReply,
  pendingSends,
  retrySend,
}: {
  conversationId: string;
  currentUserId: string;
  messages: Message[];
  loading: boolean;
  onSend: (text: string) => Promise<void>;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  reactions: Record<string, Record<string, string[]>>;
  ensureReactions: (messageId: string) => Promise<void>;
  onToggleReact: (messageId: string, emoji: string) => Promise<void>;
  replyCounts: Record<string, number>;
  openThreadId: string | null;
  openThread: (parentId: string) => Promise<void>;
  threadMap: Record<string, Message[]>;
  threadInput: string;
  setThreadInput: (v: string) => void;
  sendThreadReply: (parentId: string, text: string) => Promise<void>;
  pendingSends: Record<string, Pending>;
  retrySend: (tmpId: string) => Promise<void>;
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

  return (
    <div className="h-full flex flex-col">
      <div ref={listRef} className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {loading && <div className="text-xs text-gray-500">Loading…</div>}
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          const isEditing = editingId === m.id;
          const isDeleted = !!m.deletedAt;

          const isTmp = m.id.startsWith('tmp_');
          const pending = isTmp ? pendingSends[m.id] : undefined;
          const isSending = pending?.status === 'sending';
          const isFailed = pending?.status === 'failed';

          const msgReactions = reactions[m.id] || {};
          const sortedEmojis = Object.keys(msgReactions).sort();

          const replyCount = replyCounts[m.id] || 0;

          return (
            <div key={m.id} className={clsx('flex group', mine ? 'justify-end' : 'justify-start')}>
              <div className="relative max-w-[70%]">
                {/* Actions (only owner & not deleted) */}
                {mine && !isEditing && !isDeleted && (
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
                        onClick={() => onDelete(m.id)}
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                <div
                  className={clsx(
                    'rounded-2xl px-3 py-2 text-sm shadow',
                    mine ? 'bg-gray-900 text-white rounded-br-sm' : 'bg-white border rounded-bl-sm',
                    isDeleted && 'opacity-80'
                  )}
                  onMouseEnter={() => ensureReactions(m.id)}
                >
                  {!isEditing ? (
                    !isDeleted ? (
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
                          {isTmp && isSending && <span className="opacity-80">· Đang gửi…</span>}
                          {isTmp && isFailed && (
                            <button
                              className={clsx('underline', mine ? 'text-rose-200' : 'text-rose-600')}
                              onClick={() => retrySend(m.id)}
                              title="Gửi lại"
                            >
                              · Không gửi được — Thử lại
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={clsx('italic', mine ? 'text-white' : 'text-gray-600')}>
                          Tin nhắn này đã bị xóa
                        </div>
                        <div className={clsx('mt-1 text-[10px]', mine ? 'text-gray-300' : 'text-gray-500')}>
                          {dayjs(m.createdAt).format('HH:mm')}
                        </div>
                      </>
                    )
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        className={clsx('flex-1 rounded-md px-2 py-1 text-sm', mine ? 'text-black bg-white' : 'bg-white')}
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
                      <button className="text-[11px] px-2 py-1 rounded border bg-white" disabled={saving} onClick={cancelEdit}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Reactions + Reply (hidden if deleted) */}
                {!isDeleted && (
                  <div className={clsx('mt-1 flex flex-wrap items-center gap-1', mine ? 'justify-end' : 'justify-start')}>
                    {sortedEmojis.map((emoji) => {
                      const users = msgReactions[emoji] || [];
                      const byMe = users.includes(currentUserId);
                      const count = users.length;
                      return (
                        <button
                          key={emoji}
                          className={clsx(
                            'px-2 h-6 rounded-full border text-xs bg-white',
                            byMe ? 'border-emerald-600' : 'border-gray-300',
                            'hover:bg-gray-50'
                          )}
                          onClick={() => onToggleReact(m.id, emoji)}
                          title={byMe ? `You and ${count - 1} others` : `${count} reaction(s)`}
                        >
                          <span className="mr-1">{emoji}</span>
                          <span>{count}</span>
                        </button>
                      );
                    })}
                    <ReactionPicker onPick={(emoji) => onToggleReact(m.id, emoji)} disabled={isDeleted} />
                    <button
                      className="ml-2 text-[11px] px-2 h-6 rounded-full border bg-white hover:bg-gray-50"
                      onClick={() => openThread(m.id)}
                      disabled={isDeleted}
                      title="Open thread"
                    >
                      {replyCount > 0 ? `Reply · ${replyCount}` : 'Reply'}
                    </button>
                  </div>
                )}

                {/* Thread inline */}
                {openThreadId === m.id && (
                  <div className="mt-2 border rounded-lg bg-gray-50">
                    <div className="px-3 py-2 text-xs text-gray-600">Thread</div>
                    <div className="max-h-56 overflow-auto px-3 pb-2 space-y-2">
                      {(threadMap[m.id] || []).map((t) => {
                        const mineT = t.senderId === currentUserId;
                        const isDelT = !!t.deletedAt;
                        return (
                          <div key={t.id} className={clsx('flex', mineT ? 'justify-end' : 'justify-start')}>
                            <div
                              className={clsx(
                                'max-w-[85%] rounded-2xl px-3 py-1.5 text-sm',
                                mineT ? 'bg-gray-900 text-white rounded-br-sm' : 'bg-white border rounded-bl-sm',
                                isDelT && 'opacity-80'
                              )}
                            >
                              {!isDelT ? (
                                <>
                                  <div className="whitespace-pre-wrap break-words">{t.content}</div>
                                  <div className={clsx('mt-1 text-[10px]', mineT ? 'text-gray-300' : 'text-gray-500')}>
                                    {dayjs(t.createdAt).format('HH:mm')}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className={clsx('italic', mineT ? 'text-white' : 'text-gray-600')}>
                                    Tin nhắn này đã bị xóa
                                  </div>
                                  <div className={clsx('mt-1 text-[10px]', mineT ? 'text-gray-300' : 'text-gray-500')}>
                                    {dayjs(t.createdAt).format('HH:mm')}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="border-t bg-white p-2 flex items-center gap-2">
                      <input
                        className="flex-1 rounded-full border-gray-300 px-3 py-1.5 text-sm"
                        placeholder="Reply in thread…"
                        value={threadInput}
                        onChange={(e) => setThreadInput(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && threadInput.trim()) {
                            await sendThreadReply(m.id, threadInput.trim());
                            setThreadInput('');
                          }
                        }}
                      />
                      <button
                        className="rounded-full bg-emerald-600 text-white px-3 py-1.5 text-sm disabled:opacity-50"
                        disabled={!threadInput.trim()}
                        onClick={async () => {
                          await sendThreadReply(m.id, threadInput.trim());
                          setThreadInput('');
                        }}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}
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

function ReactionPicker({
  onPick,
  disabled,
}: {
  onPick: (emoji: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (disabled) return null;
  return (
    <div className="relative inline-block">
      <button
        className="px-2 h-6 rounded-full border text-xs bg-white hover:bg-gray-50"
        onClick={() => setOpen((v) => !v)}
        title="Add reaction"
      >
        +
      </button>
      {open && (
        <div className="absolute z-10 mt-1 p-1 bg-white border rounded-lg shadow grid grid-cols-4 gap-1">
          {COMMON_EMOJIS.map((e) => (
            <button
              key={e}
              className="px-2 py-1 rounded hover:bg-gray-50"
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
