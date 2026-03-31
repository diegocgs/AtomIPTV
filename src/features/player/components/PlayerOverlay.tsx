import type { PlayerControllerState } from '../types/player'

type PlayerOverlayProps = {
  title?: string
  state: Pick<PlayerControllerState, 'isPlaying' | 'isBuffering' | 'error' | 'engineKind'>
}

/**
 * Camada leve sobre o vídeo: título, estado, dicas de comando (TV).
 */
export function PlayerOverlay({ title, state }: PlayerOverlayProps) {
  return (
    <div className="player-overlay" aria-hidden>
      <div className="player-overlay__top">
        {title ? <h1 className="player-overlay__title">{title}</h1> : null}
        <div className="player-overlay__badges">
          <span className="player-overlay__badge">{state.engineKind.toUpperCase()}</span>
          {state.isBuffering ? (
            <span className="player-overlay__badge player-overlay__badge--pulse">Buffering</span>
          ) : null}
          {state.isPlaying ? (
            <span className="player-overlay__badge">Playing</span>
          ) : (
            <span className="player-overlay__badge player-overlay__badge--muted">Paused</span>
          )}
        </div>
      </div>
      {state.error ? (
        <div className="player-overlay__error" role="alert">
          {state.error}
        </div>
      ) : null}
      <div className="player-overlay__hints">
        <span>OK / Enter — play · pause</span>
        <span>Back — sair</span>
      </div>
    </div>
  )
}
