import type { PlaylistResolution, XtreamPlaylistConfig } from '../types/playlist'

export type XtreamResolveResult = {
  config: XtreamPlaylistConfig
  resolution: Extract<PlaylistResolution, { kind: 'xtream' }>
}

/**
 * Normaliza host/porta/protocolo a partir do texto do utilizador.
 * Aceita `host`, `host:port`, `http(s)://host`, `http(s)://host:port`.
 */
export function resolveXtreamPlaylist(input: {
  serverRaw: string
  username: string
  password: string
}): XtreamResolveResult {
  const { baseUrl, useHttps, port } = normalizeServerUrl(input.serverRaw.trim())
  const username = input.username.trim()
  const password = input.password

  const config: XtreamPlaylistConfig = {
    server: baseUrl,
    username,
    password,
    useHttps,
    port,
  }

  const resolution: Extract<PlaylistResolution, { kind: 'xtream' }> = {
    kind: 'xtream',
    apiBaseUrl: baseUrl,
    displayUrl: truncateDisplay(baseUrl),
    username,
    useHttps,
    port,
  }

  return { config, resolution }
}

function normalizeServerUrl(raw: string): { baseUrl: string; useHttps: boolean; port?: number } {
  const s = raw.replace(/\/+$/, '').trim()
  if (!s) {
    throw new Error('Server URL is empty')
  }

  let parsed: URL
  if (/^https?:\/\//i.test(s)) {
    parsed = new URL(s)
  } else {
    parsed = new URL(`https://${s}`)
  }

  const useHttps = parsed.protocol === 'https:'
  const hostname = parsed.hostname
  if (!hostname) {
    throw new Error('Invalid server host')
  }

  const explicitPort = parsed.port !== '' ? parseInt(parsed.port, 10) : undefined
  const port =
    explicitPort !== undefined && !Number.isNaN(explicitPort) ? explicitPort : undefined

  const defaultPort = useHttps ? 443 : 80
  const effectivePort = port ?? defaultPort
  const omitPort =
    (useHttps && effectivePort === 443) || (!useHttps && effectivePort === 80)

  const originPath = `${parsed.protocol}//${hostname}`
  const baseUrl = omitPort ? originPath : `${originPath}:${effectivePort}`

  return {
    baseUrl,
    useHttps,
    port: omitPort ? undefined : effectivePort,
  }
}

function truncateDisplay(s: string, max = 56): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}
