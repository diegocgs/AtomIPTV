import { useRef } from 'react'
import { cn } from '@/lib/cn'
import { PlayerSurface } from '@/features/player/components/PlayerSurface'
import { usePlayerController } from '@/features/player/hooks/usePlayerController'

type HybridLiveStreamPreviewProps = {
  streamUrl: string
  className?: string
  title?: string
  channelId?: string
}

/** Substitui LiveStreamPreview do nexus: AVPlay/HTML5 na mesma área. */
export function HybridLiveStreamPreview({
  streamUrl,
  className,
  title,
  channelId,
}: HybridLiveStreamPreviewProps) {
  const ref = useRef<HTMLDivElement>(null)
  usePlayerController({
    containerRef: ref,
    streamUrl,
    title,
    contentRef: channelId,
    autoPlay: true,
  })

  return (
    <div className={cn('absolute inset-0 z-0', className)}>
      <PlayerSurface ref={ref} className="h-full w-full" />
    </div>
  )
}
