import { useMemo } from 'react'
import { FocusPlan, TVFocusable } from '@/lib/tvFocus'
import { APP_HDR, buildAppTopBar, mergeNeighborMaps } from '@/lib/tvFocus/buildMaps'
import type { TvFocusPlan } from '@/lib/tvFocus/types'

export function SettingsPage() {
  const plan: TvFocusPlan = useMemo(
    () => ({
      neighbors: mergeNeighborMaps(buildAppTopBar('st-0'), {
        'st-0': {
          left: APP_HDR.logo,
          right: undefined,
          up: APP_HDR.logo,
          down: undefined,
        },
      }),
      defaultFocusId: 'st-0',
    }),
    [],
  )

  return (
    <FocusPlan plan={plan}>
      <h1 className="tv-page-title">Settings</h1>
      <TVFocusable id="st-0">
        <div className="settings-placeholder">
          <p>
            Placeholder de definições. Na fase seguinte: rede, conta, áudio e integração com a TV.
          </p>
        </div>
      </TVFocusable>
    </FocusPlan>
  )
}
