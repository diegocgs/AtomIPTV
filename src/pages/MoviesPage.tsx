import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TvPosterCard } from '@/components/tv/TvPosterCard'
import { FocusPlan } from '@/lib/tvFocus'
import { buildGridPagePlan } from '@/lib/tvFocus/buildGridPagePlan'
import { mockMovies } from '@/services/mocks'

const COLS = 4

export function MoviesPage() {
  const navigate = useNavigate()
  const plan = useMemo(() => buildGridPagePlan(mockMovies.length, COLS), [])

  return (
    <FocusPlan plan={plan}>
      <h1 className="tv-page-title">Filmes</h1>
      <div className="grid-page">
        {mockMovies.map((m, idx) => {
          const row = Math.floor(idx / COLS)
          const col = idx % COLS
          return (
            <div key={m.id} className="grid-card">
              <TvPosterCard
                focusId={`g-${row}-${col}`}
                title={m.title}
                imageUrl={m.posterUrl}
                badge={m.badge}
                onActivate={() => navigate(`/details/movie/${m.id}`)}
              />
            </div>
          )
        })}
      </div>
    </FocusPlan>
  )
}
