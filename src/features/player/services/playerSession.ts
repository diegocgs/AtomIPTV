/**
 * Sessão de playback (identificador único, URL, tempos) — base para métricas e DRM futuros.
 * Sem React; pode ser chamado a partir do controller ou de serviços.
 */

export type PlayerSessionSnapshot = {
  id: string
  streamUrl: string
  title?: string
  contentRef?: string
  startedAtMs: number
}

let current: PlayerSessionSnapshot | null = null

export const playerSession = {
  begin(opts: { streamUrl: string; title?: string; contentRef?: string }): PlayerSessionSnapshot {
    current = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ps-${Date.now()}`,
      streamUrl: opts.streamUrl,
      title: opts.title,
      contentRef: opts.contentRef,
      startedAtMs: Date.now(),
    }
    return current
  },

  end(): void {
    current = null
  },

  get snapshot(): PlayerSessionSnapshot | null {
    return current
  },
}
