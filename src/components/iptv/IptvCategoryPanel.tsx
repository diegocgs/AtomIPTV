/**
 * nexus-vision-prime CategoryPanel; foco Samsung (`lcat-*` / `focus-lcat-*`).
 */
import { Tv, Star, Clock, Trophy, Newspaper, Baby, Film, Globe, MapPin, Heart } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { TVFocusable } from '@/lib/tvFocus/TVFocusable'
import { isSamsungTizenLikeRuntime } from '@/lib/tvFocus/tvRemoteKeys'
import { cn } from '@/lib/cn'
import { moveCaretToEndOnFocus } from '@/lib/inputFocus'
import { IptvSearchField } from '@/components/iptv/IptvSearchField'

export interface CategoryRow {
  id: string
  name: string
  count: number
}

const ICONS = [Tv, Star, Clock, Trophy, Newspaper, Baby, Film, Globe, MapPin, Heart]

export type IptvCategoryPanelProps = {
  selectedCategory: number
  focusedCategoryIndex?: number
  categoryDpadActive?: boolean
  onSelectCategory: (index: number) => void
  categories?: CategoryRow[]
  loading?: boolean
  categorySearchInputRef?: RefObject<HTMLInputElement | null>
  onCategorySearchFocus?: () => void
}

export function IptvCategoryPanel({
  selectedCategory,
  focusedCategoryIndex: focusedCategoryIndexProp,
  categoryDpadActive = false,
  onSelectCategory,
  categories: categoriesProp,
  loading = false,
  categorySearchInputRef,
  onCategorySearchFocus,
}: IptvCategoryPanelProps) {
  const categories = useMemo(() => categoriesProp ?? [], [categoriesProp])
  const focusedCategoryIndex = focusedCategoryIndexProp ?? selectedCategory
  const navFocusOn = (realIndex: number) =>
    categoryDpadActive && realIndex === focusedCategoryIndex
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(
    () => categories.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [categories, searchQuery],
  )
  const listScrollRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!categoryDpadActive || categories.length === 0) return
    const idx = Math.max(0, Math.min(focusedCategoryIndex, categories.length - 1))
    const container = listScrollRef.current
    const row = document.getElementById(`focus-lcat-${idx}`)
    if (!container || !row || !container.contains(row)) return

    const margin = 10
    const c = container.getBoundingClientRect()
    const r = row.getBoundingClientRect()
    if (r.top < c.top + margin) {
      container.scrollTop += r.top - c.top - margin
    } else if (r.bottom > c.bottom - margin) {
      container.scrollTop += r.bottom - c.bottom + margin
    }
  }, [focusedCategoryIndex, categoryDpadActive, categories.length])

  const inputTabIndex = isSamsungTizenLikeRuntime() ? -1 : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TVFocusable id="lcat-search" focusScale={false} className="shrink-0 border-b border-border/30 p-4">
        <IptvSearchField
          ref={categorySearchInputRef}
          id="iptv-live-category-search"
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={(e) => {
            moveCaretToEndOnFocus(e)
            onCategorySearchFocus?.()
          }}
          tabIndex={inputTabIndex}
        />
      </TVFocusable>

      <div
        ref={listScrollRef}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain py-2 scrollbar-tv"
      >
        {loading && categories.length === 0 && (
          <div className="px-4 py-3 text-xs text-muted-foreground">Loading categories…</div>
        )}
        {!loading && categories.length === 0 && (
          <div className="px-4 py-3 text-xs text-muted-foreground">No categories.</div>
        )}
        {categories.length > 0 &&
          filtered.map((cat) => {
            const realIndex = categories.indexOf(cat)
            const isApplied = realIndex === selectedCategory
            const isNavFocus = navFocusOn(realIndex)
            const Icon = ICONS[Math.abs(realIndex) % ICONS.length]!
            return (
              <TVFocusable
                key={`${cat.id}-${cat.name}`}
                id={`lcat-${realIndex}`}
                focusScale={false}
                className={cn(
                  'mx-2 flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200',
                  isApplied && 'channel-item-active glass-card-active',
                  isNavFocus && !isApplied && 'bg-muted/25 ring-2 ring-inset ring-primary/60',
                  isNavFocus && isApplied && 'ring-2 ring-inset ring-primary/35',
                  !isApplied && !isNavFocus && 'hover:bg-muted/30',
                )}
              >
                <div
                  data-tv-activate
                  role="button"
                  className="flex min-w-0 flex-1 items-center gap-3"
                  onClick={() => onSelectCategory(realIndex)}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0',
                      isApplied || isNavFocus ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  <span
                    className={cn(
                      'flex-1 truncate text-sm font-medium',
                      isApplied || isNavFocus ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {cat.name}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs',
                      isApplied || isNavFocus
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {cat.count}
                  </span>
                </div>
              </TVFocusable>
            )
          })}
      </div>
    </div>
  )
}
