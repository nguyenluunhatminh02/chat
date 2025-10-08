import { usePresignedUrl } from '../../hooks/usePresignedUrl';

function formatDuration(sec?: number) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function VoiceBubble({
  fileKey,
  duration,
  filename,
}: {
  fileKey?: string;
  duration?: number;
  filename?: string;
}) {
  const url = usePresignedUrl(fileKey);

  return (
    <div className="flex items-center gap-3">
      {url ? (
        <audio src={url} controls preload="metadata" className="h-10" />
      ) : (
        <span className="text-xs text-gray-500">Uploading…</span>
      )}
      {typeof duration === 'number' && (
        <span className="text-xs text-gray-500">{formatDuration(duration)}</span>
      )}
      {filename && (
        <span className="text-xs text-gray-400 truncate max-w-[180px]">{filename}</span>
      )}
    </div>
  );
}
