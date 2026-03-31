import type { TvDirection } from './types'

/**
 * Ambiente Samsung / Tizen / app hosted dentro do WGT shell (iframe).
 * No iframe não existe `window.tizen`; usamos URL ou parent frame.
 */
export function isEmbeddedInTizenShell(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.self !== window.top) return true
  } catch {
    return true
  }
  return new URLSearchParams(window.location.search).get('shell') === 'tizen'
}

export function isSamsungTizenLikeRuntime(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof window.tizen !== 'undefined' || typeof window.webapis !== 'undefined') return true
  return isEmbeddedInTizenShell()
}

/**
 * Tecla Back / Return do comando Samsung e Tizen (não é Escape em muitos modelos).
 * @see https://developer.samsung.com/smarttv/develop/guides/legacy/tizen-key-names
 */
export function isRemoteBackKey(e: KeyboardEvent): boolean {
  const k = e.key
  if (
    k === 'Escape' ||
    k === 'Backspace' ||
    k === 'Back' ||
    k === 'XF86Back' ||
    k === 'BrowserBack'
  ) {
    return true
  }
  const c = e.keyCode
  if (c === 10009) return true
  if (c === 461) return true
  if (c === 27) return true
  if (c === 8) return true
  return false
}

export function mapRemoteKeyToDirection(e: KeyboardEvent): TvDirection | null {
  const k = e.key
  if (k === 'ArrowUp' || k === 'Up') return 'up'
  if (k === 'ArrowDown' || k === 'Down') return 'down'
  if (k === 'ArrowLeft' || k === 'Left') return 'left'
  if (k === 'ArrowRight' || k === 'Right') return 'right'
  switch (e.code) {
    case 'ArrowUp':
      return 'up'
    case 'ArrowDown':
      return 'down'
    case 'ArrowLeft':
      return 'left'
    case 'ArrowRight':
      return 'right'
    default:
      break
  }
  const kc = e.keyCode || (e as KeyboardEvent & { which?: number }).which || 0
  switch (kc) {
    case 38:
      return 'up'
    case 40:
      return 'down'
    case 37:
      return 'left'
    case 39:
      return 'right'
    default:
      return null
  }
}

/** OK / Enter no comando (inclui keyCode quando `key` vem vazio). */
export function isRemoteEnterKey(e: KeyboardEvent): boolean {
  if (e.key === 'Enter' || e.key === 'Select') return true
  if (e.code === 'Enter' || e.code === 'NumpadEnter') return true
  if (e.keyCode === 13) return true
  return false
}
