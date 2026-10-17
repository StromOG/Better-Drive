import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'h-11 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 text-sm font-semibold text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] placeholder:font-normal outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring-focus)] disabled:cursor-not-allowed disabled:opacity-50 shadow-xs',
          className,
        )}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'
