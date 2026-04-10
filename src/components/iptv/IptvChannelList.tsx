/**
 * nexus-vision-prime ChannelList; IDs de canal em string (catálogo Samsung); foco `lch-*`.
 */
import { useLayoutEffect, useRef } from 'react'
import { Star, Circle, Tv } from 'lucide-react'
import { TVFocusable } from '@/lib/tvFocus/TVFocusable'
import { cn } from '@/lib/cn'
import { IptvRemoteImage } from './IptvRemoteImage'

export interface IptvChannelRow {
  id: string
  name: string
  number: number
  quality: 'SD' | 'HD' | 'FHD' | '4K'
  isLive: boolean
  isFavorite: boolean
  logo?: string
  category: string
}

const qualityColors: Record<string, string> = {
  SD: 'text-muted-foreground bg-muted',
  HD: 'text-primary bg-primary/15',
  FHD: 'text-secondary bg-secondary/15',
  '4K': 'text-amber-400 bg-amber-400/15',
}

export type IptvChannelListProps = {
  channels?: IptvChannelRow[]
  playingChannelId: string | null
  focusedChannelIndex?: number
  channelDpadActive?: boolean
  onSelectChannel: (index: number) => void
}

export function IptvChannelList({
  channels: channelsProp,
  playingChannelId,
  focusedChannelIndex: focusedChannelIndexProp,
  channelDpadActive = false,
  onSelectChannel,
}: IptvChannelListProps) {
  const channels = channelsProp ?? []
  const focusedChannelIndex = focusedChannelIndexProp ?? 0
  const navFocusOn = (i: number) => channelDpadActive && i === focusedChannelIndex
  const listScrollRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!channelDpadActive || channels.length === 0) return
    const idx = Math.max(0, Math.min(focusedChannelIndex, channels.length - 1))
    const container = listScrollRef.current
    const row = document.getElementById(`focus-lch-${idx}`)
    if (!container || !row || !container.contains(row)) return

    const margin = 10
    const c = container.getBoundingClientRect()
    const r = row.getBoundingClientRect()
    if (r.top < c.top + margin) {
      container.scrollTop += r.top - c.top - margin
    } else if (r.bottom > c.bottom - margin) {
      container.scrollTop += r.bottom - c.bottom + margin
    }
  }, [focusedChannelIndex, channelDpadActive, channels.length])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border/30 px-4 py-3">
        <span className="text-xs text-muted-foreground">Total Channels: {channels.length}</span>
      </div>

      <div
        ref={listScrollRef}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain scrollbar-tv"
      >
        {channels.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            No channels in this view. Add a playlist or pick another category.
          </div>
        ) : (
          channels.map((ch, i) => {
            const isPlaying = playingChannelId != null && ch.id === playingChannelId
            const isNavFocus = navFocusOn(i)
            return (
              <TVFocusable
                key={`${ch.id}-${i}`}
                id={`lch-${i}`}
                focusScale={false}
                className={cn(
                  'mx-2 my-0.5 flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200',
                  isPlaying && 'glass-card-active channel-item-active',
                  isNavFocus && !isPlaying && 'bg-muted/25 ring-2 ring-inset ring-primary/60',
                  isNavFocus && isPlaying && 'ring-2 ring-inset ring-primary/35',
                  !isPlaying && !isNavFocus && 'hover:bg-muted/20',
                )}
              >
                <div
                  data-tv-activate
                  role="button"
                  className="flex min-w-0 flex-1 items-center gap-3"
                  onClick={() => onSelectChannel(i)}
                >
                  <span
                    className={cn(
                      'w-8 text-center font-mono text-sm',
                      isPlaying || isNavFocus ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {ch.number}
                  </span>

                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg',
                      isPlaying || isNavFocus ? 'bg-primary/20' : 'bg-muted/50',
                    )}
                  >
                    {ch.logo ? (
                      <IptvRemoteImage
                        src={ch.logo}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        fallback={
                          <Tv
                            className={cn(
                              'h-4 w-4',
                              isPlaying || isNavFocus ? 'text-primary' : 'text-muted-foreground',
                            )}
                          />
                        }
                      />
                    ) : (
                      <Tv
                        className={cn(
                          'h-4 w-4',
                          isPlaying || isNavFocus ? 'text-primary' : 'text-muted-foreground',
                        )}
                      />
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                    <span
                      className="truncate text-[10px] leading-tight text-muted-foreground"
                      title={ch.category}
                    >
                      {ch.category}
                    </span>
                    <span
                      className={cn(
                        'truncate text-sm font-medium',
                        isPlaying || isNavFocus ? 'text-foreground' : 'text-foreground/80',
                      )}
                    >
                      {ch.name}
                    </span>
                  </div>

                  {ch.isLive && (
                    <Circle
                      className={cn(
                        'h-2.5 w-2.5 shrink-0 fill-current',
                        isPlaying || isNavFocus ? 'text-success' : 'text-success/60',
                      )}
                    />
                  )}

                  {ch.isFavorite && (
                    <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                  )}

                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-bold',
                      qualityColors[ch.quality],
                    )}
                  >
                    {ch.quality}
                  </span>
                </div>
              </TVFocusable>
            )
          })
        )}
      </div>
    </div>
  )
}
