import { Outlet, useLocation } from 'react-router-dom'
import { HomeChromeHeader } from '@/components/home/HomeChromeHeader'

export function AppShell() {
  const { pathname } = useLocation()
  const isHome = pathname === '/home'
  const isLive = pathname === '/live'
  const isVodCatalog = pathname === '/movies' || pathname === '/series'
  const isPlaylists = pathname === '/playlists'

  return (
    <div className="app-shell">
      <main
        className={`app-shell__main${isHome ? ' app-shell__main--home' : ''}${isLive ? ' app-shell__main--live' : ''}${isVodCatalog ? ' app-shell__main--vod-catalog' : ''}${isPlaylists ? ' app-shell__main--playlists' : ''}`}
      >
        {isHome ? (
          <Outlet />
        ) : (
          <div
            className={`app-shell__tv-frame${isLive ? ' app-shell__tv-frame--live' : ''}${isVodCatalog ? ' app-shell__tv-frame--vod-catalog' : ''}${isPlaylists ? ' app-shell__tv-frame--playlists' : ''}`}
          >
            <HomeChromeHeader />
            <div className={`app-shell__route-outlet${isLive ? ' app-shell__route-outlet--live' : ''}${isVodCatalog ? ' app-shell__route-outlet--vod-catalog' : ''}${isPlaylists ? ' app-shell__route-outlet--playlists' : ''}`}>
              <Outlet />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
