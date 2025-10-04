import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useUsers, useCreateUser } from '../hooks/useUsers';
import { useAppContext } from '../hooks/useAppContext';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const { setCurrentUserId } = useAppContext();
  const navigate = useNavigate();
  
  const { data: users = [] } = useUsers();
  const createUserMutation = useCreateUser();
  const typedUsers = users as User[];

  const handleLogin = async (userId: string) => {
    setCurrentUserId(userId);
    navigate('/chat');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      const user = await createUserMutation.mutateAsync({
        email: email.trim(),
        name: name.trim() || undefined,
      }) as User;
      await handleLogin(user.id);
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };

  const handleSelectUser = (userId: string) => {
    handleLogin(userId);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Welcome to Chat</h2>
          <p className="mt-2 text-gray-600">Sign in to your account or create a new one</p>
        </div>

        {/* Existing Users */}
        {typedUsers.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Select existing user</h3>
            <div className="space-y-2">
              {typedUsers.map((user: User) => (
                <Button
                  key={user.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleSelectUser(user.id)}
                >
                  <div className="text-left">
                    <div className="font-medium">{user.name || user.email}</div>
                    {user.name && <div className="text-sm text-gray-500">{user.email}</div>}
                  </div>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Create New User */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create new account</h3>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address *
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
            
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Display name (optional)
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>
            
            <Button
              type="submit"
              className="w-full"
              disabled={!email.trim() || createUserMutation.isPending}
            >
              {createUserMutation.isPending ? 'Creating...' : 'Create Account'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}