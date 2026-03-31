import type { TvFocusPlan, TvNeighborMap } from './types'

/**
 * Home alinhada ao `nexus-vision-prime` Index:
 * header (logo · perfil · energia) + hub bento — sem menu lateral.
 */
export function buildLegacyStyleHomeFocusPlan(): TvFocusPlan {
  const neighbors: TvNeighborMap = {}

  neighbors['hdr-logo'] = {
    left: undefined,
    right: 'hdr-profile',
    down: 'hub-0',
    up: undefined,
  }
  neighbors['hdr-profile'] = {
    left: 'hdr-logo',
    right: 'hdr-power',
    down: 'hub-1',
    up: undefined,
  }
  neighbors['hdr-power'] = {
    left: 'hdr-profile',
    right: undefined,
    down: 'hub-2',
    up: undefined,
  }

  neighbors['hub-0'] = {
    left: undefined,
    right: 'hub-1',
    down: 'hub-3',
    up: 'hdr-logo',
  }
  neighbors['hub-1'] = {
    left: 'hub-0',
    right: 'hub-2',
    down: 'hub-3',
    up: 'hdr-profile',
  }
  neighbors['hub-2'] = {
    left: 'hub-1',
    right: undefined,
    down: 'hub-4',
    up: 'hdr-power',
  }
  neighbors['hub-3'] = {
    left: 'hub-0',
    right: 'hub-4',
    down: undefined,
    up: 'hub-1',
  }
  neighbors['hub-4'] = {
    left: 'hub-3',
    right: undefined,
    down: undefined,
    up: 'hub-2',
  }

  return { neighbors, defaultFocusId: 'hub-0' }
}
