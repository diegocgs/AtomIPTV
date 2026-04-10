import { useEffect } from 'react'
import { AppRoutes } from '@/app/AppRoutes'

export default function App() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    let parentWindow
    try {
      if (window.self === window.top) return
      parentWindow = window.parent
    } catch {
      parentWindow = window.parent
    }
    if (!parentWindow) return

    const notifyReady = () => {
      parentWindow.postMessage(
        {
          type: 'iptv-shell-ready',
          href: window.location.href,
          ts: Date.now(),
        },
        '*',
      )
    }

    const id = window.setTimeout(notifyReady, 120)
    window.addEventListener('load', notifyReady, { once: true })
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('load', notifyReady)
    }
  }, [])

  return <AppRoutes />
}
