import { createContext } from 'react'
import type { TvFocusPlan } from './types'

export type ElementRef = HTMLElement | null

export interface TvFocusContextValue {
  setFocusedId: (id: string | null) => void
  register: (id: string, el: ElementRef) => void
  unregister: (id: string) => void
  isFocused: (id: string) => boolean
  mountPlan: (plan: TvFocusPlan) => void
  unmountPlan: () => void
}

export const TvFocusContext = createContext<TvFocusContextValue | null>(null)
