import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { resolvePlaybackUrl } from '@/lib/hlsDevProxy'
import { normalizeLiveStreamUrl } from '@/utils/normalizeLiveStreamUrl'
import { isAutoplayPolicyError } from '../autoplayPolicy'
import {
  createPlaybackEngine,
  resolvePreferredPlaybackEngineKind,
} from '../engines/playbackEngine'
import type { PlaybackEngine, PlayerControllerState } from '../types/player'
import type { PlaybackEngineKind } from '../types/player'
import { playerSession } from '../services/playerSession'

type UsePlayerControllerOptions = {
  containerRef: RefObject<HTMLElement | null>
  streamUrl: string | null
  title?: string
  contentRef?: string
  autoPlay?: boolean
  preferredEngine?: PlaybackEngineKind | null
  startMuted?: boolean
}

const PROGRESSIVE_VIDEO = /\.(mp4|mkv|avi|mov|webm|wmv)(\?|#|$)/i

function resolvePlayerStreamUrl(streamUrl: string): string {
  const trimmed = streamUrl.trim()
  if (!trimmed) return trimmed
  const pathOnly = (trimmed.split('?')[0] ?? '').toLowerCase()
  if (PROGRESSIVE_VIDEO.test(pathOnly)) {
    return resolvePlaybackUrl(trimmed)
  }
  return normalizeLiveStreamUrl(trimmed)
}

/**
 * Orquestra lifecycle do motor (AVPlay vs HTML5), sem acoplar à UI concreta.
 */
export function usePlayerController({
  containerRef,
  streamUrl,
  title,
  contentRef,
  autoPlay = true,
  preferredEngine = null,
  startMuted = false,
}: UsePlayerControllerOptions) {
  const engineRef = useRef<PlaybackEngine | null>(null)
  const kind = useMemo(
    () => resolvePreferredPlaybackEngineKind(preferredEngine),
    [preferredEngine],
  )

  const [state, setState] = useState<PlayerControllerState>(() => ({
    engineKind: kind,
    isPlaying: false,
    isBuffering: false,
    error: null,
    durationMs: null,
    currentTimeMs: null,
  }))

  const bindHtml5Events = useCallback((video: HTMLVideoElement) => {
    const onPlay = () =>
      setState((s) => ({ ...s, isPlaying: true, error: null }))
    const onPause = () => setState((s) => ({ ...s, isPlaying: false }))
    const onWaiting = () => setState((s) => ({ ...s, isBuffering: true }))
    const onPlaying = () => setState((s) => ({ ...s, isBuffering: false }))
    const onTime = () =>
      setState((s) => ({
        ...s,
        currentTimeMs: video.currentTime * 1000,
        durationMs: Number.isFinite(video.duration) ? video.duration * 1000 : s.durationMs,
      }))
    const onDuration = () =>
      setState((s) => ({
        ...s,
        durationMs: Number.isFinite(video.duration) ? video.duration * 1000 : null,
      }))
    const onError = () => {
      const err = video.error
      const msg =
        err && err.message
          ? err.message
          : 'Erro de reprodução (HTML5).'
      setState((s) => ({ ...s, error: msg, isPlaying: false }))
    }

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('durationchange', onDuration)
    video.addEventListener('loadedmetadata', onDuration)
    video.addEventListener('error', onError)

    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('durationchange', onDuration)
      video.removeEventListener('loadedmetadata', onDuration)
      video.removeEventListener('error', onError)
    }
  }, [])

  /* Estado sincroniza com motor AVPlay/HTML5 (recursos externos). */
  /* eslint-disable react-hooks/set-state-in-effect -- lifecycle do motor */
  useLayoutEffect(() => {
    if (!streamUrl) {
      return
    }

    const container = containerRef.current
    if (!container) {
      return
    }

    const engine = createPlaybackEngine(kind)
    engineRef.current = engine
    engine.attachDisplay(container)

    try {
      engine.init()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setState((s) => ({ ...s, error: msg }))
      return
    }

    const playbackUrl = resolvePlayerStreamUrl(streamUrl)
    playerSession.begin({ streamUrl: playbackUrl, title, contentRef })

    let removeHtml5Listeners: (() => void) | undefined
    if (kind === 'html5') {
      const video = container.querySelector('video')
      if (video) {
        if (startMuted) {
          video.muted = true
          video.defaultMuted = true
          video.volume = 0
        }
        removeHtml5Listeners = bindHtml5Events(video)
      }
    }

    setState((s) => ({
      ...s,
      engineKind: kind,
      error: null,
      isPlaying: false,
      isBuffering: true,
    }))

    try {
      engine.open(playbackUrl)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setState((s) => ({ ...s, error: msg }))
      void engine.destroy()
      engineRef.current = null
      playerSession.end()
      return
    }

    if (autoPlay) {
      void Promise.resolve(engine.play())
        .then(() => {
          setState((s) => ({
            ...s,
            isPlaying: true,
            isBuffering: false,
            error: null,
          }))
        })
        .catch((e: unknown) => {
          if (isAutoplayPolicyError(e)) {
            setState((s) => ({
              ...s,
              error: null,
              isPlaying: false,
              isBuffering: false,
            }))
            return
          }
          const msg = e instanceof Error ? e.message : String(e)
          setState((s) => ({
            ...s,
            error: msg,
            isPlaying: false,
            isBuffering: false,
          }))
        })
    } else {
      setState((s) => ({ ...s, isBuffering: false }))
    }

    return () => {
      removeHtml5Listeners?.()
      void engine.destroy()
      engineRef.current = null
      playerSession.end()
    }
  }, [streamUrl, kind, autoPlay, title, contentRef, containerRef, bindHtml5Events, startMuted])
  /* eslint-enable react-hooks/set-state-in-effect */

  const displayError = !streamUrl ? 'URL em falta.' : state.error

  const play = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    void Promise.resolve(engine.play())
      .then(() => setState((s) => ({ ...s, isPlaying: true, error: null })))
      .catch((e: unknown) => {
        if (isAutoplayPolicyError(e)) {
          setState((s) => ({ ...s, error: null }))
          return
        }
        const msg = e instanceof Error ? e.message : String(e)
        setState((s) => ({ ...s, error: msg }))
      })
  }, [])

  const pause = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    void Promise.resolve(engine.pause()).catch(() => {})
    setState((s) => ({ ...s, isPlaying: false }))
  }, [])

  const toggle = useCallback(() => {
    if (state.isPlaying) pause()
    else play()
  }, [state.isPlaying, pause, play])

  const stop = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    void Promise.resolve(engine.stop()).catch(() => {})
    setState((s) => ({ ...s, isPlaying: false }))
  }, [])

  const enterFullscreenDisplay = useCallback(() => {
    engineRef.current?.enterFullscreenDisplay()
  }, [])

  const exitFullscreenDisplay = useCallback(() => {
    engineRef.current?.exitFullscreenDisplay()
  }, [])

  return {
    ...state,
    error: displayError,
    play,
    pause,
    toggle,
    stop,
    enterFullscreenDisplay,
    exitFullscreenDisplay,
    engineKind: kind,
  }
}
