import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPlaylistBootstrapState } from '@/features/playlists'

export function SplashPage() {
  const navigate = useNavigate()

  useEffect(() => {
    getPlaylistBootstrapState()
    const t = window.setTimeout(() => {
      navigate('/home', { replace: true })
    }, 1200)
    return () => window.clearTimeout(t)
  }, [navigate])

  return (
    <div className="splash">
      <div className="splash__logo">IPTV Samsung</div>
      <p className="splash__sub">Smart TV · experiência pensada para o comando</p>
      <div className="splash__bar" aria-hidden>
        <div className="splash__bar-fill" />
      </div>
    </div>
  )
}
