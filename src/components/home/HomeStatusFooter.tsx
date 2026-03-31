/**
 * Réplica estática do rodapé de estado do app antigo (sem fetch Xtream).
 */
export function HomeStatusFooter() {
  return (
    <footer className="home-status-footer">
      <div className="home-status-footer__left">
        <div className="home-status-footer__block">
          <span className="home-status-footer__label">Current Playlist: </span>
          <span className="home-status-footer__value">Mock playlist</span>
        </div>
        <div className="home-status-footer__block">
          <span className="home-status-footer__label">Expires: </span>
          <span className="home-status-footer__value">—</span>
        </div>
      </div>
      <div className="home-status-footer__right">
        <span className="home-status-footer__hint">M3U (no Xtream account)</span>
        <span className="home-status-footer__ver">v0.0.0</span>
      </div>
    </footer>
  )
}
