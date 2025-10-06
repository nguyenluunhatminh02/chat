const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ExportOptions {
  format?: 'json' | 'ndjson';
  gzip?: boolean;
  files?: 'meta' | 'presigned';
}

export interface ImportOptions {
  mode?: 'create' | 'merge';
  conversationId?: string;
  preserveIds?: boolean;
  rehydrate?: boolean;
  gzip?: boolean;
}

export async function exportConversation(
  conversationId: string,
  options: ExportOptions = {}
): Promise<Blob> {
  const userId = localStorage.getItem('x-user-id');
  const workspaceId = localStorage.getItem('x-workspace-id');

  const params = new URLSearchParams();
  if (options.format) params.set('format', options.format);
  if (options.gzip) params.set('gzip', '1');
  if (options.files) params.set('files', options.files);

  const res = await fetch(
    `${BASE}/transfer/export/conversations/${conversationId}?${params}`,
    {
      headers: {
        'X-User-Id': userId || '',
        'X-Workspace-Id': workspaceId || '',
      },
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Export failed: ${error}`);
  }

  return res.blob();
}

export async function importConversation(
  file: File,
  options: ImportOptions = {}
): Promise<{ conversationId: string; messages: number; attachments: number }> {
  const userId = localStorage.getItem('x-user-id');
  const workspaceId = localStorage.getItem('x-workspace-id');

  const params = new URLSearchParams();
  if (options.mode) params.set('mode', options.mode);
  if (options.conversationId) params.set('conversationId', options.conversationId);
  if (options.preserveIds) params.set('preserveIds', '1');
  if (options.rehydrate) params.set('rehydrate', '1');
  if (options.gzip) params.set('gzip', '1');

  const headers: Record<string, string> = {
    'X-User-Id': userId || '',
    'X-Workspace-Id': workspaceId || '',
    'Content-Type': 'application/x-ndjson',
  };

  if (file.name.endsWith('.gz')) {
    headers['Content-Encoding'] = 'gzip';
  }

  const res = await fetch(`${BASE}/transfer/import?${params}`, {
    method: 'POST',
    headers,
    body: file,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Import failed');
  }

  return res.json();
}
