import { flushSync } from 'react-dom'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'
import { useTvFocus } from '@/lib/tvFocus'
import {
  isRemoteBackKey,
  isRemoteEnterKey,
  isSamsungTizenLikeRuntime,
  mapRemoteKeyToDirection,
} from '@/lib/tvFocus/tvRemoteKeys'

export type LiveTvNavPanel = 'categories' | 'channels' | 'preview'

const PREVIEW_FOCUS_VIDEO = 0
const PREVIEW_FOCUS_FAVORITE = 1
const PREVIEW_FOCUS_EPG = 2

function focusElementByFocusId(id: string): void {
  const el = document.getElementById(`focus-${id}`)
  if (el instanceof HTMLElement) el.focus({ preventScroll: true })
}

function focusHeaderFirstControl(): void {
  focusElementByFocusId('hdr-logo')
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return el.isContentEditable
}

type Params = {
  channelSearchRef: RefObject<HTMLInputElement | null>
  categorySearchRef?: RefObject<HTMLInputElement | null>
  channelSearch: string
  categoryCount: number
  channelCount: number
  activeCatIndex: number
  setActiveCatIndex: (i: number) => void
  playingChannelId: string | null
  setSelectedChannelId: (id: string | null) => void
  visibleChannelIds: string[]
  setLastChannelFocusId: (id: string) => void
  setLastCategoryFocusId: (id: string) => void
  onOpenPlayingChannel: () => void
  onToggleFavorite: () => void
  onOpenEpgPlaceholder: () => void
  /** Igual ao nexus: Enter na coluna categorias limpa a pesquisa de canais. */
  clearChannelSearch?: () => void
}

export type LiveTvNavigationState = {
  focusedChannelIndex: number
  focusedCategoryIndex: number
  activePanel: LiveTvNavPanel
  channelsNavFocus: 'search' | 'list'
  onCategorySearchFocus: () => void
  onChannelSearchFocus: () => void
}

/**
 * D-pad alinhado a `nexus-vision-prime/src/pages/LiveTV.tsx`:
 * coluna por defeito = canais; ←→ entre categorias | canais | preview;
 * no preview, ← no vídeo volta à lista; ↑ no 1.º canal → pesquisa.
 */
