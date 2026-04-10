import { useLayoutEffect, useRef } from 'react';
import { Star, Circle, Tv } from 'lucide-react';
import { cn } from '@/lib/utils';
import TVFocusable from './TVFocusable';
import IptvRemoteImage from './IptvRemoteImage';

export interface Channel {
  id: number;
  name: string;
  number: number;
  quality: 'SD' | 'HD' | 'FHD' | '4K';
  isLive: boolean;
  isFavorite: boolean;
  logo?: string;
  category: string;
}

const qualityColors: Record<string, string> = {
  SD: 'text-muted-foreground bg-muted',
  HD: 'text-primary bg-primary/15',
  FHD: 'text-secondary bg-secondary/15',
  '4K': 'text-amber-400 bg-amber-400/15',
};

interface ChannelListProps {
  channels?: Channel[];
  /** ID do canal em reprodução no preview (estável ao mudar categoria). */
  playingChannelId: number | null;
  /** Índice destacado pela navegação ↑↓ (Enter confirma). Opcional: default = primeira linha. */
  focusedChannelIndex?: number;
  /** Só mostrar destaque de navegação quando a coluna de canais for a ativa no D-pad. */
  channelDpadActive?: boolean;
  onSelectChannel: (index: number) => void;
}

const ChannelList: React.FC<ChannelListProps> = ({
  channels: channelsProp,
  playingChannelId,
  focusedChannelIndex: focusedChannelIndexProp,
  channelDpadActive = false,
  onSelectChannel,
}) => {
  const channels = channelsProp ?? [];
  const focusedChannelIndex = focusedChannelIndexProp ?? 0;
  const navFocusOn = (i: number) => channelDpadActive && i === focusedChannelIndex;
  const listScrollRef = useRef<HTMLDivElement>(null);

  /** Só altera scroll deste container — evita scrollIntoView subir a coluna inteira e sumir com o search. */
  useLayoutEffect(() => {
    if (!channelDpadActive || channels.length === 0) return;
    const idx = Math.max(0, Math.min(focusedChannelIndex, channels.length - 1));
    const container = listScrollRef.current;
    const row = document.getElementById(`iptv-channel-row-${idx}`);
    if (!container || !row || !container.contains(row)) return;

    const margin = 10;
    const c = container.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    if (r.top < c.top + margin) {
      container.scrollTop += r.top - c.top - margin;
    } else if (r.bottom > c.bottom - margin) {
      container.scrollTop += r.bottom - c.bottom + margin;
    }
  }, [focusedChannelIndex, channelDpadActive, channels.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header — fora da área com scroll */}
      <div className="flex shrink-0 items-center justify-between px-4 py-3 border-b border-border/30">
        <span className="text-xs text-muted-foreground">Total Channels: {channels.length}</span>
      </div>

      {/* Channels */}
      <div ref={listScrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-tv overscroll-contain">
        {channels.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            No channels in this view. Add a playlist or pick another category.
          </div>
        ) : (
          channels.map((ch, i) => {
            const isPlaying = playingChannelId != null && ch.id === playingChannelId;
            const isNavFocus = navFocusOn(i);
            return (
              <TVFocusable
                id={`iptv-channel-row-${i}`}
                key={`${ch.id}-${i}`}
                onSelect={() => onSelectChannel(i)}
                focusScale={false}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 mx-2 my-0.5 rounded-xl transition-all duration-200',
                  isPlaying && 'glass-card-active channel-item-active',
                  isNavFocus && !isPlaying && 'ring-2 ring-inset ring-primary/60 bg-muted/25',
                  isNavFocus && isPlaying && 'ring-2 ring-inset ring-primary/35',
                  !isPlaying && !isNavFocus && 'hover:bg-muted/20'
                )}
              >
                {/* Number */}
                <span className={cn('w-8 text-center text-sm font-mono', isPlaying || isNavFocus ? 'text-primary' : 'text-muted-foreground')}>
                  {ch.number}
                </span>

                {/* Logo placeholder */}
                <div className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden',
                  isPlaying || isNavFocus ? 'bg-primary/20' : 'bg-muted/50'
                )}>
                  {ch.logo ? (
                    <IptvRemoteImage
                      src={ch.logo}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      fallback={
                        <Tv
                          className={cn(
                            'w-4 h-4',
                            isPlaying || isNavFocus ? 'text-primary' : 'text-muted-foreground'
                          )}
                        />
                      }
                    />
                  ) : (
                    <Tv className={cn('w-4 h-4', isPlaying || isNavFocus ? 'text-primary' : 'text-muted-foreground')} />
                  )}
                </div>

                {/* Category + name */}
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
                      isPlaying || isNavFocus ? 'text-foreground' : 'text-foreground/80'
                    )}
                  >
                    {ch.name}
                  </span>
                </div>

                {/* Live indicator */}
                {ch.isLive && (
                  <Circle className={cn('w-2.5 h-2.5 fill-current shrink-0', isPlaying || isNavFocus ? 'text-success' : 'text-success/60')} />
                )}

                {/* Favorite */}
                {ch.isFavorite && (
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                )}

                {/* Quality */}
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', qualityColors[ch.quality])}>
                  {ch.quality}
                </span>
              </TVFocusable>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ChannelList;
