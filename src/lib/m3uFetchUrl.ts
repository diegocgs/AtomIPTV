import { buildBackendProxyUrl } from '@/lib/backendApi';

/**
 * M3U download: in Vite dev, same-origin `/api/proxy` avoids CORS and matches the Node middleware.
 * In production (Tizen .wgt, static build), there is no dev server — fetch the remote URL directly.
 */
export function buildM3uDownloadRequestUrl(remoteUrl: string): string {
  const backendProxy = buildBackendProxyUrl('/proxy', remoteUrl);
  if (backendProxy) return backendProxy;
  if (import.meta.env.DEV) {
    return `/api/proxy?url=${encodeURIComponent(remoteUrl)}`;
  }
  return remoteUrl;
}
