import type { M3UPlaylistConfig, XtreamPlaylistConfig } from '../types/playlist'

export type ValidationResult = { ok: true } | { ok: false; message: string }

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

function looksLikeHttpUrl(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  try {
    if (!HAS_SCHEME.test(t)) return false
    const u = new URL(t)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Validação mínima M3U (sem fetch). */
export function validateM3UInput(name: string, url: string): ValidationResult {
  const n = name.trim()
  if (!n) return { ok: false, message: 'Playlist name is required' }
  const u = url.trim()
  if (!u) return { ok: false, message: 'M3U URL is required' }
  if (!looksLikeHttpUrl(u)) return { ok: false, message: 'Enter a valid http(s) URL' }
  return { ok: true }
}

/** Validação mínima Xtream (sem rede). */
export function validateXtreamInput(
  name: string,
  server: string,
  username: string,
  password: string,
): ValidationResult {
  const n = name.trim()
  if (!n) return { ok: false, message: 'Playlist name is required' }
  if (!server.trim()) return { ok: false, message: 'Server URL is required' }
  if (!username.trim()) return { ok: false, message: 'Username is required' }
  if (!password) return { ok: false, message: 'Password is required' }
  return { ok: true }
}

export function assertM3UConfig(c: M3UPlaylistConfig): ValidationResult {
  return validateM3UInput('_', c.url)
}

export function assertXtreamConfig(c: XtreamPlaylistConfig): ValidationResult {
  return validateXtreamInput('_', c.server, c.username, c.password)
}
