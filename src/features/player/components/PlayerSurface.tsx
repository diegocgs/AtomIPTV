import { forwardRef } from 'react'

type PlayerSurfaceProps = {
  className?: string
  /** Acessibilidade / testes */
  'data-testid'?: string
}

/**
 * Área reservada ao motor de vídeo (rect para AVPlay ou host do `<video>` HTML5).
 * Sem lógica de engine — apenas layout.
 */
export const PlayerSurface = forwardRef<HTMLDivElement, PlayerSurfaceProps>(
  function PlayerSurface({ className = '', ...rest }, ref) {
    return (
      <div className={`player-surface ${className}`.trim()}>
        <div ref={ref} className="player-surface__host" {...rest} />
      </div>
    )
  },
)
