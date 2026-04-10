import React, { useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { isRemoteEnter } from '@/lib/tvKeys';

interface TVFocusableProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onKeyDown'> {
  children: React.ReactNode;
  onSelect?: () => void;
  focusScale?: boolean;
  glowOnFocus?: boolean;
  as?: 'div' | 'button';
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
}

const TVFocusable: React.FC<TVFocusableProps> = ({
  children,
  onSelect,
  onKeyDown: onKeyDownProp,
  className,
  focusScale = true,
  glowOnFocus = true,
  as = 'div',
  ...props
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDownProp?.(e);
      if (e.defaultPrevented) return;
      if (e.key === ' ') {
        e.preventDefault();
        onSelect?.();
        return;
      }
      if (isRemoteEnter(e.nativeEvent)) {
        e.preventDefault();
        onSelect?.();
      }
    },
    [onKeyDownProp, onSelect]
  );

  const Component = as as React.ElementType;

  return (
    <Component
      ref={ref}
      tabIndex={0}
      role="button"
      className={cn(
        'tv-focusable cursor-pointer',
        focusScale && 'focus:scale-105 hover:scale-[1.03]',
        glowOnFocus && 'focus:neon-glow',
        className
      )}
      onKeyDown={handleKeyDown}
      onClick={onSelect}
      {...props}
    >
      {children}
    </Component>
  );
};

export default TVFocusable;
