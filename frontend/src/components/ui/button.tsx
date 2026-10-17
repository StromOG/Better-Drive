import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: 'bg-[var(--accent)] text-white shadow-[0_4px_16px_var(--ring-focus)] hover:brightness-110 active:scale-[0.98]',
        outline: 'border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-text)] shadow-xs hover:bg-slate-500/10 active:scale-[0.98]',
        ghost: 'text-[var(--app-text)] hover:bg-slate-500/10 active:scale-[0.98]',
        soft: 'bg-slate-500/10 text-[var(--app-text)] shadow-xs hover:bg-slate-500/15 active:scale-[0.98]',
        danger: 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 active:scale-[0.98]',
        destructive: 'bg-rose-600 text-white shadow-xs hover:bg-rose-700 active:scale-[0.98]',
      },
      size: {
        default: 'h-11 px-4 py-2',
        sm: 'h-9 px-3',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
