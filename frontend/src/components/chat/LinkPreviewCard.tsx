import { ExternalLink } from 'lucide-react';
import type { LinkPreview } from '../../lib/link-preview';

interface LinkPreviewCardProps {
  preview: LinkPreview;
}

export function LinkPreviewCard({ preview }: LinkPreviewCardProps) {
  const handleClick = () => {
    window.open(preview.url, '_blank', 'noopener,noreferrer');
  };

  const hostname = (() => {
    try {
      return new URL(preview.url).hostname;
    } catch {
      return preview.url;
    }
  })();

  return (
    <div
      onClick={handleClick}
      className="mt-2 border border-gray-700 rounded-lg overflow-hidden cursor-pointer hover:bg-gray-800/30 transition-colors max-w-lg"
    >
      {preview.imageUrl && (
        <div className="relative w-full h-48 bg-gray-800">
          <img
            src={preview.imageUrl}
            alt={preview.title || hostname}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide image if it fails to load
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      <div className="p-3">
        <div className="flex items-start gap-2">
          {preview.iconUrl && (
            <img
              src={preview.iconUrl}
              alt=""
              className="w-4 h-4 mt-0.5 flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
              <span className="truncate">{hostname}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </div>

            {preview.title && (
              <h4 className="font-medium text-white text-sm mb-1 line-clamp-2">
                {preview.title}
              </h4>
            )}

            {preview.description && (
              <p className="text-xs text-gray-400 line-clamp-2">
                {preview.description}
              </p>
            )}

            {preview.mediaType && preview.mediaType !== 'article' && (
              <div className="mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300">
                  {preview.mediaType}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
