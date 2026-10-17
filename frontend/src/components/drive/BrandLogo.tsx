import { cn } from '@/lib/utils'

export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="Better Drive logo"
      className={cn('h-8 w-8 object-contain shrink-0 drop-shadow-sm select-none', className)}
      draggable={false}
    />
  )
}
