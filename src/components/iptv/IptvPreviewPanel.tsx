import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Star, Calendar, Play, Pause, Clock, StepBack, StepForward } from 'lucide-react'
import { TVFocusable } from '@/lib/tvFocus/TVFocusable'
import { HybridLiveStreamPreview } from './HybridLiveStreamPreview'
import { IptvEpgGuideInline } from './IptvEpgGuideInline'
import { type IptvChannelRow } from './IptvChannelList'
import { IptvRemoteImage } from './IptvRemoteImage'
import { cn } from '@/lib/cn'
import { epgProgressPercent, formatEpgRange, type XtreamShortEpgEntry } from '@/features/iptv/epgDisplay'

/** D-pad: 0 = vídeo; 1 = Favorite; 2 = EPG. */
export const PREVIEW_FOCUS_VIDEO = 0;
export const PREVIEW_FOCUS_FAVORITE = 1;
export const PREVIEW_FOCUS_EPG = 2;

interface IptvPreviewPanelProps {
  selectedChannel: number
  previewChannelOverride?: IptvChannelRow | null
  channels?: IptvChannelRow[]
  /** Xtream HLS URL for the selected channel (Live TV). When set, video plays in the preview frame. */
  streamUrl?: string | null
  fullscreenRequestId?: number
  favoriteActive?: boolean
  onFavoriteToggle?: () => void
  previewFocusIndex?: number
  previewDpadActive?: boolean
  epgCurrent?: XtreamShortEpgEntry | null
  epgNext?: XtreamShortEpgEntry | null
  epgLoading?: boolean
  epgListings?: XtreamShortEpgEntry[]
  fullscreenControls?: {
    onPrevChannel: () => void
    onNextChannel: () => void
    onTogglePause: () => void
  }
}

export type PreviewPanelHandle = {
  openEpgModal: () => void;
  /** Fecha o guia EPG se estiver aberto; `true` se consumiu. */
  closeEpgGuideIfOpen: () => boolean;
  /** Guia EPG aberto: ↑↓ navegam na lista; `true` se a tecla foi tratada aqui. */
  consumeEpgListKey: (e: KeyboardEvent) => boolean;
};

const previewSlotRing = (active: boolean) =>
  active ? 'ring-2 ring-inset ring-primary/60 z-[1]' : '';

/** Tempo com overlay visível antes do fade-out (mesma sessão fullscreen). */
const FULLSCREEN_HUD_AUTO_HIDE_MS = 3_000;

/** Foco no vídeo: o `ring` no wrapper fica atrás do `<video>`; esta camada fica por cima. */
function VideoFocusOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[15] rounded-2xl ring-2 ring-inset ring-primary shadow-[0_0_20px_rgba(34,211,238,0.35)]"
      aria-hidden
    />
  );
}

