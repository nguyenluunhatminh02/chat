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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center px-4">
      {/* 🎨 Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-r from-blue-400/30 to-cyan-400/30 blur-3xl animate-pulse-ring" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-r from-purple-400/25 to-pink-400/25 blur-3xl animate-pulse-ring" style={{ animationDelay: '1.2s' }} />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-r from-indigo-400/20 to-purple-400/20 blur-3xl animate-pulse-ring" style={{ animationDelay: '2.5s' }} />
      </div>
      
      <div className="relative z-10 max-w-lg w-full space-y-7 animate-slideUp">
        {/* 💎 Hero Section */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-[28px] bg-white/15 backdrop-blur-2xl border border-white/30 shadow-2xl mb-6 animate-bounce-subtle">
            <span className="text-5xl">💬</span>
          </div>
          <h1 className="text-5xl font-black text-white drop-shadow-2xl mb-3 tracking-tight">
            Welcome Back
          </h1>
          <p className="text-xl text-white/90 font-medium">Sign in to continue your conversations</p>
        </div>

        {/* ✨ Existing Users */}
        {typedUsers.length > 0 && (
          <div className="glassmorphism p-7 rounded-[32px] shadow-2xl border border-white/20 backdrop-blur-2xl">
            <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-3">
              <span className="text-3xl">👤</span>
              Quick Sign In
            </h3>
            <div className="space-y-3">
              {typedUsers.map((user: User) => (
                <Button
                  key={user.id}
                  variant="outline"
                  className="w-full justify-start bg-white/10 hover:bg-white/25 border-white/30 hover:border-white/50 text-white backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] rounded-2xl h-auto py-4 shadow-lg hover:shadow-xl"
                  onClick={() => handleSelectUser(user.id)}
                >
                  <div className="text-left flex items-center gap-3 w-full">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {(user.name || user.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-base">{user.name || user.email}</div>
                      {user.name && <div className="text-sm text-white/70 font-medium">{user.email}</div>}
                    </div>
                    <svg className="w-6 h-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* 🚀 Create New Account */}
        <div className="glassmorphism p-7 rounded-[32px] shadow-2xl border border-white/20 backdrop-blur-2xl">
          <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-3">
            <span className="text-3xl">✨</span>
            Create New Account
          </h3>
          <form onSubmit={handleCreateUser} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-white/95 mb-2.5">
                Email Address *
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="bg-white/15 backdrop-blur-md border-white/30 text-white placeholder:text-white/50 focus:border-white/70 focus:ring-white/40 rounded-2xl h-14 px-5 text-base font-medium shadow-inner"
              />
            </div>
            
            <div>
              <label htmlFor="name" className="block text-sm font-bold text-white/95 mb-2.5">
                Display Name (optional)
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your display name"
                className="bg-white/15 backdrop-blur-md border-white/30 text-white placeholder:text-white/50 focus:border-white/70 focus:ring-white/40 rounded-2xl h-14 px-5 text-base font-medium shadow-inner"
              />
            </div>
            
            <Button
              type="submit"
              className="w-full bg-white hover:bg-white/95 text-indigo-600 font-black text-lg rounded-2xl h-14 shadow-2xl hover:shadow-[0_20px_50px_rgba(255,255,255,0.4)] transform hover:-translate-y-1 transition-all duration-300 border-2 border-white/50"
              disabled={!email.trim() || createUserMutation.isPending}
            >
              {createUserMutation.isPending ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Creating...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>Create Account</span>
                  <span className="text-2xl">🚀</span>
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}