export function useLiveTvNavigation({
  channelSearchRef,
  categorySearchRef,
  channelSearch,
  categoryCount,
  channelCount,
  activeCatIndex,
  setActiveCatIndex,
  playingChannelId,
  setSelectedChannelId,
  visibleChannelIds,
  setLastChannelFocusId,
  setLastCategoryFocusId,
  onOpenPlayingChannel,
  onToggleFavorite,
  onOpenEpgPlaceholder,
  clearChannelSearch,
}: Params): LiveTvNavigationState {
  const { setFocusedId } = useTvFocus()
  const location = useLocation()
  const isLive = location.pathname === '/live'

  const [activePanel, setActivePanel] = useState<LiveTvNavPanel>('channels')
  const [channelsNavFocus, setChannelsNavFocus] = useState<'search' | 'list'>('list')
  const [previewFocusIndex, setPreviewFocusIndex] = useState(PREVIEW_FOCUS_VIDEO)
  /** Índices para UI (nexus: foco D-pad ≠ categoria seleccionada até Enter). */
  const [focusedChannelIndex, setFocusedChannelIndex] = useState(0)
  const [focusedCategoryIndex, setFocusedCategoryIndex] = useState(0)

  const activePanelRef = useRef(activePanel)
  const channelsNavFocusRef = useRef(channelsNavFocus)
  const previewFocusRef = useRef(previewFocusIndex)
  const channelSearchValueRef = useRef(channelSearch)
  const focusedChannelRef = useRef(0)
  const focusedCategoryRef = useRef(0)

  activePanelRef.current = activePanel
  channelsNavFocusRef.current = channelsNavFocus
  previewFocusRef.current = previewFocusIndex
  channelSearchValueRef.current = channelSearch

  useEffect(() => {
    setFocusedCategoryIndex(activeCatIndex)
    focusedCategoryRef.current = activeCatIndex
  }, [activeCatIndex])

  useEffect(() => {
    if (!isLive || channelCount === 0) return
    const idx =
      playingChannelId != null
        ? visibleChannelIds.findIndex((id) => id === playingChannelId)
        : -1
    const start = idx >= 0 ? idx : 0
    const row = Math.min(start, channelCount - 1)
    focusedChannelRef.current = row
    setFocusedChannelIndex(row)
    const id = `lch-${row}`
    setFocusedId(id)
    setLastChannelFocusId(id)
  }, [
    isLive,
    channelCount,
    playingChannelId,
    visibleChannelIds,
    setFocusedId,
    setLastChannelFocusId,
  ])

  useEffect(() => {
    if (!isLive || channelCount === 0) return
    if (focusedChannelRef.current > channelCount - 1) {
      const next = channelCount - 1
      focusedChannelRef.current = next
      setFocusedChannelIndex(next)
      const id = `lch-${next}`
      setFocusedId(id)
      setLastChannelFocusId(id)
    }
  }, [isLive, channelCount, setFocusedId, setLastChannelFocusId])

  useEffect(() => {
    channelSearchValueRef.current = channelSearch
  }, [channelSearch])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isLive) return

      const panel = activePanelRef.current
      const chCount = channelCount
      const ae = document.activeElement
      const inHeader = ae instanceof HTMLElement && Boolean(ae.closest('header'))

      const dir = mapRemoteKeyToDirection(e)
      const keyUp = dir === 'up'
      const keyDown = dir === 'down'
      const keyLeft = dir === 'left'
      const keyRight = dir === 'right'

      if (inHeader && keyDown) {
        e.preventDefault()
        e.stopPropagation()
        flushSync(() => {
          setActivePanel('categories')
          setChannelsNavFocus('list')
        })
        const catIdx = Math.min(activeCatIndex, Math.max(0, categoryCount - 1))
        focusedCategoryRef.current = catIdx
        setFocusedCategoryIndex(catIdx)
        window.setTimeout(() => {
          if (categoryCount > 0) {
            const id = `lcat-${catIdx}`
            focusElementByFocusId(id)
            setFocusedId(id)
            setLastCategoryFocusId(id)
          }
        }, 0)
        return
      }

      if (
        keyDown &&
        panel === 'categories' &&
        document.activeElement === categorySearchRef?.current
      ) {
        e.preventDefault()
        e.stopPropagation()
        const catCount = categoryCount
        if (catCount > 0) {
          focusedCategoryRef.current = 0
          setFocusedCategoryIndex(0)
          const id = 'lcat-0'
          setFocusedId(id)
          setLastCategoryFocusId(id)
          window.setTimeout(() => {
            categorySearchRef?.current?.blur()
            focusElementByFocusId(id)
          }, 0)
        }
        return
      }

      if (
        keyDown &&
        panel === 'channels' &&
        document.activeElement === channelSearchRef.current
      ) {
        e.preventDefault()
        e.stopPropagation()
        flushSync(() => setChannelsNavFocus('list'))
        channelSearchRef.current?.blur()
        if (chCount > 0) {
          const r = Math.min(chCount - 1, Math.max(0, focusedChannelRef.current))
          focusedChannelRef.current = r
          setFocusedChannelIndex(r)
          const id = `lch-${r}`
          setFocusedId(id)
          setLastChannelFocusId(id)
        }
        return
      }

      if (
        keyLeft &&
        panel === 'channels' &&
        document.activeElement === channelSearchRef.current &&
        channelSearchValueRef.current.trim() === ''
      ) {
        e.preventDefault()
        e.stopPropagation()
        flushSync(() => setChannelsNavFocus('list'))
        channelSearchRef.current?.blur()
        flushSync(() => setActivePanel('categories'))
        const catIdx = Math.min(activeCatIndex, Math.max(0, categoryCount - 1))
        focusedCategoryRef.current = catIdx
        setFocusedCategoryIndex(catIdx)
        if (categoryCount > 0) {
          const id = `lcat-${catIdx}`
          setFocusedId(id)
          setLastCategoryFocusId(id)
        } else {
          setFocusedId('hdr-logo')
        }
        return
      }

      if (keyUp) {
        if (document.activeElement === categorySearchRef?.current) {
          e.preventDefault()
          e.stopPropagation()
          focusHeaderFirstControl()
          return
        }
        if (document.activeElement === channelSearchRef.current) {
          e.preventDefault()
          e.stopPropagation()
          focusHeaderFirstControl()
          return
        }
      }

      const isFormField =
        ae instanceof HTMLInputElement ||
        ae instanceof HTMLTextAreaElement ||
        ae instanceof HTMLSelectElement
      if (isFormField) {
        if (!isSamsungTizenLikeRuntime()) return
        if (!dir && !isRemoteBackKey(e)) return
      } else if (isTypingTarget(e.target)) {
        return
      }

      if (isRemoteBackKey(e)) return

      const catCount = categoryCount

      if (keyLeft) {
        e.preventDefault()
        e.stopPropagation()
        if (panel === 'channels') {
          flushSync(() => setActivePanel('categories'))
          const catIdx = Math.min(activeCatIndex, Math.max(0, catCount - 1))
          focusedCategoryRef.current = catIdx
          setFocusedCategoryIndex(catIdx)
          if (catCount > 0) {
            const id = `lcat-${catIdx}`
            setFocusedId(id)
            setLastCategoryFocusId(id)
          } else {
            setFocusedId('hdr-logo')
          }
        } else if (panel === 'preview') {
          const z = previewFocusRef.current
          if (z === PREVIEW_FOCUS_EPG) {
            setPreviewFocusIndex(PREVIEW_FOCUS_FAVORITE)
            setFocusedId('lpv-1')
          } else if (z === PREVIEW_FOCUS_FAVORITE) {
            setPreviewFocusIndex(PREVIEW_FOCUS_VIDEO)
            setFocusedId('lpv-0')
          } else {
            flushSync(() => setActivePanel('channels'))
            setChannelsNavFocus('list')
            const pid = playingChannelId
            if (chCount === 0) focusedChannelRef.current = 0
            else if (pid == null) focusedChannelRef.current = 0
            else {
              const idx = visibleChannelIds.findIndex((id) => id === pid)
              focusedChannelRef.current = idx >= 0 ? idx : 0
            }
            if (chCount > 0) {
              const r = focusedChannelRef.current
              setFocusedChannelIndex(r)
              const id = `lch-${r}`
              setFocusedId(id)
              setLastChannelFocusId(id)
            }
          }
        }
        return
      }

      if (keyRight) {
        e.preventDefault()
        e.stopPropagation()
        if (panel === 'categories') {
          flushSync(() => setActivePanel('channels'))
          setChannelsNavFocus('list')
          const list = visibleChannelIds
          const pid = playingChannelId
          if (list.length === 0) focusedChannelRef.current = 0
          else if (pid == null) focusedChannelRef.current = 0
          else {
            const idx = list.findIndex((id) => id === pid)
            focusedChannelRef.current = idx >= 0 ? idx : 0
          }
          if (chCount > 0) {
            const r = Math.min(focusedChannelRef.current, chCount - 1)
            focusedChannelRef.current = r
            setFocusedChannelIndex(r)
            const id = `lch-${r}`
            setFocusedId(id)
            setLastChannelFocusId(id)
          }
        } else if (panel === 'channels') {
          flushSync(() => setActivePanel('preview'))
          setPreviewFocusIndex(PREVIEW_FOCUS_VIDEO)
          setFocusedId('lpv-0')
        } else if (panel === 'preview') {
          const z = previewFocusRef.current
          if (z === PREVIEW_FOCUS_VIDEO) {
            setPreviewFocusIndex(PREVIEW_FOCUS_FAVORITE)
            setFocusedId('lpv-1')
          } else if (z === PREVIEW_FOCUS_FAVORITE) {
            setPreviewFocusIndex(PREVIEW_FOCUS_EPG)
            setFocusedId('lpv-2')
          }
        }
        return
      }

      if (keyDown) {
        if (panel === 'preview') {
          e.preventDefault()
          e.stopPropagation()
          const z = previewFocusRef.current
          if (z === PREVIEW_FOCUS_VIDEO) {
            setPreviewFocusIndex(PREVIEW_FOCUS_FAVORITE)
            setFocusedId('lpv-1')
          } else if (z === PREVIEW_FOCUS_FAVORITE) {
            setPreviewFocusIndex(PREVIEW_FOCUS_EPG)
            setFocusedId('lpv-2')
          }
          return
        }
        if (panel === 'channels' && chCount > 0) {
          e.preventDefault()
          e.stopPropagation()
          setChannelsNavFocus('list')
          const nextCh = Math.min(chCount - 1, focusedChannelRef.current + 1)
          focusedChannelRef.current = nextCh
          setFocusedChannelIndex(nextCh)
          const id = `lch-${nextCh}`
          setFocusedId(id)
          setLastChannelFocusId(id)
          return
        }
        if (panel === 'categories' && catCount > 0) {
          e.preventDefault()
          e.stopPropagation()
          const nextCat = Math.min(catCount - 1, focusedCategoryRef.current + 1)
          focusedCategoryRef.current = nextCat
          setFocusedCategoryIndex(nextCat)
          const id = `lcat-${nextCat}`
          setFocusedId(id)
          setLastCategoryFocusId(id)
          return
        }
        return
      }

      if (keyUp) {
        if (panel === 'preview') {
          e.preventDefault()
          e.stopPropagation()
          const z = previewFocusRef.current
          if (z === PREVIEW_FOCUS_EPG) {
            setPreviewFocusIndex(PREVIEW_FOCUS_FAVORITE)
            setFocusedId('lpv-1')
          } else if (z === PREVIEW_FOCUS_FAVORITE) {
            setPreviewFocusIndex(PREVIEW_FOCUS_VIDEO)
            setFocusedId('lpv-0')
          }
          return
        }
        if (panel === 'channels') {
          e.preventDefault()
          e.stopPropagation()
          if (chCount > 0 && focusedChannelRef.current === 0) {
            if (e.repeat) return
            flushSync(() => setChannelsNavFocus('search'))
            setFocusedId('lch-search')
            window.setTimeout(() => channelSearchRef.current?.focus({ preventScroll: true }), 0)
            return
          }
          if (chCount > 0) {
            setChannelsNavFocus('list')
            const prevCh = Math.max(0, focusedChannelRef.current - 1)
            focusedChannelRef.current = prevCh
            setFocusedChannelIndex(prevCh)
            const id = `lch-${prevCh}`
            setFocusedId(id)
            setLastChannelFocusId(id)
          } else {
            if (e.repeat) return
            flushSync(() => setChannelsNavFocus('search'))
            setFocusedId('lch-search')
            window.setTimeout(() => channelSearchRef.current?.focus({ preventScroll: true }), 0)
          }
          return
        }
        if (panel === 'categories' && catCount > 0) {
          e.preventDefault()
          e.stopPropagation()
          if (focusedCategoryRef.current <= 0) {
            if (!e.repeat) {
              if (categorySearchRef?.current) {
                setFocusedId('lcat-search')
                window.setTimeout(() => categorySearchRef.current?.focus({ preventScroll: true }), 0)
              } else {
                focusHeaderFirstControl()
              }
            }
            return
          }
          const prevCat = Math.max(0, focusedCategoryRef.current - 1)
          focusedCategoryRef.current = prevCat
          setFocusedCategoryIndex(prevCat)
          const id = `lcat-${prevCat}`
          setFocusedId(id)
          setLastCategoryFocusId(id)
        }
        return
      }

      if (isRemoteEnterKey(e)) {
        if (panel === 'preview' && chCount > 0) {
          e.preventDefault()
          e.stopPropagation()
          const z = previewFocusRef.current
          if (z === PREVIEW_FOCUS_VIDEO) onOpenPlayingChannel()
          else if (z === PREVIEW_FOCUS_FAVORITE) onToggleFavorite()
          else if (z === PREVIEW_FOCUS_EPG) onOpenEpgPlaceholder()
          return
        }

        if (panel === 'categories' && catCount > 0) {
          e.preventDefault()
          e.stopPropagation()
          clearChannelSearch?.()
          setActiveCatIndex(focusedCategoryRef.current)
          return
        }
        if (panel === 'channels' && chCount > 0) {
          e.preventDefault()
          e.stopPropagation()
          const ch = visibleChannelIds[focusedChannelRef.current]
          if (!ch) return
          if (ch !== playingChannelId) setSelectedChannelId(ch)
          else onOpenPlayingChannel()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [
    isLive,
    channelCount,
    categoryCount,
    activeCatIndex,
    channelSearchRef,
    playingChannelId,
    visibleChannelIds,
    setFocusedId,
    setActiveCatIndex,
    setSelectedChannelId,
    setLastChannelFocusId,
    setLastCategoryFocusId,
    onOpenPlayingChannel,
    onToggleFavorite,
    onOpenEpgPlaceholder,
    clearChannelSearch,
    categorySearchRef,
  ])

  const onCategorySearchFocus = useCallback(() => {
    setActivePanel('categories')
  }, [])

  const onChannelSearchFocus = useCallback(() => {
    setActivePanel('channels')
    setChannelsNavFocus('search')
  }, [])

  return {
    focusedChannelIndex,
    focusedCategoryIndex,
    activePanel,
    channelsNavFocus,
    onCategorySearchFocus,
    onChannelSearchFocus,
  }
}
