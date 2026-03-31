import { buildAppTopBar } from './buildMaps'
import type { TvFocusPlan } from './types'

/**
 * Só cabeçalho + defaultFocusId. A grelha Live TV usa `useLiveTvNavigation`
 * (comportamento alinhado a nexus-vision-prime LiveTV.tsx).
 */
export function buildLiveTvShellOnlyPlan(firstMain: string): TvFocusPlan {
  return {
    neighbors: buildAppTopBar(firstMain),
    defaultFocusId: firstMain,
  }
}
