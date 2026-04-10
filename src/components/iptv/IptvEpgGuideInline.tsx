import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatEpgRange, type XtreamShortEpgEntry } from '@/features/iptv/epgDisplay';

const isProgramNow = (e: XtreamShortEpgEntry, nowSec: number): boolean =>
  nowSec >= e.startSec && nowSec < e.endSec;

type EpgGuideInlineProps = {
  channelName: string;
  /** Já ordenado por `startSec` (alinhado ao índice de foco). */
  entries: XtreamShortEpgEntry[];
  /** Programa no ar (mesmo critério do resumo do preview); se ausente, calcula pela lista. */
  epgCurrent?: XtreamShortEpgEntry | null;
  loading?: boolean;
  /** Índice na lista ordenada (navegação D-pad). */
  focusedIndex: number;
};

/** Lista de programas do `get_short_epg` — dentro da coluna de preview (não cobre o vídeo). */
export function IptvEpgGuideInline({
  channelName,
  entries,
  epgCurrent = null,
  loading = false,
  focusedIndex,
}: EpgGuideInlineProps) {
  const [nowSec, setNowSec] = useState(0);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  const nowPlaying =
    epgCurrent && nowSec >= epgCurrent.startSec && nowSec < epgCurrent.endSec
      ? epgCurrent
      : (entries.find(e => nowSec >= e.startSec && nowSec < e.endSec) ?? null);

  useEffect(() => {
    const el = itemRefs.current[focusedIndex];
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusedIndex, entries.length]);

  useEffect(() => {
    const syncNow = () => setNowSec(Math.floor(Date.now() / 1000));
    syncNow();
    const id = window.setInterval(syncNow, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border/30 pb-2">
        <div className="min-w-0">
          <h3 className="font-display truncate text-sm font-semibold text-foreground">Program guide</h3>
          <p className="truncate text-[10px] text-muted-foreground">{channelName}</p>
        </div>
      </div>

      {nowPlaying && !loading && (
        <div className="shrink-0 rounded-xl border border-primary/45 bg-primary/10 px-3 py-2.5 mt-2">
          <p className="text-right text-[11px] font-medium text-primary tabular-nums">
            {formatEpgRange(nowPlaying.startSec, nowPlaying.endSec)}
          </p>
          <p className="mt-1.5 text-sm font-semibold leading-snug text-foreground">{nowPlaying.title}</p>
          {nowPlaying.description?.trim() ? (
            <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{nowPlaying.description.trim()}</p>
          ) : null}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-tv py-2">
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading schedule…
          </div>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No program listings from the provider for this channel.
          </p>
        ) : (
          <ul
            className="flex flex-col gap-2"
            role="listbox"
            aria-activedescendant={entries.length > 0 ? `epg-row-${focusedIndex}` : undefined}
          >
            {entries.map((e, i) => {
              const now = isProgramNow(e, nowSec);
              const navFocus = i === focusedIndex;
              return (
                <li
                  id={`epg-row-${i}`}
                  key={`${e.startSec}-${e.endSec}-${e.title}-${i}`}
                  ref={el => {
                    itemRefs.current[i] = el;
                  }}
                  role="option"
                  aria-selected={navFocus}
                  className={cn(
                    'rounded-xl border px-3 py-2 transition-colors',
                    navFocus && 'ring-2 ring-inset ring-primary/80 z-[1] shadow-[0_0_12px_rgba(34,211,238,0.2)]',
                    now
                      ? 'border-primary/50 bg-primary/10'
                      : 'border-border/30 bg-muted/20'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-primary">
                      {formatEpgRange(e.startSec, e.endSec)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold leading-snug text-foreground">{e.title}</p>
                  {e.description?.trim() ? (
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{e.description.trim()}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
