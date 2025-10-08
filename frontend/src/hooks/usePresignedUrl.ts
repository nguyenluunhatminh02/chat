import { useEffect, useState } from 'react';
import { filesPresignGet } from '../lib/api';

export function usePresignedUrl(key?: string) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!key) return;

    filesPresignGet(key)
      .then(({ url }) => { if (!cancelled) setUrl(url); })
      .catch(() => { if (!cancelled) setUrl(null); });

    return () => { cancelled = true; };
  }, [key]);

  return url;
}
