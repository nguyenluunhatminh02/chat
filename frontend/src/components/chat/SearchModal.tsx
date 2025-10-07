import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { SearchResults } from './SearchResults';
import { cn } from '../../lib/utils';
import type { SearchHit } from '../../hooks/useSearch';
import type { Conversation } from '../../types';
import { DevBoundary } from '../DevTools';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string, scope?: 'current' | 'all') => void;
  conversations: Conversation[];
  selectedConvId?: string | null;
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

  return (
    <DevBoundary 
      name="SearchModal" 
      filePath="src/components/chat/SearchModal.tsx"
    >
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[80vh] p-0 overflow-hidden bg-white/95 backdrop-blur-xl border-gray-200 shadow-2xl">
          <DialogHeader className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Search className="w-5 h-5 text-white" />
              </div>
              <DialogTitle className="text-xl font-bold text-gray-900">Search Messages</DialogTitle>
            </div>
          </DialogHeader>
          
          <div className="p-6 space-y-4 bg-white/50">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Search Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="w-5 h-5 text-gray-400" />
                </div>
                <Input
                  id="search-input"
                  type="text"
                  placeholder="Type to search messages..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 text-base rounded-xl bg-white border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900 placeholder:text-gray-400"
                />
                {query && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuery('')}
                    className="absolute inset-y-0 right-0 mr-2 h-auto w-8 hover:bg-gray-100"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </Button>
                )}
              </div>
              
              {/* Search Scope */}
              <div className="flex items-center gap-6 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                <span className="text-sm font-semibold text-gray-700">Search in:</span>
                <label className="flex items-center gap-2 cursor-pointer hover:bg-white/60 px-3 py-2 rounded-lg transition-colors">
                  <input
                    type="radio"
                    name="scope"
                    value="current"
                    checked={scope === 'current'}
                    onChange={(e) => setScope(e.target.value as 'current')}
                    disabled={!selectedConvId}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className={cn(
                    'text-sm font-medium',
                    !selectedConvId ? 'text-gray-400' : 'text-gray-700'
                  )}>
                    This conversation
                  </span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer hover:bg-white/60 px-3 py-2 rounded-lg transition-colors">
                  <input
                    type="radio"
                    name="scope"
                    value="all"
                    checked={scope === 'all'}
                    onChange={(e) => setScope(e.target.value as 'all')}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">All conversations</span>
                </label>
              </div>
            </form>
          </div>
          
          {/* Search Results */}
          <div className="flex-1 overflow-hidden bg-gradient-to-b from-white/30 to-gray-50/50">
            {query.trim() && onJumpToMessage ? (
              <SearchResults
                loading={searchLoading}
                results={searchResults}
                total={searchTotal}
                error={searchError}
                onJumpToMessage={onJumpToMessage}
              />
            ) : (
              <div className="flex items-center justify-center h-48">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <Search className="w-8 h-8 text-blue-500" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Start typing to search messages</p>
                  <p className="text-xs text-gray-500 mt-2">Search across all your conversations</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DevBoundary>
  );
}