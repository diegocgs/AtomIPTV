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
 * HTML5 `<video>` por omissão — renderiza inline no DOM sem dependências de
 * transparência ou compositing layers nativas. O Tizen WebKit suporta HLS
 * nativamente, por isso a experiência é equivalente ao AVPlay para live TV.
 *
 * O AVPlay (nativo) tem melhor suporte de codecs/DRM mas requer configuração
 * de overlay complexa (body transparente, sem backdrop-filter nos ancestrais do
 * vídeo) que varia entre versões de firmware Samsung e causa ecrã preto em
 * muitos modelos. Pode ser forçado via `preferredEngine: 'avplay'` se necessário.
 */
export function resolvePlaybackEngineKind(): PlaybackEngineKind {
  return 'html5'
}

export function resolvePreferredPlaybackEngineKind(
  preferred?: PlaybackEngineKind | null,
): PlaybackEngineKind {
  if (preferred === 'html5') return 'html5'
  if (preferred === 'avplay' && isAvPlayAvailable()) return 'avplay'
  return resolvePlaybackEngineKind()
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
