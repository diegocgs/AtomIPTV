import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { isSamsungTizenLikeRuntime } from '@/lib/tvFocus/tvRemoteKeys'
import './index.css'
import App from './App.tsx'

if (typeof document !== 'undefined' && isSamsungTizenLikeRuntime()) {
  document.documentElement.classList.add('tv-samsung-tizen')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
