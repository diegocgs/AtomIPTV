/**
 * Base URL da API Node (catálogos, detalhe VOD/séries).
 * Prioridade: `VITE_HYBRID_API_BASE_URL` → mesma origem da app (proxy `/api` no Vite/preview).
 */
export function getHybridApiOrigin(): string {
  const env = (import.meta.env.VITE_HYBRID_API_BASE_URL as string | undefined)?.trim()
  if (env) return env.replace(/\/+$/, '')
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '')
  }
  return ''
}

/** `path` deve começar por `/api/...` */
export function buildHybridApiUrl(path: string, searchParams: URLSearchParams): string {
  const origin = getHybridApiOrigin()
  const q = searchParams.toString()
  const suffix = q ? `?${q}` : ''
  const p = path.startsWith('/') ? path : `/${path}`
  return origin ? `${origin}${p}${suffix}` : `${p}${suffix}`
}
