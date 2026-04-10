import { useLayoutEffect, useRef } from 'react'
import { isRemoteEnterKey } from '@/lib/tvFocus/tvRemoteKeys'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { PlayerOverlay } from '../components/PlayerOverlay'
import { PlayerSurface } from '../components/PlayerSurface'
import { usePlayerController } from '../hooks/usePlayerController'
import type { PlayerNavigationState } from '../types/player'

/**
 * Ecrã fullscreen dedicado ao playback — fora do AppShell.
 * URL: `location.state` (preferido) ou query `?url=` (encoded).
 */
export function PlayerPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const hostRef = useRef<HTMLDivElement>(null)

  const navState = location.state as PlayerNavigationState | null | undefined
  const queryUrl = searchParams.get('url')
  const returnTo = navState?.returnTo ?? '/home'
  const streamUrl =
    navState?.streamUrl ??
    (queryUrl ? tryDecodeURIComponent(queryUrl) : null) ??
    null

  const title = navState?.title
  const contentRef = navState?.channelId ?? navState?.title

  const {
    toggle,
    error,
  } = usePlayerController({
    containerRef: hostRef,
    streamUrl,
    title: title ?? undefined,
    contentRef,
    autoPlay: true,
  })

  useLayoutEffect(() => {
    if (!streamUrl) return
    const onKey = (e: KeyboardEvent) => {
      if (isRemoteEnterKey(e) || e.code === 'Space' || e.keyCode === 32) {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [streamUrl, toggle])

  if (!streamUrl) {
    return (
      <div className="player-page player-page--error" data-player-page>
        <p>URL de stream em falta.</p>
        <button type="button" className="tv-btn" onClick={() => navigate(returnTo, { replace: true })}>
          Voltar
        </button>
      </div>
    )
  }

  return (
    <div className="player-page" data-player-page>
      <PlayerSurface ref={hostRef} data-testid="player-surface-host" />
      <PlayerOverlay
        state={{
          error,
        }}
      />
    </div>
  )
}

function tryDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
