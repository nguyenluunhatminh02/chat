import { formatTime } from '../../utils/helpers';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Button } from '../ui/Button';
import type { SearchHit } from '../../hooks/useSearch';

interface SearchResultsProps {
  loading: boolean;
  results: SearchHit[];
  total: number;
  error: string;
  onJumpToMessage: (hit: SearchHit) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function SearchResults({
  loading,
  results,
  total,
  error,
  onJumpToMessage,
  onLoadMore,
  hasMore = false,
}: SearchResultsProps) {
  if (loading && results.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
        <span className="ml-2 text-gray-600">Searching...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-600">
        <p>Search failed: {error}</p>
      </div>
    );
  }

  if (results.length === 0 && !loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No messages found</p>
        <p className="text-sm mt-1">Try different keywords</p>
      </div>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      <div className="p-3 border-b bg-gray-50 text-sm text-gray-600">
        Found {total} result{total !== 1 ? 's' : ''}
      </div>
      
      <div className="divide-y">
        {results.map((hit) => (
          <div
            key={hit.id}
            className="p-3 hover:bg-gray-50 cursor-pointer"
            onClick={() => onJumpToMessage(hit)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p 
                  className="text-sm text-gray-900 mb-1"
                  dangerouslySetInnerHTML={{ 
                    __html: (hit.content || '').replace(
                      /\*\*(.*?)\*\*/g, 
                      '<mark class="bg-yellow-200 px-1 rounded">$1</mark>'
                    )
                  }}
                />
                <div className="flex items-center text-xs text-gray-500 space-x-2">
                  <span>{formatTime(hit.createdAt)}</span>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpToMessage(hit);
                }}
              >
                Jump →
              </Button>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="p-3 border-t bg-gray-50 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}