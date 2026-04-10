import { useEffect, useMemo, useState } from 'react'
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

declare const __APP_VERSION__: string

function getPlaylistAccountHint(): string {
  return 'No account expiry data'
}

export function HomeStatusFooter() {
  const { playlists, activePlaylistId } = usePlaylists()
  // null = ainda não carregou / fetch falhou; undefined = a carregar
  const [accountSnapshot, setAccountSnapshot] = useState<XtreamAccountSnapshot | null | undefined>(undefined)
  // Credenciais derivadas assincronamente do cache M3U (shortlinks sem query params)
  const [derivedCreds, setDerivedCreds] = useState<XtreamCredentials | null>(null)

  const activePlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === activePlaylistId) ?? null,
    [activePlaylistId, playlists],
  )

  // Credenciais síncronas (Xtream direto ou M3U com username/password no URL)
  const xtreamLikeSource = shouldUseXtreamApiForActivePlaylist()
  // Credenciais síncronas — memoizadas por activePlaylistId (não por `playlists`, que é novo ref a cada render)
  const syncCreds = useMemo(
    () => (xtreamLikeSource ? getXtreamCredentialsForApp() : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [xtreamLikeSource, activePlaylistId],
  )
  // Credenciais efetivas: síncronas têm prioridade; fallback para derivadas do cache M3U
  const effectiveCreds = syncCreds ?? derivedCreds
  const hasXtreamCreds = Boolean(
    effectiveCreds?.serverUrl && effectiveCreds?.username && effectiveCreds?.password,
  )
  // Chave estável para as credenciais — evita que o useEffect dispare por mudança de referência do objeto
  const credKey = effectiveCreds
    ? `${effectiveCreds.serverUrl}|${effectiveCreds.username}|${effectiveCreds.password}`
    : null

  // Fallback assíncrono: extrair credenciais dos URLs de stream guardados em cache
  // (para playlists M3U com shortlinks que não têm credenciais no URL da playlist)
  useEffect(() => {
    if (xtreamLikeSource) {
      setDerivedCreds(null)
      return
    }
    if (!activePlaylist || activePlaylist.type !== 'm3u') {
      setDerivedCreds(null)
      return
    }
    let cancelled = false
    void (async () => {
      const m3uUrl =
        activePlaylist.resolution?.kind === 'm3u' && activePlaylist.resolution.playlistUrl.trim()
          ? activePlaylist.resolution.playlistUrl.trim()
          : activePlaylist.m3u.url.trim()

      // Tentativa 1: cache IndexedDB
      let creds = await tryDeriveXtreamCredentialsFromM3uCacheAsync(
        activePlaylist.id, m3uUrl, activePlaylist.name,
      )
      // Tentativa 2: download on-demand (cache vazio / primeira abertura)
      if (!creds && !cancelled) {
        creds = await tryDeriveXtreamCredentialsFromM3uFetchAsync(m3uUrl, activePlaylist.name)
      }
      if (cancelled) return
      setDerivedCreds(creds)
    })()
    return () => {
      cancelled = true
    }
  }, [xtreamLikeSource, activePlaylist])

  // Buscar snapshot da conta Xtream quando as credenciais mudam (usando credKey estável)
  useEffect(() => {
    setAccountSnapshot(undefined) // undefined = a carregar
    if (!credKey || !effectiveCreds) return
    let cancelled = false

    const creds = effectiveCreds // capturar para usar na closure
    void (async () => {
      // Tentativa 1: cadeia normal (proxy Vite / proxy.imagenio.io)
      let snap = await fetchXtreamAccountSnapshot(creds)

      // Tentativa 2: fetch directo ao provider (funciona em DEV HTTP→HTTP sem mixed content)
      // Cobre o caso em que o proxy falha mas o provider aceita CORS ou a page é HTTP
      if (snap === null && !cancelled) {
        try {
          const baseUrl = creds.serverUrl.replace(/\/+$/, '')
          const url = `${baseUrl}/player_api.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}`
          const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
          if (res.ok) {
            const json = await res.json() as Record<string, unknown>
            const userInfo = (json.user_info ?? {}) as Record<string, unknown>
            const auth = Number(userInfo.auth) === 1
            if (auth) {
              const expDate = userInfo.exp_date
              snap = {
                authenticated: true,
                status: String(userInfo.status ?? 'Active'),
                expDateRaw: expDate == null ? '' : String(expDate),
                username: String(userInfo.username ?? creds.username),
                activeCons: String(userInfo.active_cons ?? ''),
                maxConnections: String(userInfo.max_connections ?? ''),
              }
            } else {
              snap = { authenticated: false, status: String(userInfo.status ?? 'Unauthorized') }
            }
          }
        } catch {
          /* CORS ou rede — snap permanece null */
        }
      }

      if (cancelled) return
      setAccountSnapshot(snap) // null se ambas as tentativas falharam
    })()

    return () => {
      cancelled = true
    }
    // effectiveCreds capturado na closure; credKey é a dependência estável (string, comparação por valor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credKey])

  const playlistName = activePlaylist?.name?.trim() || 'No active playlist'
  const playlistExpires = (() => {
    if (!hasXtreamCreds) return '—'
    if (accountSnapshot === undefined) return '…'       // a carregar
    if (accountSnapshot === null) return '—'             // fetch falhou
    if (!accountSnapshot.authenticated) return '—'      // auth inválida
    const raw = accountSnapshot.expDateRaw
    if (!raw?.trim()) return 'Never'                    // conta sem expiração
    return formatXtreamExpDateDisplay(raw)
  })()
  const playlistHint = !activePlaylist
    ? 'No active playlist selected'
    : hasXtreamCreds
      ? accountSnapshot === undefined
        ? 'Xtream: loading…'
        : accountSnapshot === null
          ? 'Xtream: fetch failed'
          : accountSnapshot.authenticated === false
            ? 'Xtream authentication failed'
            : 'Xtream account connected'
      : 'M3U source connected'

  return (
    <footer className="home-status-footer">
      <div className="home-status-footer__left">
        <div className="home-status-footer__block">
          <span className="home-status-footer__label">Current Playlist: </span>
          <span className="home-status-footer__value">{playlistName}</span>
        </div>
        <div className="home-status-footer__block">
          <span className="home-status-footer__label">Expires: </span>
          <span className="home-status-footer__value">{playlistExpires}</span>
        </div>
      </div>
      <div className="home-status-footer__right">
        <span className="home-status-footer__hint" title={getPlaylistAccountHint()}>
          {playlistHint}
        </span>
        <span className="home-status-footer__ver">v{__APP_VERSION__}</span>
      </div>
    </footer>
  )
}
