import { APP_HDR, buildAppTopBar, buildGridNeighbors, mergeNeighborMaps } from './buildMaps'
import type { TvFocusPlan, TvNeighborMap } from './types'

export function buildGridPagePlan(itemCount: number, columns: number): TvFocusPlan {
  const back = APP_HDR.logo
  if (itemCount === 0) {
    const shell = buildAppTopBar('grid-empty')
    return {
      neighbors: mergeNeighborMaps(shell, {
        'grid-empty': { left: back, up: APP_HDR.logo },
      }),
      defaultFocusId: 'grid-empty',
    }
  }

  const rows = Math.max(1, Math.ceil(itemCount / columns))
  const colsPerRow: number[] = []
  let remaining = itemCount
  for (let r = 0; r < rows; r++) {
    const c = Math.min(columns, remaining)
    colsPerRow.push(c)
    remaining -= c
  }
  const shell = buildAppTopBar('g-0-0')
  const grid = buildGridNeighbors(rows, colsPerRow, {})
  const neighbors: TvNeighborMap = mergeNeighborMaps(shell, grid)

  const row0Cols = colsPerRow[0] ?? 0
  for (let c = 0; c < row0Cols; c++) {
    const id = `g-0-${c}`
    const cur = neighbors[id] ?? {}
    neighbors[id] = { ...cur, up: APP_HDR.logo }
  }

  for (let r = 0; r < rows; r++) {
    const id = `g-${r}-0`
    const cur = neighbors[id] ?? {}
    neighbors[id] = { ...cur, left: back }
  }
  const first = neighbors['g-0-0'] ?? {}
  neighbors['g-0-0'] = { ...first, left: back, up: APP_HDR.logo }
  return { neighbors, defaultFocusId: 'g-0-0' }
}
