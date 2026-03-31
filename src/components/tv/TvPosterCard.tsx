import { TVFocusable } from '@/lib/tvFocus'

export function TvPosterCard({
  focusId,
  title,
  imageUrl,
  badge,
  wide,
  progressPct,
  showTitle = false,
  onActivate,
}: {
  focusId: string
  title: string
  imageUrl: string
  badge?: string
  wide?: boolean
  progressPct?: number
  /** Mostra título sobreposto na parte inferior (cartões mais “ricos”). */
  showTitle?: boolean
  onActivate: () => void
}) {
  return (
    <TVFocusable id={focusId} className="tv-poster-focus">
      <div
        className={`tv-card tv-card--rich poster-card card-wrap ${wide ? 'poster-card--wide' : ''}`}
        data-tv-activate
        role="button"
        onClick={onActivate}
      >
        <div className="tv-card__media">
          <img className="tv-card__img" src={imageUrl} alt="" loading="lazy" />
          <div className="tv-card__media-shade" aria-hidden />
        </div>
        {badge ? <span className="badge">{badge}</span> : null}
        {progressPct !== undefined ? (
          <div className="progress-bar" aria-hidden>
            <div
              className="progress-bar__fill"
              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            />
          </div>
        ) : null}
        {showTitle ? (
          <div className="tv-card__caption">
            <span className="tv-card__caption-title">{title}</span>
          </div>
        ) : (
          <span className="sr-only">{title}</span>
        )}
      </div>
    </TVFocusable>
  )
}
