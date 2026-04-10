import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initializeTvRuntime } from '@/lib/tvPlatform'
import { isSamsungTizenLikeRuntime } from '@/lib/tvFocus/tvRemoteKeys'
import './index.css'
import App from './App.tsx'

if (typeof window !== 'undefined') {
  initializeTvRuntime()
}

if (typeof document !== 'undefined' && isSamsungTizenLikeRuntime()) {
  document.documentElement.classList.add('tv-samsung-tizen')
  document.documentElement.classList.add('tv-fast-focus')
}

const appNode = isSamsungTizenLikeRuntime() ? <App /> : <StrictMode><App /></StrictMode>

createRoot(document.getElementById('root')!).render(appNode)
