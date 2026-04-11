import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { HomeChromeHeader } from '@/components/home/HomeChromeHeader'
import { HomeHubGrid } from '@/components/home/HomeHubGrid'
import { HomeStatusFooter } from '@/components/home/HomeStatusFooter'
import { FocusPlan } from '@/lib/tvFocus'
import { buildLegacyStyleHomeFocusPlan } from '@/lib/tvFocus/buildHomeFocusPlan'

export function HomePage() {
  const navigate = useNavigate()
  const plan = useMemo(() => buildLegacyStyleHomeFocusPlan(), [])

  useEffect(() => {
    const warm = () => {
      void import('@/pages/LiveTvPage')
      void import('@/features/player')
    }
    const id = window.setTimeout(warm, 800)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <FocusPlan plan={plan}>
      <div className="home-screen home-screen--legacy">
        <HomeChromeHeader />
        <main className="home-screen__main">
          <HomeHubGrid
            onLive={() => navigate('/live')}
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
