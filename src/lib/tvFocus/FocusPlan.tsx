import { useEffect } from 'react'
import type { TvFocusPlan } from './types'
import { useTvFocus } from './useTvFocus'

/** Associa um mapa de vizinhos à página atual; desmonta ao sair da rota. */
export function FocusPlan({
  plan,
  children,
}: {
  plan: TvFocusPlan
  children: React.ReactNode
}) {
  const { mountPlan, unmountPlan } = useTvFocus()

  useEffect(() => {
    mountPlan(plan)
    return () => unmountPlan()
  }, [plan, mountPlan, unmountPlan])

  return children
}
