import { TVFocusable } from '@/lib/tvFocus'
import { HOME_HUB_BG } from '@/lib/homeHubBackgrounds'

function IconLive() {
  return (
    <svg className="home-hub-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16v10H4V7zm2 2v6h12V9H6z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M8 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconFilm() {
  return (
    <svg className="home-hub-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function IconSeries() {
  return (
    <svg className="home-hub-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="5" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 19h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** ListVideo (legado lucide) — forma equivalente. */
function IconListVideo() {
  return (
    <svg className="home-hub-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6h16M4 12h10M4 18h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M17 10l3 2-3 2v-4z" fill="currentColor" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg className="home-hub-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" className="home-hub-play-icon" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  )
}

/**
 * Mesmos cinco destaques que `nexus-vision-prime` Index: Live TV, Movies, Series, Playlists, Settings.
 */
export function HomeHubGrid({
  onLive,
  onMovies,
  onSeries,
  onPlaylists,
  onSettings,
}: {
  onLive: () => void
  onMovies: () => void
  onSeries: () => void
  onPlaylists: () => void
  onSettings: () => void
}) {
  return (
    <div className="home-hub-grid" role="navigation" aria-label="Main destinations">
      <TVFocusable id="hub-0" className="home-hub-tile home-hub-tile--hero">
        <div
          className="home-hub-tile-inner home-hub-tile-inner--hero"
          data-tv-activate
          role="button"
          onClick={onLive}
        >
          <div className="home-hub-tile-bg" aria-hidden>
            <img src={HOME_HUB_BG.liveTv} alt="" loading="eager" decoding="async" />
            <div className="home-hub-tile-bg__grad" />
            <div className="home-hub-tile-bg__accent" />
          </div>
          <div className="home-hub-hero-badge" aria-hidden>
            <span className="home-hub-hero-play">
              <IconPlay />
            </span>
          </div>
          <div className="home-hub-hero-copy">
            <div className="home-hub-hero-kicker">
              <IconLive />
              <span className="home-hub-pill">Live now</span>
            </div>
            <h2 className="home-hub-hero-title">Live TV</h2>
            <p className="home-hub-hero-sub">Channels &amp; EPG</p>
          </div>
        </div>
      </TVFocusable>

      <TVFocusable id="hub-1" className="home-hub-tile home-hub-tile--sm">
        <div
          className="home-hub-tile-inner home-hub-tile-inner--sm"
          data-tv-activate
          role="button"
          onClick={onMovies}
        >
          <div className="home-hub-tile-bg" aria-hidden>
            <img src={HOME_HUB_BG.movies} alt="" loading="lazy" />
            <div className="home-hub-tile-bg__grad home-hub-tile-bg__grad--sm" />
          </div>
          <IconFilm />
          <div className="home-hub-sm-copy">
            <h3 className="home-hub-sm-title">Movies</h3>
            <p className="home-hub-sm-sub">On demand</p>
          </div>
        </div>
      </TVFocusable>

      <TVFocusable id="hub-2" className="home-hub-tile home-hub-tile--sm">
        <div
          className="home-hub-tile-inner home-hub-tile-inner--sm"
          data-tv-activate
          role="button"
          onClick={onSeries}
        >
          <div className="home-hub-tile-bg" aria-hidden>
            <img src={HOME_HUB_BG.series} alt="" loading="lazy" />
            <div className="home-hub-tile-bg__grad home-hub-tile-bg__grad--sm" />
          </div>
          <IconSeries />
          <div className="home-hub-sm-copy">
            <h3 className="home-hub-sm-title">Series</h3>
            <p className="home-hub-sm-sub">Box sets &amp; more</p>
          </div>
        </div>
      </TVFocusable>

      <TVFocusable id="hub-3" className="home-hub-tile home-hub-tile--sm">
        <div
          className="home-hub-tile-inner home-hub-tile-inner--sm"
          data-tv-activate
          role="button"
          onClick={onPlaylists}
        >
          <div className="home-hub-tile-bg" aria-hidden>
            <img src={HOME_HUB_BG.playlists} alt="" loading="lazy" />
            <div className="home-hub-tile-bg__grad home-hub-tile-bg__grad--sm" />
          </div>
          <IconListVideo />
          <div className="home-hub-sm-copy">
            <h3 className="home-hub-sm-title">Playlists</h3>
            <p className="home-hub-sm-sub">Custom curations</p>
          </div>
        </div>
      </TVFocusable>

      <TVFocusable id="hub-4" className="home-hub-tile home-hub-tile--sm">
        <div
          className="home-hub-tile-inner home-hub-tile-inner--sm"
          data-tv-activate
          role="button"
          onClick={onSettings}
        >
          <div className="home-hub-tile-bg" aria-hidden>
            <img src={HOME_HUB_BG.settings} alt="" loading="lazy" />
            <div className="home-hub-tile-bg__grad home-hub-tile-bg__grad--sm" />
          </div>
          <IconSettings />
          <div className="home-hub-sm-copy">
            <h3 className="home-hub-sm-title">Settings</h3>
            <p className="home-hub-sm-sub">App &amp; proxy</p>
          </div>
        </div>
      </TVFocusable>
    </div>
  )
}
