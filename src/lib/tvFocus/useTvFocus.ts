import { useContext } from 'react'
import { TvFocusContext } from './context'

export function useTvFocus() {
  const ctx = useContext(TvFocusContext)
  if (!ctx) throw new Error('useTvFocus must be used within TvFocusProvider')
  return ctx
}
