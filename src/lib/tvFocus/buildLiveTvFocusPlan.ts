import {
  APP_HDR,
  buildAppTopBar,
  buildGridNeighbors,
  mergeCategoryGrid,
  mergeNeighborMaps,
} from './buildMaps'
import type { TvFocusPlan, TvNeighborMap } from './types'

export function buildLiveTvFocusPlan(
  categoryCount: number,
  channelCount: number,
  columns: number,
  lastCategoryFocusId: string,
): TvFocusPlan {
  const rows = Math.max(1, Math.ceil(channelCount / columns))
  const colsPerRow: number[] = []
  let remaining = channelCount
  for (let r = 0; r < rows; r++) {
    const c = Math.min(columns, remaining)
    colsPerRow.push(c)
    remaining -= c
  }
  const grid = buildGridNeighbors(rows, colsPerRow, {})
  const withCats = mergeCategoryGrid(
    categoryCount,
    grid,
    'g-0-0',
    lastCategoryFocusId,
  )
  const shell = buildAppTopBar('cat-0')
  const neighbors: TvNeighborMap = mergeNeighborMaps(shell, withCats)
  const back = APP_HDR.profile
  for (let i = 0; i < categoryCount; i++) {
    const id = `cat-${i}`
    const cur = neighbors[id] ?? {}
    neighbors[id] = { ...cur, left: back }
  }
  const cat0 = neighbors['cat-0'] ?? {}
  neighbors['cat-0'] = { ...cat0, up: APP_HDR.profile }
  return { neighbors, defaultFocusId: 'cat-0' }
}
