import { useState } from 'react';
import { api } from '../lib/api';

export interface Translation {
  id: string;
  messageId: string;
  targetLanguage: string;
  translatedText: string;
  createdAt: string;
}

export function useTranslation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translateMessage = async (messageId: string, targetLanguage: string): Promise<Translation | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post<Translation>('/translation/translate', {
        messageId,
        targetLanguage,
      });
      return response.data;
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Translation failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const getTranslations = async (messageId: string): Promise<Translation[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<Translation[]>(`/translation/message/${messageId}`);
      return response.data;
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to load translations';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const detectLanguage = async (text: string): Promise<string | null> => {
    try {
      const response = await api.post<{ language: string }>('/translation/detect', { text });
      return response.data.language;
    } catch {
      return null;
    }
  };

  return {
    translateMessage,
    getTranslations,
    detectLanguage,
    loading,
    error,
  };
}
