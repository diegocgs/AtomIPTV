import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Film, Star } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { tryNavigateModalActionRow, tryNavigateModalActionTab } from '@/lib/modalActionNav'
import { cn } from '@/lib/utils'
import IptvRemoteImage from '@/components/iptv/IptvRemoteImage'

const VOD_DETAIL_IDS = {
  play: 'iptv-vod-detail-play',
  fav: 'iptv-vod-detail-fav',
  close: 'iptv-vod-detail-close',
} as const

export type VodDetailModalProps = {
  open: boolean
  onClose: () => void
  kind: 'movie' | 'series'
  title: string
  posterUrl?: string
  posterFallbackClass?: string
  rating: string
  year: number
  genre: string
  duration: string
  description: string
  onPlay: () => void
  onToggleFavorite?: () => void
  isFavorite?: boolean
  playLabel?: string
  playDisabled?: boolean
  /** Enquanto `get_vod_info` / híbrido carrega (Xtream). */
  descriptionLoading?: boolean
}

/**
 * Detalhe VOD alinhado a `nexus-vision-prime` / Lovable: Radix Dialog + mesma grelha poster/conteúdo.
 * Animações encurtadas (`duration-100`, zoom mínimo) para resposta rápida em TV.
 */
export default function VodDetailModal({
  open,
  onClose,
  kind,
  title,
  posterUrl,
  posterFallbackClass,
  rating,
  year,
  genre,
  duration,
  description,
  onPlay,
  onToggleFavorite,
  isFavorite = false,
  playLabel = 'Play',
  playDisabled = false,
  descriptionLoading = false,
}: VodDetailModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  const actionIds = useMemo(
    () =>
      [VOD_DETAIL_IDS.play, ...(onToggleFavorite ? [VOD_DETAIL_IDS.fav] : []), VOD_DETAIL_IDS.close],
    [onToggleFavorite],
  )

  /** useLayoutEffect: regista o listener na window antes do TvFocusProvider (efeito no pai) — Tab/←→ com stopImmediatePropagation antes do Radix FocusScope. */
  useLayoutEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const root =
        contentRef.current ??
        (document.querySelector('[data-tv-modal-open="1"]') as HTMLElement | null)
      if (tryNavigateModalActionTab(e, root, actionIds)) return
      tryNavigateModalActionRow(e, root, actionIds)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, actionIds])

  useEffect(() => {
    const onEscape = () => onClose()
    window.addEventListener('tv-modal-escape', onEscape)
    return () => window.removeEventListener('tv-modal-escape', onEscape)
  }, [onClose])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        ref={contentRef}
        data-tv-modal-open="1"
        closeButtonTabIndex={-1}
        onOpenAutoFocus={(ev) => {
          ev.preventDefault()
          // Foca o primeiro botão de ação não desabilitado de forma síncrona.
          // Usar rAF deixava o Radix focar o container (tabIndex=-1) como fallback,
          // o que deslocava a navegação inicial para o div do dialog em vez de um botão.
          const firstEnabled = actionIds
            .map((id) => document.getElementById(id))
            .find((el): el is HTMLElement => el instanceof HTMLElement && !el.hasAttribute('disabled'))
          firstEnabled?.focus({ preventScroll: true })
        }}
        className={cn(
          'max-h-[88vh] w-[min(100vw-1.5rem,56rem)] max-w-4xl gap-0 overflow-y-auto border border-primary/30 bg-card/95 p-6 shadow-2xl sm:rounded-2xl',
          '[&>button]:hidden',
          'text-left',
          '!duration-100 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100',
        )}
      >
        <DialogTitle className="sr-only">{title || 'Details'}</DialogTitle>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div
            className={cn(
              'mx-auto h-52 w-36 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br sm:mx-0 sm:h-44 sm:w-32',
              !posterUrl && (posterFallbackClass ?? 'from-red-950/80 to-stone-950'),
            )}
          >
            {posterUrl ? (
              <IptvRemoteImage
                src={posterUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                fallback={
                  <div className="flex h-full w-full items-center justify-center">
                    {kind === 'movie' ? (
                      <Film className="h-10 w-10 text-foreground/40" />
                    ) : (
                      <Film className="h-10 w-10 text-foreground/40" />
                    )}
                  </div>
                }
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Film className="h-10 w-10 text-foreground/40" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-bold text-foreground">{title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="font-semibold text-primary">★ {rating}</span>
              <span>{year}</span>
              {genre ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground/90">{genre}</span>
              ) : null}
              {duration ? <span>{duration}</span> : null}
            </div>
            {descriptionLoading && !description.trim() ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading description…</p>
            ) : description.trim() ? (
              <p className="mt-3 text-sm text-muted-foreground sm:line-clamp-6">{description}</p>
            ) : !descriptionLoading ? (
              <p className="mt-3 text-sm text-muted-foreground/80">No description from provider.</p>
            ) : null}
            <div
              className="mt-5 flex flex-wrap gap-3"
              data-vod-detail-action-row="1"
              role="toolbar"
              aria-label="Movie actions"
            >
              {/* Botões nativos <button>: Tab/Enter/Space funcionam sem JS extra.
                  Usa outline (não ring/box-shadow) para foco — outline nunca é cortado por overflow-y-auto do dialog. */}
              <button
                id={VOD_DETAIL_IDS.play}
                type="button"
                disabled={playDisabled}
                onClick={() => { if (!playDisabled) onPlay() }}
                className={cn(
                  'rounded-xl bg-primary px-5 py-2 font-display text-sm font-semibold text-primary-foreground',
                  'outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primary',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                ▶ {playLabel}
              </button>
              {onToggleFavorite ? (
                <button
                  id={VOD_DETAIL_IDS.fav}
                  type="button"
                  onClick={onToggleFavorite}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-5 py-2 font-display text-sm',
                    'outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primary',
                    isFavorite
                      ? 'glass-card border border-amber-400/25 text-muted-foreground'
                      : 'glass-card text-foreground',
                  )}
                >
                  <Star
                    className={cn(
                      'h-4 w-4 shrink-0',
                      isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground',
                    )}
                  />
                  {isFavorite ? 'Favorited' : 'Favorite'}
                </button>
              ) : null}
              <button
                id={VOD_DETAIL_IDS.close}
                type="button"
                onClick={onClose}
                className="rounded-xl glass-card px-5 py-2 font-display text-sm text-muted-foreground outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primary"
              >
                ✕ Close
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
