import { useEffect, useMemo, useState } from 'react'
import { TVFocusable } from '@/lib/tvFocus'
import { tvFocusIdStore } from '@/lib/tvFocus/tvFocusIdStore'
import { usePlaylists } from '@/features/playlists'
import {
  getXtreamCredentialsForApp,
  shouldUseXtreamApiForActivePlaylist,
  tryDeriveXtreamCredentialsFromM3uCacheAsync,
  tryDeriveXtreamCredentialsFromM3uFetchAsync,
} from '@/lib/playlistsStorage'
import {
  fetchXtreamAccountSnapshot,
  formatXtreamExpDateDisplay,
  type XtreamAccountSnapshot,
  type XtreamCredentials,
} from '@/services/xtream'

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Tenta fetch directo ao provider (DEV HTTP→HTTP sem mixed content; alguns providers aceitam CORS). */
async function fetchSnapshotDirect(creds: XtreamCredentials): Promise<XtreamAccountSnapshot | null> {
  try {
    const base = creds.serverUrl.replace(/\/+$/, '')
    const url = `${base}/player_api.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}`
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const json = await res.json() as Record<string, unknown>
    const userInfo = (json.user_info ?? {}) as Record<string, unknown>
    const serverInfo = (json.server_info ?? {}) as Record<string, unknown>
    const auth = Number(userInfo.auth) === 1
    const str = (v: unknown) => (v == null ? '' : String(v))
    if (!auth) return { authenticated: false, status: str(userInfo.status) || 'Unauthorized' }
    return {
      authenticated: true,
      status: str(userInfo.status) || 'Active',
      expDateRaw: str(userInfo.exp_date),
      username: str(userInfo.username) || creds.username,
      activeCons: str(userInfo.active_cons),
      maxConnections: str(userInfo.max_connections),
      isTrial: str(userInfo.is_trial),
      createdAtRaw: str(userInfo.created_at),
      serverTimezone: str(serverInfo.timezone),
      serverProtocol: str(serverInfo.server_protocol ?? serverInfo.protocol),
      serverPort: str(serverInfo.port),
    }
  } catch {
    return null
  }
}

async function loadAccountSnapshot(creds: XtreamCredentials): Promise<XtreamAccountSnapshot | null> {
  const snap = await fetchXtreamAccountSnapshot(creds)
  if (snap !== null) return snap
  return fetchSnapshotDirect(creds)
}

function formatExpiry(snap: XtreamAccountSnapshot): string {
  if (!snap.authenticated) return '—'
  const raw = snap.expDateRaw
  if (!raw?.trim()) return 'Never'
  return formatXtreamExpDateDisplay(raw)
}

function formatConnections(snap: XtreamAccountSnapshot): string {
  const active = snap.activeCons ?? ''
  const max = snap.maxConnections ?? ''
  if (!active && !max) return '—'
  if (!max) return active || '—'
  return `${active} / ${max}`
}

// ─── row component ─────────────────────────────────────────────────────────────

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="acct-dialog__row">
      <span className="acct-dialog__row-label">{label}</span>
      <span className={`acct-dialog__row-value${accent ? ' acct-dialog__row-value--accent' : ''}`}>
        {value}
      </span>
    </div>
  )
}

// ─── main dialog ───────────────────────────────────────────────────────────────

type Props = {
  onClose: () => void
}

