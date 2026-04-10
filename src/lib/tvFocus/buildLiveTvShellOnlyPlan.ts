import { buildAppTopBar, buildVodCatalogHeaderNeighbors } from './buildMaps'
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

/** Movies/Series: ↓ dos ícones à direita do header → search da grelha (`movies-grid-search` / `series-grid-search`). */
export function buildVodCatalogShellPlan(
  shellMainFocusId: string,
  gridSearchId: string,
): TvFocusPlan {
  return {
    neighbors: buildVodCatalogHeaderNeighbors(shellMainFocusId, gridSearchId),
    defaultFocusId: shellMainFocusId,
  }
}
