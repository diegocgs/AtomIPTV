import type { PlayerControllerState } from '../types/player'

type PlayerOverlayProps = {
  state: Pick<PlayerControllerState, 'error'>
}

/**
 * Overlay mínimo para fullscreen: sem HUD textual, mostra apenas erro.
 */
export function PlayerOverlay({ state }: PlayerOverlayProps) {
  if (!state.error) return null

  return (
    <div className="player-overlay" aria-hidden>
      <div className="player-overlay__error" role="alert">
        {state.error}
      </div>
    </div>
  )
}
