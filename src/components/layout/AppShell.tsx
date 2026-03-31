import { Outlet, useLocation } from 'react-router-dom'
import { HomeChromeHeader } from '@/components/home/HomeChromeHeader'

export function AppShell() {
  const { pathname } = useLocation()
  const isHome = pathname === '/home'

  return (
    <div className="app-shell">
      <main className="app-shell__main">
        {isHome ? (
          <Outlet />
        ) : (
          <div className="app-shell__tv-frame">
            <HomeChromeHeader />
            <div className="app-shell__route-outlet">
              <Outlet />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
