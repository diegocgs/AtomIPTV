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

function isTypingElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return false
}

/**
 * Tecla Back / Return do comando Samsung e Tizen (não é Escape em muitos modelos).
 * `Backspace` no Mac/PC é apagar texto — só contamos como “voltar” fora de campos de edição e em runtime TV.
 * @see https://developer.samsung.com/smarttv/develop/guides/legacy/tizen-key-names
 */
export function isRemoteBackKey(e: KeyboardEvent): boolean {
  const k = e.key
  const c = e.keyCode ?? (e as KeyboardEvent & { which?: number }).which ?? 0

  if (k === 'Escape' || c === 27) return true

  if (k === 'Back' || k === 'XF86Back' || k === 'BrowserBack') return true
  if (c === 10009 || c === 461) return true

  if (k === 'Backspace' || c === 8) {
    if (isTypingElement(e.target) || isTypingElement(typeof document !== 'undefined' ? document.activeElement : null)) {
      return false
    }
    return isSamsungTizenLikeRuntime()
  }

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

/**
 * Botão amarelo "C" do controle Samsung (ColorF2Yellow).
 * Usado para favoritar/desfavoritar conteúdo.
 * @see https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html
 */
export function isRemoteYellowKey(e: KeyboardEvent): boolean {
  if (e.key === 'ColorF2Yellow') return true
  if (e.keyCode === 405) return true
  // Fallback: tecla "c" no teclado (dev)
  if (!isSamsungTizenLikeRuntime() && (e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (isTypingElement(e.target) || isTypingElement(typeof document !== 'undefined' ? document.activeElement : null)) {
      return false
    }
    return true
  }
  return false
}
