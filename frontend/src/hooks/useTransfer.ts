import { useMutation } from '@tanstack/react-query';
import { exportConversation, importConversation } from '../lib/transfer';
import type { ExportOptions, ImportOptions } from '../lib/transfer';

export function useExportConversation() {
  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      options 
    }: { 
      conversationId: string; 
      options?: ExportOptions 
    }) => {
      const blob = await exportConversation(conversationId, options);
      
      // Auto download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const format = options?.format || 'ndjson';
      const gzipExt = options?.gzip ? '.gz' : '';
      a.download = `conversation-${conversationId}-${Date.now()}.${format}${gzipExt}`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      return { success: true };
    },
  });
}

export function useImportConversation() {
  return useMutation({
    mutationFn: async ({ 
      file, 
      options 
    }: { 
      file: File; 
      options?: ImportOptions 
    }) => {
      return importConversation(file, options);
    },
  });
}
