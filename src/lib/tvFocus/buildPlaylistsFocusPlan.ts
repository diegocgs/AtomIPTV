import { APP_HDR, buildAppTopBar, mergeNeighborMaps } from './buildMaps'
import type { TvFocusPlan, TvNeighborMap } from './types'

const H = APP_HDR.logo

/** Lista principal: Add + cartões + edit/delete por item (fluxo vertical TV-friendly). */
export function buildPlaylistsListFocusPlan(playlistCount: number): TvFocusPlan {
  const neighbors: TvNeighborMap = mergeNeighborMaps(buildAppTopBar('pl-add'), {})

  if (playlistCount === 0) {
    neighbors['pl-add'] = {
      up: H,
      down: undefined,
      left: H,
      right: undefined,
    }
    return { neighbors, defaultFocusId: 'pl-add' }
  }

  neighbors['pl-add'] = {
    up: H,
    down: 'pl-c-0',
    left: H,
    right: 'pl-c-0',
  }

  for (let i = 0; i < playlistCount; i++) {
    neighbors[`pl-c-${i}`] = {
      up: i === 0 ? 'pl-add' : `pl-d-${i - 1}`,
      down: `pl-e-${i}`,
      left: i === 0 ? 'pl-add' : `pl-c-${i - 1}`,
      right: i < playlistCount - 1 ? `pl-c-${i + 1}` : undefined,
    }
    neighbors[`pl-e-${i}`] = {
      up: `pl-c-${i}`,
      down: `pl-d-${i}`,
      left: H,
      right: `pl-d-${i}`,
    }
    neighbors[`pl-d-${i}`] = {
      up: `pl-c-${i}`,
      down: i < playlistCount - 1 ? `pl-c-${i + 1}` : undefined,
      left: `pl-e-${i}`,
      right: i < playlistCount - 1 ? `pl-c-${i + 1}` : undefined,
    }
  }

  return { neighbors, defaultFocusId: 'pl-add' }
}

/** Confirmar eliminação. */
export function buildPlaylistsDeleteDialogPlan(): TvFocusPlan {
  const neighbors: TvNeighborMap = mergeNeighborMaps(buildAppTopBar('pl-dlg-no'), {
    'pl-dlg-no': {
      left: undefined,
      right: 'pl-dlg-yes',
      up: H,
      down: undefined,
    },
    'pl-dlg-yes': {
      left: 'pl-dlg-no',
      right: undefined,
      up: H,
      down: undefined,
    },
  })
  return { neighbors, defaultFocusId: 'pl-dlg-no' }
}
