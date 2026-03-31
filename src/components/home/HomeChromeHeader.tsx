import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TVFocusable } from '@/lib/tvFocus'

function attemptExitApp(): void {
  const nav = window.navigator as Navigator & { app?: { exitApp?: () => void } }
  if (typeof nav.app?.exitApp === 'function') {
    nav.app.exitApp()
    return
  }
  window.close()
}

function IconUser() {
  return (
    <svg className="home-chrome-header__icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6 19c0-3.3 2.7-6 6-6s6 2.7 6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconPower() {
  return (
    <svg className="home-chrome-header__icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M8.5 6.5a7 7 0 1 0 7 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Réplica leve do IPTVHeader na home antiga: logo, relógio, perfil, energia.
 * Sem storage Xtream — ações mínimas fase 1.
 */
export function HomeChromeHeader() {
  const navigate = useNavigate()
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setTime(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

  return (
    <header className="home-chrome-header">
      <div className="home-chrome-header__left">
        <TVFocusable id="hdr-logo" className="home-chrome-header__brand-wrap">
          <div
            className="home-chrome-header__brand"
            data-tv-activate
            role="button"
            onClick={() => navigate('/home')}
          >
            <div className="home-chrome-header__mark" aria-hidden>
              <span className="home-chrome-header__mark-text">TV</span>
            </div>
            <span className="home-chrome-header__title">
              Stream<span className="home-chrome-header__title-accent">Pro</span>
            </span>
          </div>
        </TVFocusable>
      </div>

      <div className="home-chrome-header__clock">
        <div className="home-chrome-header__time">{formatTime(time)}</div>
        <div className="home-chrome-header__date">{formatDate(time)}</div>
      </div>

      <div className="home-chrome-header__actions">
        <TVFocusable id="hdr-profile" className="home-chrome-header__action">
          <div
            className="home-chrome-header__action-inner"
            data-tv-activate
            role="button"
            onClick={() => {
              window.alert('Account (Phase 1 placeholder — same slot as Profile in the legacy app).')
            }}
          >
            <IconUser />
            <span className="sr-only">Profile</span>
          </div>
        </TVFocusable>
        <TVFocusable id="hdr-power" className="home-chrome-header__action">
          <div
            className="home-chrome-header__action-inner"
            data-tv-activate
            role="button"
            onClick={() => {
              const ok = window.confirm('Deseja sair do aplicativo?')
              if (ok) attemptExitApp()
            }}
          >
            <IconPower />
            <span className="sr-only">Power</span>
          </div>
        </TVFocusable>
      </div>
    </header>
  )
}
