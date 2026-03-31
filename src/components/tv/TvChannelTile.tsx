import { TVFocusable } from '@/lib/tvFocus'

export function TvChannelTile({
  focusId,
  name,
  logoUrl,
  onActivate,
}: {
  focusId: string
  name: string
  logoUrl: string
  onActivate: () => void
}) {
  return (
    <TVFocusable id={focusId}>
      <div
        className="tv-card live-channel-tile card-wrap"
        data-tv-activate
        role="button"
        onClick={onActivate}
      >
        <img src={logoUrl} alt="" loading="lazy" />
        <span className="sr-only">{name}</span>
      </div>
    </TVFocusable>
  )
}
