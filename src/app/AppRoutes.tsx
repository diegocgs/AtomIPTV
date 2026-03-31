import { Suspense, lazy, useCallback } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { TvFocusProvider } from '@/lib/tvFocus'
import { SplashPage } from '@/pages/SplashPage'
import { HomePage } from '@/pages/HomePage'
const LiveTvPage = lazy(() => import('@/pages/LiveTvPage').then((m) => ({ default: m.LiveTvPage })))
const MoviesPage = lazy(() => import('@/pages/MoviesPage').then((m) => ({ default: m.MoviesPage })))
const SeriesPage = lazy(() => import('@/pages/SeriesPage').then((m) => ({ default: m.SeriesPage })))
const PlaylistsPage = lazy(() => import('@/pages/PlaylistsPage').then((m) => ({ default: m.PlaylistsPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const DetailPage = lazy(() => import('@/pages/DetailPage').then((m) => ({ default: m.DetailPage })))
const PlayerPage = lazy(() => import('@/features/player').then((m) => ({ default: m.PlayerPage })))

function FocusedRoutes() {
  const navigate = useNavigate()
  const location = useLocation()

  const onBack = useCallback(() => {
    if (location.pathname === '/player') {
      navigate(-1)
      return
    }
    if (location.pathname.startsWith('/details')) {
      navigate(-1)
      return
    }
    if (
      location.pathname !== '/home' &&
      location.pathname !== '/' &&
      !location.pathname.startsWith('/details')
    ) {
      navigate('/home')
    }
  }, [location.pathname, navigate])

  return (
    <TvFocusProvider onBack={onBack}>
      <Suspense fallback={<div style={{ background: '#020617', width: '100vw', height: '100vh' }} />}>
        <Routes>
          <Route path="/" element={<SplashPage />} />
          <Route path="/player" element={<PlayerPage />} />
          <Route element={<AppShell />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/live" element={<LiveTvPage />} />
            <Route path="/movies" element={<MoviesPage />} />
            <Route path="/series" element={<SeriesPage />} />
            <Route path="/playlists" element={<PlaylistsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/details/:type/:id" element={<DetailPage />} />
          </Route>
        </Routes>
      </Suspense>
    </TvFocusProvider>
  )
}

export function AppRoutes() {
  const isTizenRuntime =
    typeof window !== 'undefined' &&
    (typeof window.tizen !== 'undefined' || typeof window.webapis !== 'undefined')

  const embeddedShell =
    typeof window !== 'undefined' &&
    (() => {
      try {
        if (window.self !== window.top) return true
      } catch {
        return true
      }
      return new URLSearchParams(window.location.search).get('shell') === 'tizen'
    })()

  const Router = isTizenRuntime || embeddedShell ? HashRouter : BrowserRouter

  return (
    <Router>
      <FocusedRoutes />
    </Router>
  )
}
