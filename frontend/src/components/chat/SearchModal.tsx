import { useState, useEffect } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { SearchResults } from './SearchResults';
import { cn } from '../../utils/cn';
import type { SearchHit } from '../../hooks/useSearch';
import type { Conversation } from '../../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string, scope?: 'current' | 'all') => void;
  conversations: Conversation[];
  selectedConvId?: string;
  // Search results props
  searchLoading?: boolean;
  searchResults?: SearchHit[];
  searchTotal?: number;
  searchError?: string;
  onJumpToMessage?: (hit: SearchHit) => void;
}

export function SearchModal({ 
  isOpen, 
  onClose, 
  onSearch, 
  conversations, 
  selectedConvId,
  searchLoading = false,
  searchResults = [],
  searchTotal = 0,
  searchError = '',
  onJumpToMessage,
}: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'current' | 'all'>('current');

  useEffect(() => {
    if (isOpen) {
      const input = document.getElementById('search-input');
      setTimeout(() => input?.focus(), 100);
    }
  }, [isOpen]);

  // Auto search when typing (debounced)
  useEffect(() => {
    if (!isOpen || !query.trim()) return;
    
    const timer = setTimeout(() => {
      onSearch(query.trim(), scope);
    }, 500);

    return () => clearTimeout(timer);
  }, [query, scope, isOpen, onSearch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!isOpen) {
          // This will be handled by parent
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim(), scope);
    }
  };

  const selectedConv = conversations.find((c) => c.id === selectedConvId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-20 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Search Messages</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="search-input"
              type="text"
              placeholder="Search messages..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full"
            />
            
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="scope"
                  value="current"
                  checked={scope === 'current'}
                  onChange={(e) => setScope(e.target.value as 'current')}
                  disabled={!selectedConvId}
                />
                <span className={cn(
                  'text-sm',
                  !selectedConvId && 'text-gray-400'
                )}>
                  Current conversation
                  {selectedConv && (
                    <span className="text-gray-500 ml-1">
                      ({selectedConv.title || 'Untitled'})
                    </span>
                  )}
                </span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  checked={scope === 'all'}
                  onChange={(e) => setScope(e.target.value as 'all')}
                />
                <span className="text-sm">All conversations</span>
              </label>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!query.trim()}>
                Search
              </Button>
            </div>
          </form>
        </div>
        
        {/* Search Results */}
        {query.trim() && onJumpToMessage && (
          <SearchResults
            loading={searchLoading}
            results={searchResults}
            total={searchTotal}
            error={searchError}
            onJumpToMessage={onJumpToMessage}
          />
        )}
      </div>
    </div>
  );
}