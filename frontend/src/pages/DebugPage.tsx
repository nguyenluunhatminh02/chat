import { useEffect, useState } from 'react';
import * as api from '../lib/api';
import type { User, Conversation, Message } from '../types';

export function DebugPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Load users first
  useEffect(() => {
    api.listUsers()
      .then((data) => setUsers(data as User[]))
      .catch((err: Error) => setError(err.message));
  }, []);

  // Load conversations when user selected
  useEffect(() => {
    if (!currentUserId) return;
    
    setLoading(true);
    api.listConversations(currentUserId)
      .then((data) => setConversations(data as Conversation[]))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentUserId]);

  // Load messages when conversation selected
  useEffect(() => {
    if (!selectedConvId) return;
    
    setLoading(true);
    api.listMessages(selectedConvId)
      .then((data) => {
        console.log('🔥 Debug API Response:', data);
        setMessages(data as Message[]);
      })
      .catch((err: Error) => {
        console.error('🔥 Debug API Error:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [selectedConvId]);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Debug Chat API</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}
      
      <div className="grid grid-cols-3 gap-4">
        {/* Users */}
        <div className="border rounded p-4">
          <h2 className="font-bold mb-2">Users ({users.length})</h2>
          {users.map((user: User) => (
            <div 
              key={user.id} 
              className={`p-2 cursor-pointer rounded mb-1 ${
                currentUserId === user.id ? 'bg-blue-100' : 'hover:bg-gray-100'
              }`}
              onClick={() => setCurrentUserId(user.id)}
            >
              {user.name || user.email}
            </div>
          ))}
        </div>

        {/* Conversations */}
        <div className="border rounded p-4">
          <h2 className="font-bold mb-2">Conversations ({conversations.length})</h2>
          {loading && <div>Loading...</div>}
          {conversations.map((conv: Conversation) => (
            <div 
              key={conv.id} 
              className={`p-2 cursor-pointer rounded mb-1 ${
                selectedConvId === conv.id ? 'bg-blue-100' : 'hover:bg-gray-100'
              }`}
              onClick={() => setSelectedConvId(conv.id)}
            >
              {conv.title || 'Untitled'}
            </div>
          ))}
        </div>

        {/* Messages */}
        <div className="border rounded p-4">
          <h2 className="font-bold mb-2">Messages ({messages.length})</h2>
          {loading && <div>Loading...</div>}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {messages.map((msg: Message) => (
              <div key={msg.id} className="p-2 bg-gray-50 rounded text-sm">
                <div className="font-semibold">{msg.senderId}</div>
                <div>{msg.content}</div>
                <div className="text-xs text-gray-500">{msg.createdAt}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="mt-4 p-4 bg-gray-100 rounded">
        <h3 className="font-bold">Debug Info:</h3>
        <p>Current User: {currentUserId}</p>
        <p>Selected Conversation: {selectedConvId}</p>
        <p>API URL: {import.meta.env.VITE_API_URL || 'http://localhost:3000'}</p>
      </div>
    </div>
  );
}