export function AccountInfoDialog({ onClose }: Props) {
  const { playlists, activePlaylistId } = usePlaylists()
  const [snapshot, setSnapshot] = useState<XtreamAccountSnapshot | null | undefined>(undefined)
  const [derivedCreds, setDerivedCreds] = useState<XtreamCredentials | null>(null)
  // Mensagem de loading durante derivação de credenciais (pode implicar download M3U)
  const [credLoadingMsg, setCredLoadingMsg] = useState<string | null>(null)

  const activePlaylist = useMemo(
    () => playlists.find((p) => p.id === activePlaylistId) ?? null,
    [activePlaylistId, playlists],
  )

  const xtreamLikeSource = shouldUseXtreamApiForActivePlaylist()
  const syncCreds = useMemo(
    () => (xtreamLikeSource ? getXtreamCredentialsForApp() : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [xtreamLikeSource, activePlaylistId],
  )
  const effectiveCreds = syncCreds ?? derivedCreds
  const credKey = effectiveCreds
    ? `${effectiveCreds.serverUrl}|${effectiveCreds.username}|${effectiveCreds.password}`
    : null

  // Focus no botão Close ao abrir
  useEffect(() => {
    const prev = tvFocusIdStore.get()
    tvFocusIdStore.set('acct-dlg-close')
    return () => {
      tvFocusIdStore.set(prev ?? '')
    }
  }, [])

  // Fechar com Escape / Back
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'GoBack' || (e as KeyboardEvent & { keyCode?: number }).keyCode === 10009) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Derivação de credenciais para M3U (3 tentativas em cascata)
  useEffect(() => {
    if (xtreamLikeSource) { setDerivedCreds(null); setCredLoadingMsg(null); return }
    if (!activePlaylist || activePlaylist.type !== 'm3u') {
      setDerivedCreds(null); setCredLoadingMsg(null); return
    }
    let cancelled = false
    void (async () => {
      const m3uUrl =
        activePlaylist.resolution?.kind === 'm3u' && activePlaylist.resolution.playlistUrl.trim()
          ? activePlaylist.resolution.playlistUrl.trim()
          : activePlaylist.m3u.url.trim()

      // Tentativa 1: cache IndexedDB (imediato)
      setCredLoadingMsg('Loading…')
      let creds = await tryDeriveXtreamCredentialsFromM3uCacheAsync(
        activePlaylist.id, m3uUrl, activePlaylist.name,
      )

      // Tentativa 2: download do M3U on-demand (primeira abertura ou cache expirado)
      if (!creds && !cancelled) {
        setCredLoadingMsg('Fetching playlist…')
        creds = await tryDeriveXtreamCredentialsFromM3uFetchAsync(m3uUrl, activePlaylist.name)
        // DEV fallback: Lambda pode falhar (Cloudflare 403); usar proxy inline do Vite.
        if (!creds && !cancelled && import.meta.env.DEV) {
          try {
            const devRes = await fetch(`/__iptv_dev/fetch?url=${encodeURIComponent(m3uUrl)}`, {
              method: 'GET', cache: 'no-store',
            })
            if (devRes.ok) {
              const { tryDeriveXtreamCredsFromM3uText } = await import('@/lib/playlistsStorage')
              const text = await devRes.text()
              creds = tryDeriveXtreamCredsFromM3uText(text, activePlaylist.name)
            }
          } catch { /* fallthrough */ }
        }
      }

      if (!cancelled) {
        setCredLoadingMsg(null)
        setDerivedCreds(creds)
      }
    })()
    return () => { cancelled = true }
  }, [xtreamLikeSource, activePlaylist])

  // Buscar snapshot
  useEffect(() => {
    setSnapshot(undefined)
    if (!credKey || !effectiveCreds) return
    let cancelled = false
    const creds = effectiveCreds
    void (async () => {
      const snap = await loadAccountSnapshot(creds)
      if (!cancelled) setSnapshot(snap)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credKey])

  const playlistType = activePlaylist?.type === 'xtream' ? 'Xtream' : 'M3U'
  const playlistName = activePlaylist?.name ?? '—'
  const serverUrl = effectiveCreds?.serverUrl ?? '—'

  return (
    <div className="acct-dialog__backdrop" data-tv-modal-open="1" onClick={onClose}>
      <div
        className="acct-dialog__card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Account Info"
      >
        {/* Header */}
        <div className="acct-dialog__header">
          <span className="acct-dialog__title">Account Info</span>
          <TVFocusable id="acct-dlg-close" className="acct-dialog__close-wrap">
            <button
              className="acct-dialog__close"
              data-tv-activate
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </TVFocusable>
        </div>

        {/* Body */}
        <div className="acct-dialog__body">
          {/* Playlist info (always available) */}
          <div className="acct-dialog__section">
            <div className="acct-dialog__section-title">Playlist</div>
            <InfoRow label="Name" value={playlistName} />
            <InfoRow label="Type" value={playlistType} />
            <InfoRow label="Server" value={serverUrl} />
          </div>

          {/* Account info (Xtream) */}
          <div className="acct-dialog__section">
            <div className="acct-dialog__section-title">Account</div>
            {credLoadingMsg ? (
              <div className="acct-dialog__loading">
                <span className="acct-dialog__spinner" />
                {credLoadingMsg}
              </div>
            ) : !effectiveCreds ? (
              <div className="acct-dialog__no-xtream">
                No Xtream credentials found for this playlist.<br />
                Only playlists using the Xtream protocol show account info.
              </div>
            ) : snapshot === undefined ? (
              <div className="acct-dialog__loading">
                <span className="acct-dialog__spinner" />
                Loading account data…
              </div>
            ) : snapshot === null ? (
              <div className="acct-dialog__error">
                Could not reach the Xtream panel.<br />
                Check your network or proxy settings.
              </div>
            ) : !snapshot.authenticated ? (
              <div className="acct-dialog__error">
                Authentication failed — check credentials.
              </div>
            ) : (
              <>
                <InfoRow label="Username" value={snapshot.username ?? effectiveCreds.username} />
                <InfoRow label="Status" value={snapshot.status || '—'} />
                <InfoRow label="Expires" value={formatExpiry(snapshot)} accent />
                <InfoRow label="Connections" value={formatConnections(snapshot)} />
                {snapshot.isTrial === '1' && (
                  <InfoRow label="Trial" value="Yes" />
                )}
                {snapshot.serverProtocol && (
                  <InfoRow label="Protocol" value={snapshot.serverProtocol} />
                )}
                {snapshot.serverPort && (
                  <InfoRow label="Port" value={snapshot.serverPort} />
                )}
                {snapshot.serverTimezone && (
                  <InfoRow label="Timezone" value={snapshot.serverTimezone} />
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="acct-dialog__footer">
          <TVFocusable id="acct-dlg-close-btn" className="acct-dialog__btn-wrap">
            <button className="acct-dialog__btn" data-tv-activate onClick={onClose}>
              Close
            </button>
          </TVFocusable>
        </div>
      </div>
    </div>
  )
}
