import { createContext } from 'react'
import type { TvFocusPlan } from './types'

export type ElementRef = HTMLElement | null

export interface TvFocusContextValue {
  focusedId: string | null
  setFocusedId: (id: string | null) => void
  register: (id: string, el: ElementRef) => void
  unregister: (id: string) => void
  isFocused: (id: string) => boolean
  mountPlan: (plan: TvFocusPlan) => void
  unmountPlan: () => void
  onBack?: () => void
}

export const TvFocusContext = createContext<TvFocusContextValue | null>(null)
