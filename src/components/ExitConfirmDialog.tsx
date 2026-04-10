import { useEffect, useRef } from 'react'
import { TVFocusable } from '@/lib/tvFocus'
import { tvFocusIdStore } from '@/lib/tvFocus/tvFocusIdStore'
import { isRemoteBackKey, isRemoteEnterKey } from '@/lib/tvFocus'

interface Props {
  onClose: () => void
}

function attemptExitApp(): void {
  try {
    const tizen = (window as Window & { tizen?: { application?: { getCurrentApplication?: () => { exit?: () => void } } } }).tizen
    if (typeof tizen?.application?.getCurrentApplication === 'function') {
      const app = tizen.application.getCurrentApplication()
      if (typeof app?.exit === 'function') {
        app.exit()
        return
      }
    }
  } catch {
    // ignore
  }
  const nav = window.navigator as Navigator & { app?: { exitApp?: () => void } }
  if (typeof nav.app?.exitApp === 'function') {
    nav.app.exitApp()
    return
  }
  window.close()
}

const FOCUS_NO = 'exit-dlg-no'
const FOCUS_YES = 'exit-dlg-yes'

export function ExitConfirmDialog({ onClose }: Props) {
  const prevFocusIdRef = useRef<string | null>(null)

  useEffect(() => {
    prevFocusIdRef.current = tvFocusIdStore.get()
    tvFocusIdStore.set(FOCUS_NO)
    return () => {
      tvFocusIdStore.set(prevFocusIdRef.current)
    }
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const current = tvFocusIdStore.get()
      if (isRemoteBackKey(e)) {
        e.preventDefault()
        e.stopImmediatePropagation()
        onClose()
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopImmediatePropagation()
        tvFocusIdStore.set(current === FOCUS_NO ? FOCUS_YES : FOCUS_NO)
        return
      }
      if (isRemoteEnterKey(e) || e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (current === FOCUS_YES) {
          attemptExitApp()
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [onClose])

  return (
    <div
      className="exit-dlg__backdrop"
      data-tv-modal-open="1"
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar saída"
    >
      <div className="exit-dlg__box">
        <p className="exit-dlg__msg">Deseja sair do aplicativo?</p>
        <div className="exit-dlg__actions">
          <TVFocusable id={FOCUS_NO} className="exit-dlg__btn-wrap">
            <button
              className="exit-dlg__btn"
              data-tv-activate
              onClick={onClose}
            >
              Não
            </button>
          </TVFocusable>
          <TVFocusable id={FOCUS_YES} className="exit-dlg__btn-wrap">
            <button
              className="exit-dlg__btn exit-dlg__btn--danger"
              data-tv-activate
              onClick={attemptExitApp}
            >
              Sair
            </button>
          </TVFocusable>
        </div>
      </div>
    </div>
  )
}
