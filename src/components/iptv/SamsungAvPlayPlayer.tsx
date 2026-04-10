import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import type { LiveStreamPlaybackStatus } from '@/lib/liveStreamPlaybackTypes';
import type { SamsungAvPlayPlaybackApi } from '@/lib/samsungAvPlayPlaybackApi';
import { samsungAvPlayLog } from '@/lib/samsungAvPlayLog';
import { getAvplayDisplayRectFromElement } from '@/lib/samsungAvPlayDisplayRect';
import { cn } from '@/lib/utils';

type AvPlayListener = {
  onbufferingstart?: () => void;
  onbufferingcomplete?: () => void;
  onstreamcompleted?: () => void;
  oncurrentplaytime?: (ms: number) => void;
  onerror?: (eventType: unknown) => void;
};

type AvPlayInstance = {
  open: (url: string) => void;
  close: () => void;
  stop?: () => void;
  play: () => void;
  pause: () => void;
  prepareAsync: (success: () => void, error: (err: unknown) => void) => void;
  setDisplayRect: (x: number, y: number, w: number, h: number) => void;
  setDisplayType?: (type: string) => void;
  setDisplayMethod?: (method: string) => void;
  setListener: (listener: AvPlayListener) => void;
  getDuration?: () => number;
  seekTo?: (ms: number) => void;
  setMute?: (mute: boolean) => void;
};

declare global {
  interface Window {
    webapis?: {
      avplay?: AvPlayInstance;
    };
  }
}

export type SamsungAvPlayPlayerProps = {
  src: string;
  className?: string;
  autoplay?: boolean;
  muted?: boolean;
  /** Seconds — applied after prepare, before play (VOD resume). */
  initialPositionSec?: number;
  onReady?: () => void;
  onError?: (message: string) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onPlaybackApi?: (api: SamsungAvPlayPlaybackApi | null) => void;
  onPlaybackStatus?: (status: LiveStreamPlaybackStatus) => void;
  /** Shown when `status === 'error'` (ex.: retry stream). */
  onRetry?: () => void;
};

function getAvPlay(): AvPlayInstance | null {
  const av = typeof window !== 'undefined' ? window.webapis?.avplay : undefined;
  return av ?? null;
}

function applyDisplayRect(av: AvPlayInstance, el: HTMLDivElement | null): void {
  if (!el) return;
  const { x, y, width: w, height: h } = getAvplayDisplayRectFromElement(el);
  samsungAvPlayLog('setDisplayRect', { x, y, w, h });
  try {
    av.setDisplayRect(x, y, w, h);
  } catch (e) {
    samsungAvPlayLog('setDisplayRect error', e);
  }
}

