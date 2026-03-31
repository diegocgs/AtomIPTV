export type TvDirection = 'up' | 'down' | 'left' | 'right'

export type TvNeighborMap = Record<string, Partial<Record<TvDirection, string>>>

export interface TvFocusPlan {
  /** Mapa id → vizinhos por direção. */
  neighbors: TvNeighborMap
  /** Foco inicial quando o plano entra em vigor. */
  defaultFocusId: string
}
