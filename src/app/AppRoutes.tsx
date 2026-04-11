import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { TvFocusProvider } from '@/lib/tvFocus'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ExitConfirmDialog } from '@/components/ExitConfirmDialog'
import { SplashPage } from '@/pages/SplashPage'
import { HomePage } from '@/pages/HomePage'
const LiveTvPage = lazy(() => import('@/pages/LiveTvPage').then((m) => ({ default: m.LiveTvPage })))
const MoviesPage = lazy(() => import('@/pages/MoviesPage'))
const SeriesPage = lazy(() => import('@/pages/SeriesPage'))
const PlaylistsPage = lazy(() => import('@/pages/PlaylistsPage').then((m) => ({ default: m.PlaylistsPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const DetailPage = lazy(() => import('@/pages/DetailPage').then((m) => ({ default: m.DetailPage })))
const PlayerPage = lazy(() => import('@/features/player').then((m) => ({ default: m.PlayerPage })))

/**
 * Na inicialização, se o hash persistiu de uma sessão anterior (ex.: TV desligada com #/live),
 * redireciona para a splash para garantir uma experiência limpa.
 */
function useForceStartAtSplash() {
  const navigate = useNavigate()
  const location = useLocation()
  const didBootRef = useRef(false)

  useEffect(() => {
    if (didBootRef.current) return
    didBootRef.current = true
    // Se o app arrancou numa rota que não é splash nem home, redirecionar para splash
    if (location.pathname !== '/' && location.pathname !== '/home') {
      navigate('/', { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

function FocusedRoutes() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showExitDialog, setShowExitDialog] = useState(false)
  useForceStartAtSplash()

  const playerReturnTo =
    location.pathname === '/player' &&
    location.state &&
    typeof location.state === 'object' &&
    typeof (location.state as { returnTo?: unknown }).returnTo === 'string'
      ? (location.state as { returnTo: string }).returnTo
      : '/home'

  const onBack = useCallback(() => {
    // Se um modal/fullscreen está aberto (data-tv-modal-open), o Back é tratado
    // pelo componente que o abriu via tv-modal-escape — não navegar.
    if (document.querySelector('[data-tv-modal-open="1"]')) {
      window.dispatchEvent(new CustomEvent('tv-modal-escape'))
      return
    }
    if (location.pathname === '/player') {
      navigate(playerReturnTo, { replace: true })
      return
    }
    if (location.pathname.startsWith('/details')) {
      navigate(-1)
      return
    }
    if (location.pathname === '/home' || location.pathname === '/') {
      setShowExitDialog(true)
      return
    }
    navigate('/home')
  }, [location.pathname, navigate, playerReturnTo])

  useEffect(() => {
    function onRequestExit() {
      setShowExitDialog(true)
    }
    window.addEventListener('tv-request-exit', onRequestExit)
    return () => window.removeEventListener('tv-request-exit', onRequestExit)
  }, [])

  return (
    <TvFocusProvider onBack={onBack}>
      <ErrorBoundary>
        <Suspense fallback={<div style={{ background: '#020617', width: '100vw', height: '100vh' }} />}>
          <Routes>
            <Route path="/" element={<SplashPage />} />
            <Route path="/player" element={<PlayerPage />} />
            <Route element={<AppShell />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/movies" element={<MoviesPage />} />
              <Route path="/series" element={<SeriesPage />} />
              <Route path="/live" element={<LiveTvPage />} />
              <Route path="/playlists" element={<PlaylistsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/details/:type/:id" element={<DetailPage />} />
            </Route>
          </Routes>
        </Suspense>
        {showExitDialog && <ExitConfirmDialog onClose={() => setShowExitDialog(false)} />}
      </ErrorBoundary>
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
