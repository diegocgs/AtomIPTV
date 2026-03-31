import type { PlaybackEngine, PlaybackEngineKind } from '../types/player'
import { AvplayPlaybackEngine } from './avplayEngine'
import { Html5PlaybackEngine } from './html5Engine'

export type { PlaybackEngineKind }

export function isAvPlayAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.webapis?.avplay && typeof window.webapis.avplay.open === 'function')
  )
}

/**
 * Escolhe motor: AVPlay em Tizen quando disponível; caso contrário HTML5 (browser / dev).
 */
export function resolvePlaybackEngineKind(): PlaybackEngineKind {
  return isAvPlayAvailable() ? 'avplay' : 'html5'
}

/**
 * Fábrica — uma instância por sessão de `usePlayerController` / página de player.
 * Não reutilizar após `destroy()`.
 */
export function createPlaybackEngine(kind: PlaybackEngineKind): PlaybackEngine {
  if (kind === 'avplay') {
    return new AvplayPlaybackEngine()
  }
  return new Html5PlaybackEngine()
}
