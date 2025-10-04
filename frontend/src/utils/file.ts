export type FileContent = {
  // New format (current)
  filename: string;
  mime: string;
  size?: number;
  url?: string;
  // Old format (from App-backup.tsx)
  fileId?: string;
  key?: string;
  thumbUrl?: string;
};

export function tryParseFileContent(content?: string | null): FileContent | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object') {
      // Old format: has fileId + key
      if (parsed.fileId && parsed.key) {
        return parsed as FileContent;
      }
      // New format: has filename + mime
      if (parsed.filename && parsed.mime) {
        return parsed as FileContent;
      }
    }
  } catch {
    // Not JSON or invalid format
  }
  return null;
}

export function isImageFile(mime?: string): boolean {
  return mime?.startsWith('image/') ?? false;
}

export function isVideoFile(mime?: string): boolean {
  return mime?.startsWith('video/') ?? false;
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}