import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TVFocusable } from '@/lib/tvFocus'
import { AccountInfoDialog } from './AccountInfoDialog'

function requestExit(): void {
  window.dispatchEvent(new CustomEvent('tv-request-exit'))
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

function IconSettings() {
  return (
    <svg className="home-chrome-header__icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
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
  const [showAccount, setShowAccount] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setTime(new Date()), 30000)
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
    <>
    <header className="home-chrome-header">
      <div className="home-chrome-header__left">
        <div className="home-chrome-header__brand-wrap">
          <div
            className="home-chrome-header__brand"
            onClick={() => navigate('/home')}
            role="link"
          >
            <div className="home-chrome-header__mark" aria-hidden>
              <span className="home-chrome-header__mark-text">TV</span>
            </div>
            <span className="home-chrome-header__title">
              Stream<span className="home-chrome-header__title-accent">Pro</span>
            </span>
          </div>
        </div>
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
            onClick={() => setShowAccount(true)}
          >
            <IconUser />
            <span className="sr-only">Profile</span>
          </div>
        </TVFocusable>
        <TVFocusable id="hdr-settings" className="home-chrome-header__action">
          <div
            className="home-chrome-header__action-inner"
            data-tv-activate
            role="button"
            onClick={() => navigate('/settings')}
          >
            <IconSettings />
            <span className="sr-only">Settings</span>
          </div>
        </TVFocusable>
        <TVFocusable id="hdr-power" className="home-chrome-header__action">
          <div
            className="home-chrome-header__action-inner"
            data-tv-activate
            role="button"
            onClick={requestExit}
          >
            <IconPower />
            <span className="sr-only">Power</span>
          </div>
        </TVFocusable>
      </div>
    </header>

    {showAccount && (
      <AccountInfoDialog onClose={() => setShowAccount(false)} />
    )}
  </>
  )
}
