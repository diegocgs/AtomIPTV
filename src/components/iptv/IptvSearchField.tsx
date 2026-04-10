import * as React from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export type IptvSearchFieldProps = Omit<React.ComponentProps<'input'>, 'type'> & {
  wrapperClassName?: string
}

/**
 * Campo de pesquisa IPTV alinhado ao padrão Lovable/shadcn: ícone + input em flex (sem overlay),
 * altura fixa h-10, cantos rounded-xl e foco no contentor.
 */
export const IptvSearchField = React.forwardRef<HTMLInputElement, IptvSearchFieldProps>(
  function IptvSearchField({ className, wrapperClassName, disabled, ...props }, ref) {
    return (
      <div
        className={cn(
          'flex h-10 w-full items-center gap-2.5 rounded-xl border border-border/50 bg-muted/50 px-3 transition-all',
          'focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/50',
          disabled && 'pointer-events-none opacity-50',
          wrapperClassName,
        )}
      >
        <Search
          className="pointer-events-none h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <input
          ref={ref}
          type="text"
          disabled={disabled}
          className={cn(
            'min-h-0 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground',
            'placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-0',
            className,
          )}
          {...props}
        />
      </div>
    )
  },
)