const SamsungAvPlayPlayer: React.FC<SamsungAvPlayPlayerProps> = ({
  src,
  className,
  autoplay = true,
  muted = false,
  initialPositionSec,
  onReady,
  onError,
  onPlay,
  onPause,
  onEnded,
  onPlaybackApi,
  onPlaybackStatus,
  onRetry,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const avRef = useRef<AvPlayInstance | null>(null);
  const currentTimeMsRef = useRef(0);
  const durationMsRef = useRef(0);
  const pausedRef = useRef(false);
  const endedRef = useRef(false);
  const reloadTokenRef = useRef(0);

  const [status, setStatus] = useState<LiveStreamPlaybackStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onPlaybackStatusRef = useRef(onPlaybackStatus);
  const onPlaybackApiRef = useRef(onPlaybackApi);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause);
  const onEndedRef = useRef(onEnded);

  useEffect(() => {
    onPlaybackStatusRef.current = onPlaybackStatus;
  }, [onPlaybackStatus]);

  useEffect(() => {
    onPlaybackApiRef.current = onPlaybackApi;
  }, [onPlaybackApi]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onPlayRef.current = onPlay;
  }, [onPlay]);

  useEffect(() => {
    onPauseRef.current = onPause;
  }, [onPause]);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    onPlaybackStatusRef.current?.(status);
  }, [status]);

  const pushPlaybackApi = useCallback(() => {
    const av = avRef.current;
    if (!av) {
      onPlaybackApiRef.current?.(null);
      return;
    }
    const api: SamsungAvPlayPlaybackApi = {
      getCurrentTimeSec: () => currentTimeMsRef.current / 1000,
      getDurationSec: () => {
        if (typeof av.getDuration === 'function') {
          const d = av.getDuration();
          if (Number.isFinite(d) && d > 0) return d / 1000;
        }
        return durationMsRef.current / 1000;
      },
      seekToSec: sec => {
        if (!avRef.current) return;
        endedRef.current = false;
        const ms = Math.max(0, Math.floor(sec * 1000));
        samsungAvPlayLog('seekToSec', sec);
        try {
          avRef.current.seekTo?.(ms);
        } catch (e) {
          samsungAvPlayLog('seekTo error', e);
        }
      },
      play: () => {
        if (!avRef.current) return;
        endedRef.current = false;
        pausedRef.current = false;
        samsungAvPlayLog('api play');
        try {
          avRef.current.play();
          onPlayRef.current?.();
        } catch (e) {
          samsungAvPlayLog('play error', e);
        }
      },
      pause: () => {
        if (!avRef.current) return;
        pausedRef.current = true;
        samsungAvPlayLog('api pause');
        try {
          avRef.current.pause();
          onPauseRef.current?.();
        } catch (e) {
          samsungAvPlayLog('pause error', e);
        }
      },
      isPaused: () => pausedRef.current,
      isEnded: () => endedRef.current,
    };
    onPlaybackApiRef.current?.(api);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- player state mirrors AVPlay lifecycle callbacks and source changes */
  useEffect(() => {
    const container = containerRef.current;
    if (!src?.trim()) {
      setStatus('error');
      setErrorMessage('No stream URL.');
      samsungAvPlayLog('abort: empty src');
      onPlaybackApiRef.current?.(null);
      return;
    }

    const av = getAvPlay();
    if (!av) {
      const msg = 'AVPlay indisponível (webapis.avplay não encontrado).';
      samsungAvPlayLog('AVPlay indisponível');
      setStatus('error');
      setErrorMessage(msg);
      onErrorRef.current?.(msg);
      onPlaybackApiRef.current?.(null);
      return;
    }

    avRef.current = av;
    endedRef.current = false;
    pausedRef.current = false;
    currentTimeMsRef.current = 0;
    durationMsRef.current = 0;
    setErrorMessage(null);
    setStatus('loading');
    samsungAvPlayLog('init');
    samsungAvPlayLog('open', src);

    const runId = ++reloadTokenRef.current;

    const safeClose = () => {
      const player = avRef.current;
      if (!player) return;
      try {
        player.stop?.();
      } catch {
        /* ignore */
      }
      try {
        player.close();
      } catch {
        /* ignore */
      }
      samsungAvPlayLog('cleanup close');
    };

    try {
      av.open(src);
      try {
        av.setDisplayMethod?.('PLAYER_DISPLAY_MODE_LETTER_BOX');
      } catch {
        /* ignore */
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      samsungAvPlayLog('open error', msg);
      setStatus('error');
      setErrorMessage(`Open failed: ${msg}`);
      onErrorRef.current?.(msg);
      onPlaybackApiRef.current?.(null);
      return;
    }

    applyDisplayRect(av, container);

    av.setListener({
      onbufferingstart: () => {
        setStatus(s => (s === 'playing' ? 'buffering' : s));
      },
      onbufferingcomplete: () => {
        setStatus('playing');
        if (avRef.current) applyDisplayRect(avRef.current, container);
      },
      oncurrentplaytime: ms => {
        if (typeof ms === 'number' && Number.isFinite(ms)) {
          currentTimeMsRef.current = ms;
        }
      },
      onstreamcompleted: () => {
        samsungAvPlayLog('stream completed');
        endedRef.current = true;
        pausedRef.current = true;
        setStatus('playing');
        onEndedRef.current?.();
      },
      onerror: ev => {
        samsungAvPlayLog('error', ev);
        const detail = typeof ev === 'object' && ev !== null ? JSON.stringify(ev) : String(ev);
        setStatus('error');
        setErrorMessage(`AVPlay error: ${detail}`);
        onErrorRef.current?.(detail);
      },
    });

    const ro =
      typeof ResizeObserver !== 'undefined' && container
        ? new ResizeObserver(() => {
            if (avRef.current) applyDisplayRect(avRef.current, container);
          })
        : null;
    if (container && ro) ro.observe(container);

    av.prepareAsync(
      () => {
        if (runId !== reloadTokenRef.current) return;
        samsungAvPlayLog('prepareAsync ok');
        if (typeof av.getDuration === 'function') {
          try {
            const d = av.getDuration();
            if (Number.isFinite(d) && d > 0) durationMsRef.current = d;
          } catch {
            /* ignore */
          }
        }
        try {
          if (typeof av.setMute === 'function') av.setMute(muted);
        } catch {
          /* ignore */
        }

        const resumeMs =
          initialPositionSec != null &&
          Number.isFinite(initialPositionSec) &&
          initialPositionSec >= 1
            ? Math.floor(initialPositionSec * 1000)
            : null;
        if (resumeMs != null) {
          samsungAvPlayLog('initial seek ms', resumeMs);
          try {
            av.seekTo?.(resumeMs);
            currentTimeMsRef.current = resumeMs;
          } catch (e) {
            samsungAvPlayLog('initial seek error', e);
          }
        }

        pushPlaybackApi();
        onReadyRef.current?.();

        if (autoplay) {
          try {
            av.play();
            pausedRef.current = false;
            samsungAvPlayLog('play');
            setStatus('playing');
            onPlayRef.current?.();
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            samsungAvPlayLog('play error after prepare', msg);
            setStatus('error');
            setErrorMessage(msg);
            onErrorRef.current?.(msg);
          }
        } else {
          pausedRef.current = true;
          setStatus('playing');
        }
      },
      err => {
        samsungAvPlayLog('prepareAsync error', err);
        const msg = err instanceof Error ? err.message : String(err);
        setStatus('error');
        setErrorMessage(`Prepare failed: ${msg}`);
        onErrorRef.current?.(msg);
        onPlaybackApiRef.current?.(null);
      }
    );

    return () => {
      reloadTokenRef.current += 1;
      if (ro && container) ro.disconnect();
      safeClose();
      avRef.current = null;
      onPlaybackApiRef.current?.(null);
      samsungAvPlayLog('unmount cleanup');
    };
  }, [src, autoplay, muted, initialPositionSec, pushPlaybackApi]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const unavailable = !getAvPlay() && typeof window !== 'undefined';

  return (
    <div ref={containerRef} className={cn('relative h-full w-full bg-black', className)}>
      {/* Sem <video>: AVPlay desenha no retângulo definido por setDisplayRect. */}
      <div
        className="h-full w-full bg-black"
        aria-hidden
        data-samsung-avplay-surface
      />

      {unavailable && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-4">
          <div className="flex max-w-[92%] flex-col items-center gap-3 rounded-xl border border-border/40 bg-black/70 px-4 py-3 text-center text-white">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <p className="text-sm font-medium">
              {errorMessage ?? 'AVPlay não está disponível neste ambiente.'}
            </p>
          </div>
        </div>
      )}

      {!unavailable && status !== 'playing' && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-black/55',
            status === 'error' ? 'pointer-events-auto' : 'pointer-events-none'
          )}
        >
          <div className="flex max-w-[92%] flex-col items-center gap-3 rounded-xl border border-border/40 bg-black/70 px-4 py-3 text-center text-white">
            {(status === 'loading' || status === 'buffering' || status === 'reconnecting') && (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            )}
            {status === 'error' && <AlertTriangle className="h-6 w-6 text-destructive" />}
            <p className="text-sm font-medium">
              {status === 'loading' && 'A preparar stream (AVPlay)…'}
              {status === 'buffering' && 'A bufferizar…'}
              {status === 'reconnecting' && 'A reconectar…'}
              {status === 'error' && (errorMessage ?? 'Playback falhou.')}
            </p>
            {status === 'error' && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-lg bg-primary/80 px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SamsungAvPlayPlayer;
