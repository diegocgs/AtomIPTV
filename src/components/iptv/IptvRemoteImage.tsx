import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getResolvedPosterUrlSync, resolvePosterUrl } from '@/lib/posterWarmCache';

type IptvRemoteImageProps = {
  src: string;
  alt?: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  draggable?: boolean;
  /** Mostrado quando o URL falha (404, bloqueio, etc.). */
  fallback?: ReactNode;
};

/**
 * Poster/logo remoto com proxy em dev e `onError` para evitar ícone partido em loop.
 */
export const IptvRemoteImage = ({
  src,
  alt = '',
  className,
  loading = 'lazy',
  draggable,
  fallback = null,
}: IptvRemoteImageProps) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [resolved, setResolved] = useState<{ source: string; url: string }>({
    source: src,
    url: getResolvedPosterUrlSync(src) ?? src,
  });
  const activeResolved = useMemo(
    () => (resolved.source === src ? resolved : { source: src, url: getResolvedPosterUrlSync(src) ?? src }),
    [resolved, src],
  );

  useEffect(() => {
    let cancelled = false;
    if (!src?.trim()) return;
    void resolvePosterUrl(src).then((next) => {
      if (cancelled) return;
      setResolved((prev) => {
        if (prev.source === src && prev.url === next) return prev;
        return { source: src, url: next };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (failedSrc === src) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={activeResolved.url}
      alt={alt}
      className={className}
      loading={loading}
      draggable={draggable}
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
    />
  );
};

export default IptvRemoteImage;