export const IptvPreviewPanel = forwardRef<PreviewPanelHandle, IptvPreviewPanelProps>(function IptvPreviewPanel(
  {
    selectedChannel,
    previewChannelOverride,
    channels,
    streamUrl,
    fullscreenRequestId = 0,
    favoriteActive = false,
    onFavoriteToggle,
    previewFocusIndex = PREVIEW_FOCUS_VIDEO,
    previewDpadActive = false,
    epgCurrent = null,
    epgNext = null,
    epgLoading = false,
    epgListings = [],
    fullscreenControls,
  },
  ref
) {
  const list = channels ?? [];
  const dpadFocus = previewDpadActive ? previewFocusIndex : -1;
  const channel = previewChannelOverride ?? list[selectedChannel] ?? list[0];
  const [epgModalOpen, setEpgModalOpen] = useState(false);
  const [epgListFocusIndex, setEpgListFocusIndex] = useState(0);
  const epgGuideOpenRef = useRef(false);
  const lastHandledFullscreenRequestId = useRef(0);

  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [fullscreenFocusIndex, setFullscreenFocusIndex] = useState<0 | 1 | 2>(1);
  const fullscreenFocusIndexRef = useRef(fullscreenFocusIndex);
  const lastFullscreenActiveRef = useRef(false);

  const [fullscreenHudVisible, setFullscreenHudVisible] = useState(true);
  const fullscreenHudHideTimerRef = useRef<number | null>(null);

  const scheduleFullscreenHudHide = useCallback(() => {
    if (fullscreenHudHideTimerRef.current != null) {
      window.clearTimeout(fullscreenHudHideTimerRef.current);
    }
    fullscreenHudHideTimerRef.current = window.setTimeout(() => {
      setFullscreenHudVisible(false);
      fullscreenHudHideTimerRef.current = null;
    }, FULLSCREEN_HUD_AUTO_HIDE_MS);
  }, []);

  const wakeFullscreenHud = useCallback(() => {
    setFullscreenHudVisible(true);
    scheduleFullscreenHudHide();
  }, [scheduleFullscreenHudHide]);

  /* eslint-disable react-hooks/set-state-in-effect -- preview HUD/modal state mirrors fullscreen and EPG session events */
  useEffect(() => {
    if (!isVideoFullscreen) {
      if (fullscreenHudHideTimerRef.current != null) {
        window.clearTimeout(fullscreenHudHideTimerRef.current);
        fullscreenHudHideTimerRef.current = null;
      }
      setFullscreenHudVisible(false);
      return;
    }
    wakeFullscreenHud();
  }, [isVideoFullscreen, wakeFullscreenHud]);

  /** Atualiza barra de progresso do programa em fullscreen. */
  const [fullscreenNowSec, setFullscreenNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!isVideoFullscreen) return;
    const tick = () => setFullscreenNowSec(Math.floor(Date.now() / 1000));
    tick();
    const id = window.setInterval(tick, 5_000);
    return () => window.clearInterval(id);
  }, [isVideoFullscreen]);

  const sortedEpg = useMemo(
    () => [...epgListings].sort((a, b) => a.startSec - b.startSec),
    [epgListings]
  );
  const sortedEpgLenRef = useRef(0);

  useEffect(() => {
    epgGuideOpenRef.current = epgModalOpen;
  }, [epgModalOpen]);

  useEffect(() => {
    fullscreenFocusIndexRef.current = fullscreenFocusIndex;
  }, [fullscreenFocusIndex]);

  useEffect(() => {
    sortedEpgLenRef.current = sortedEpg.length;
  }, [sortedEpg.length]);

  useEffect(() => {
    if (epgModalOpen) setEpgListFocusIndex(0);
  }, [epgModalOpen]);

  useEffect(() => {
    if (!epgModalOpen) return;
    setEpgListFocusIndex(i => Math.min(i, Math.max(0, sortedEpg.length - 1)));
  }, [epgModalOpen, sortedEpg.length]);

  useEffect(() => {
    const getFullscreenElement = (): Element | null =>
      document.fullscreenElement ??
      (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement ??
      null;

    const sync = () => {
      const videoEl = document.getElementById('iptv-live-preview-video') as HTMLVideoElement | null;
      const fullscreenEl = getFullscreenElement();
      const rootEl = document.getElementById(
        'iptv-live-preview-fullscreen-root'
      ) as HTMLElement | null;
      /**
       * Só o subárvore de `fullscreenElement` é pintada em fullscreen.
       * - Wrapper: `fs === root` ou `root.contains(fs)`.
       * - Só o `<video>`: `fs === video` — HTML fora do vídeo some; usamos portal no `body` (camada sobre o vídeo em alguns engines) ou o overlay dentro do root não aparece; tratamos com portal.
       */
      const active =
        !!fullscreenEl &&
        !!rootEl &&
        !!videoEl &&
        (fullscreenEl === rootEl ||
          rootEl.contains(fullscreenEl) ||
          fullscreenEl === videoEl ||
          (fullscreenEl instanceof HTMLElement && fullscreenEl.contains(videoEl)));
      const prev = lastFullscreenActiveRef.current;
      if (active !== prev) {
        lastFullscreenActiveRef.current = active;
        setIsVideoFullscreen(active);
        if (active && videoEl) {
          setFullscreenFocusIndex(1);
          setIsPaused(Boolean(videoEl.paused));
        }
      } else if (active && videoEl) {
        // Keeps pause icon in sync when staying in fullscreen.
        setIsPaused(prevPaused => (prevPaused === videoEl.paused ? prevPaused : videoEl.paused));
      }
    };
    sync();
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync as EventListener);
    const id = window.setInterval(sync, 500);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync as EventListener);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!isVideoFullscreen) return;
    const videoEl = document.getElementById('iptv-live-preview-video') as HTMLVideoElement | null;
    if (!videoEl) return;
    const onPause = () => setIsPaused(true);
    const onPlay = () => setIsPaused(false);
    videoEl.addEventListener('pause', onPause);
    videoEl.addEventListener('play', onPlay);
    setIsPaused(videoEl.paused);
    return () => {
      videoEl.removeEventListener('pause', onPause);
      videoEl.removeEventListener('play', onPlay);
    };
  }, [isVideoFullscreen]);

  useEffect(() => {
    if (!isVideoFullscreen || !fullscreenControls) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isVideoFullscreen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        (e as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
        if (fullscreenHudVisible) {
          setFullscreenHudVisible(false);
          if (fullscreenHudHideTimerRef.current != null) {
            window.clearTimeout(fullscreenHudHideTimerRef.current);
            fullscreenHudHideTimerRef.current = null;
          }
          return;
        }
        void document.exitFullscreen?.().catch(() => {
          /* ignore */
        });
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Enter') {
        wakeFullscreenHud();
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        (e as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
        setFullscreenFocusIndex(prev => (prev > 0 ? ((prev - 1) as 0 | 1 | 2) : 0));
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        (e as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
        setFullscreenFocusIndex(prev => (prev < 2 ? ((prev + 1) as 0 | 1 | 2) : 2));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        (e as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
        const idx = fullscreenFocusIndexRef.current;
        if (idx === 0) fullscreenControls.onPrevChannel();
        else if (idx === 1) fullscreenControls.onTogglePause();
        else fullscreenControls.onNextChannel();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isVideoFullscreen, fullscreenControls, wakeFullscreenHud, fullscreenHudVisible]);

  useImperativeHandle(ref, () => ({
    openEpgModal: () => setEpgModalOpen(true),
    closeEpgGuideIfOpen: () => {
      if (!epgGuideOpenRef.current) return false;
      setEpgModalOpen(false);
      return true;
    },
    consumeEpgListKey: (e: KeyboardEvent) => {
      if (!epgGuideOpenRef.current) return false;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return false;
      const len = sortedEpgLenRef.current;
      if (len === 0) return false;
      e.preventDefault();
      e.stopPropagation();
      setEpgListFocusIndex(prev => {
        if (e.key === 'ArrowUp') return Math.max(0, prev - 1);
        return Math.min(len - 1, prev + 1);
      });
      return true;
    },
  }));

  useEffect(() => {
    setEpgModalOpen(false);
  }, [channel?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!epgModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const kc = (e as KeyboardEvent & { keyCode?: number }).keyCode;
      const back =
        e.key === 'Escape' ||
        e.key === 'GoBack' ||
        e.key === 'BrowserBack' ||
        kc === 461;
      if (back) {
        e.preventDefault();
        setEpgModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [epgModalOpen]);

  const requestPreviewFullscreen = () => {
    const root = document.getElementById(
      'iptv-live-preview-fullscreen-root'
    ) as HTMLElement & {
      webkitRequestFullscreen?: () => void;
    } | null;
    if (!root) return;
    const req =
      root.requestFullscreen?.bind(root) ??
      (typeof root.webkitRequestFullscreen === 'function'
        ? () => {
            root.webkitRequestFullscreen!();
            return Promise.resolve();
          }
        : null);
    if (req) void req().catch(() => {});
  };

  useEffect(() => {
    if (!streamUrl || fullscreenRequestId === 0) return;
    if (fullscreenRequestId === lastHandledFullscreenRequestId.current) return;
    lastHandledFullscreenRequestId.current = fullscreenRequestId;
    requestPreviewFullscreen();
  }, [fullscreenRequestId, streamUrl]);

  if (!channel) {
    return (
      <div className="flex flex-col h-full p-4 gap-4 items-center justify-center text-center text-muted-foreground text-sm">
        No channels to preview. Load a playlist or pick another category.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      {/* Date/Time */}
      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        <Clock className="w-3.5 h-3.5" />
        <span>{new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {/* Player Preview — live HLS; nunca coberto pelo guia EPG (guia fica na área rolável abaixo). */}
      <TVFocusable id="lpv-0" focusScale={false} className="relative w-full shrink-0">
      <div
        className={cn(
          'relative shrink-0 rounded-2xl overflow-hidden aspect-video glass-card border border-border/30 bg-black transition-shadow'
        )}
        id="iptv-live-preview-fullscreen-root"
        onDoubleClickCapture={e => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerDownCapture={e => {
          if (!isVideoFullscreen || !fullscreenControls) return;
          if (e.button !== 0) return;
          wakeFullscreenHud();
        }}
      >
        {streamUrl ? (
          <div className="absolute inset-0 z-0">
            <HybridLiveStreamPreview
              streamUrl={streamUrl}
              title={channel.name}
              channelId={channel.id}
              className="absolute inset-0 h-full w-full"
            />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-glow-pulse">
              <Play className="w-8 h-8 text-primary fill-primary/30 ml-1" />
            </div>
          </div>
        )}
        <VideoFocusOverlay show={dpadFocus === PREVIEW_FOCUS_VIDEO} />
        {/* Deve ficar DENTRO do mesmo nó que chama `requestFullscreen`, senão some no modo fullscreen. */}
        {isVideoFullscreen && fullscreenControls ? (
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 bottom-0 z-[999] flex justify-center px-3 pb-4 pt-16 transition-opacity duration-300 ease-out sm:px-6 sm:pb-6',
              fullscreenHudVisible ? 'opacity-100' : 'opacity-0'
            )}
            style={{
              background:
                'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.72) 45%, rgba(0,0,0,0.35) 72%, transparent 100%)',
            }}
            aria-hidden={!fullscreenHudVisible}
          >
            <div
              className={cn(
                'w-full max-w-4xl space-y-5',
                fullscreenHudVisible ? 'pointer-events-auto' : 'pointer-events-none'
              )}
            >
              <div className="flex gap-3 sm:gap-4">
                {channel.logo ? (
                  <IptvRemoteImage
                    src={channel.logo}
                    alt=""
                    className="h-11 w-auto max-h-11 max-w-[120px] shrink-0 object-contain object-left"
                    draggable={false}
                    fallback={
                      <div
                        className="flex h-11 max-w-[140px] shrink-0 items-center rounded-lg bg-white/10 px-3 text-left text-xs font-bold leading-tight text-white"
                        title={channel.name}
                      >
                        <span className="line-clamp-2">{channel.name}</span>
                      </div>
                    }
                  />
                ) : (
                  <div
                    className="flex h-11 max-w-[140px] shrink-0 items-center rounded-lg bg-white/10 px-3 text-left text-xs font-bold leading-tight text-white"
                    title={channel.name}
                  >
                    <span className="line-clamp-2">{channel.name}</span>
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm leading-snug text-white">
                      <span className="text-white/55">Now: </span>
                      <span className="font-semibold">
                        {epgLoading && !epgCurrent
                          ? 'Loading…'
                          : epgCurrent?.title?.trim() || 'No program information'}
                      </span>
                    </p>
                    {epgCurrent ? (
                      <span className="shrink-0 text-xs tabular-nums text-white/70">
                        {formatEpgRange(epgCurrent.startSec, epgCurrent.endSec)}
                      </span>
                    ) : null}
                  </div>
                  {epgCurrent ? (
                    <div
                      className="h-1 w-full overflow-hidden rounded-full bg-white/20"
                      role="progressbar"
                      aria-valuenow={epgProgressPercent(epgCurrent, fullscreenNowSec)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full rounded-full bg-amber-400 transition-[width] duration-500 ease-out"
                        style={{
                          width: `${epgProgressPercent(epgCurrent, fullscreenNowSec)}%`,
                        }}
                      />
                    </div>
                  ) : null}
                  <div className="flex items-start justify-between gap-3 pt-0.5">
                    <p className="min-w-0 text-sm leading-snug text-white/90">
                      <span className="text-white/55">Next: </span>
                      <span className="font-medium">
                        {epgLoading && !epgNext && !epgCurrent
                          ? '…'
                          : epgNext?.title?.trim() || '—'}
                      </span>
                    </p>
                    {epgNext ? (
                      <span className="shrink-0 text-xs tabular-nums text-white/70">
                        {formatEpgRange(epgNext.startSec, epgNext.endSec)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 sm:gap-6">
                <button
                  type="button"
                  onClick={fullscreenControls.onPrevChannel}
                  className={cn(
                    'flex items-center justify-center rounded-full p-3.5 text-white transition-all',
                    fullscreenFocusIndex === 0
                      ? 'bg-primary/45 shadow-[0_0_24px_rgba(34,211,238,0.35)] ring-2 ring-primary ring-offset-2 ring-offset-black/40'
                      : 'bg-white/12 hover:bg-white/18'
                  )}
                  aria-label="Previous channel"
                >
                  <StepBack className="h-6 w-6" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={fullscreenControls.onTogglePause}
                  className={cn(
                    'flex items-center justify-center rounded-full p-3.5 text-white transition-all',
                    fullscreenFocusIndex === 1
                      ? 'bg-primary/45 shadow-[0_0_24px_rgba(34,211,238,0.35)] ring-2 ring-primary ring-offset-2 ring-offset-black/40'
                      : 'bg-white/12 hover:bg-white/18'
                  )}
                  aria-label={isPaused ? 'Play' : 'Pause'}
                >
                  {isPaused ? (
                    <Play className="h-6 w-6" fill="currentColor" />
                  ) : (
                    <Pause className="h-6 w-6" strokeWidth={2} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={fullscreenControls.onNextChannel}
                  className={cn(
                    'flex items-center justify-center rounded-full p-3.5 text-white transition-all',
                    fullscreenFocusIndex === 2
                      ? 'bg-primary/45 shadow-[0_0_24px_rgba(34,211,238,0.35)] ring-2 ring-primary ring-offset-2 ring-offset-black/40'
                      : 'bg-white/12 hover:bg-white/18'
                  )}
                  aria-label="Next channel"
                >
                  <StepForward className="h-6 w-6" strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      </TVFocusable>

      {/* Abaixo do vídeo: resumo + botões + legenda; guia EPG em overlay cobre botões e legenda. */}
      <div className="relative flex min-h-0 flex-1 flex-col gap-3">
        {!epgModalOpen && (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-tv space-y-3 pr-0.5">
              {/* Channel Info */}
              <div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className="truncate text-[10px] leading-tight text-muted-foreground"
                    title={channel.category}
                  >
                    {channel.category}
                  </span>
                  <h2 className="font-display truncate text-lg font-bold text-foreground">{channel.name}</h2>
                </div>
                {epgLoading && !epgCurrent && !epgNext ? (
                  <p className="text-xs text-muted-foreground mt-1.5">Loading program guide…</p>
                ) : epgCurrent ? (
                  <>
                    <p className="text-sm font-semibold text-foreground mt-1.5 leading-snug">{epgCurrent.title}</p>
                    <p className="text-primary text-xs font-medium mt-1">
                      {formatEpgRange(epgCurrent.startSec, epgCurrent.endSec)}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {epgLoading ? 'Loading program guide…' : 'No program guide for this channel.'}
                  </p>
                )}
              </div>

              {/* Next */}
              <div className="glass-card rounded-xl p-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Up Next</span>
                {epgNext ? (
                  <>
                    <p className="text-sm text-foreground mt-1 font-medium leading-snug">{epgNext.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatEpgRange(epgNext.startSec, epgNext.endSec)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    {epgLoading ? '…' : 'No upcoming listings from the provider.'}
                  </p>
                )}
              </div>

              {/* Description */}
              {epgCurrent?.description?.trim() ? (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{epgCurrent.description.trim()}</p>
              ) : null}
            </div>

            {/* Actions — Favorite (1), EPG (2) — IDs Samsung lpv-1 / lpv-2 */}
            <div className="grid shrink-0 grid-cols-2 gap-2">
              <TVFocusable
                id="lpv-1"
                focusScale={false}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-medium text-muted-foreground transition-shadow glass-card',
                  previewSlotRing(dpadFocus === PREVIEW_FOCUS_FAVORITE),
                )}
              >
                <div
                  data-tv-activate
                  role="button"
                  className="flex w-full items-center justify-center gap-2"
                  onClick={() => onFavoriteToggle?.()}
                >
                  <Star className={cn('h-3.5 w-3.5', favoriteActive && 'fill-amber-400 text-amber-400')} />
                  <span>{favoriteActive ? 'Favorited' : 'Favorite'}</span>
                </div>
              </TVFocusable>
              <TVFocusable
                id="lpv-2"
                focusScale={false}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-medium text-muted-foreground transition-shadow glass-card',
                  previewSlotRing(dpadFocus === PREVIEW_FOCUS_EPG),
                )}
              >
                <div
                  data-tv-activate
                  role="button"
                  className="flex w-full items-center justify-center gap-2"
                  onClick={() => setEpgModalOpen((v) => !v)}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>EPG</span>
                </div>
              </TVFocusable>
            </div>

            {/* Legend */}
            <div className="flex shrink-0 items-center justify-center gap-6 border-t border-border/20 pt-2">
              {[
                { color: 'bg-destructive', label: 'Movies' },
                { color: 'bg-success', label: 'Series' },
                { color: 'bg-amber-400', label: 'Favorite' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={cn('w-2.5 h-2.5 rounded-sm', color)} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {epgModalOpen && (
          <div
            className="absolute inset-0 z-30 flex min-h-0 flex-col rounded-xl border border-border/40 bg-card/95 p-3 shadow-xl ring-1 ring-border/30 backdrop-blur-md"
            role="dialog"
            aria-label="Program guide"
          >
            <IptvEpgGuideInline
              channelName={channel.name}
              entries={sortedEpg}
              epgCurrent={epgCurrent}
              loading={epgLoading}
              focusedIndex={epgListFocusIndex}
            />
          </div>
        )}

      </div>
    </div>
  );
});
