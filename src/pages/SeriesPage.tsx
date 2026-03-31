import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TvPosterCard } from '@/components/tv/TvPosterCard'
import { FocusPlan } from '@/lib/tvFocus'
import { buildGridPagePlan } from '@/lib/tvFocus/buildGridPagePlan'
import { mockSeries } from '@/services/mocks'

const COLS = 4

export function SeriesPage() {
  const navigate = useNavigate()
  const plan = useMemo(() => buildGridPagePlan(mockSeries.length, COLS), [])

  return (
    <FocusPlan plan={plan}>
      <h1 className="tv-page-title">Séries</h1>
      <div className="grid-page">
        {mockSeries.map((s, idx) => {
          const row = Math.floor(idx / COLS)
          const col = idx % COLS
          return (
            <div key={s.id} className="grid-card">
              <TvPosterCard
                focusId={`g-${row}-${col}`}
                title={s.title}
                imageUrl={s.posterUrl}
                onActivate={() => navigate(`/details/series/${s.id}`)}
              />
            </div>
          )
        })}
      </div>
    </FocusPlan>
  )
}
