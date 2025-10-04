import { useState } from 'react';
import * as api from '../lib/api';

export type SearchHit = {
  id: string;
  conversationId: string;
  content: string | null;
  createdAt: string;
};

export function useSearch() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string>('');

  const search = async (
    query: string, 
    options: {
      conversationId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ) => {
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    
    try {
      const result = await api.searchMessages(query.trim(), {
        conversationId: options.conversationId,
        limit: options.limit || 20,
        offset: options.offset || 0,
      });
      
      setResults(result.hits);
      setTotal(result.estimatedTotalHits);
    } catch (err) {
      setError((err as Error).message || 'Search failed');
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setResults([]);
    setTotal(0);
    setError('');
    setLoading(false);
  };

  return {
    search,
    clear,
    loading,
    results,
    total,
    error,
  };
}