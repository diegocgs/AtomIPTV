import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { HomeChromeHeader } from '@/components/home/HomeChromeHeader'
import { HomeHubGrid } from '@/components/home/HomeHubGrid'
import { HomeStatusFooter } from '@/components/home/HomeStatusFooter'
import { getLiveCatalogForActivePlaylist } from '@/features/catalog'
import { FocusPlan } from '@/lib/tvFocus'
import { buildLegacyStyleHomeFocusPlan } from '@/lib/tvFocus/buildHomeFocusPlan'

function runWhenIdle(task: () => void, timeout = 2500): () => void {
  const ric = window.requestIdleCallback as
    | ((callback: IdleRequestCallback, options?: IdleRequestOptions) => number)
    | undefined
  const cic = window.cancelIdleCallback as ((id: number) => void) | undefined

  if (typeof ric === 'function') {
    const id = ric(() => task(), { timeout })
    return () => {
      if (typeof cic === 'function') cic(id)
    }
  }

  const fallbackId = window.setTimeout(task, timeout)
  return () => window.clearTimeout(fallbackId)
}

export function HomePage() {
  const navigate = useNavigate()
  const plan = useMemo(() => buildLegacyStyleHomeFocusPlan(), [])

  useEffect(() => {
    const warm = () => {
      void import('@/pages/LiveTvPage')
      void import('@/features/player')
    }
    return runWhenIdle(warm, 3200)
  }, [])

  useEffect(() => {
    return runWhenIdle(() => {
      void getLiveCatalogForActivePlaylist().catch(() => {})
    }, 4200)
  }, [])

  return (
    <FocusPlan plan={plan}>
      <div className="home-screen home-screen--legacy">
        <HomeChromeHeader />
        <main className="home-screen__main">
          <HomeHubGrid
            onLive={() => navigate('/live')}
            onMovies={() => navigate('/movies')}
            onSeries={() => navigate('/series')}
            onPlaylists={() => navigate('/playlists')}
            onSettings={() => navigate('/settings')}
          />
        </main>
        <HomeStatusFooter />
      </div>
    </FocusPlan>
  )
}
