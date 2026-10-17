import type { ReactNode } from 'react'

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: string; actions?: ReactNode }) {
  return (
    <div className="mt-2.5 flex flex-col gap-2 sm:mt-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-black tracking-tight sm:text-[24px] lg:text-[30px] text-[var(--app-text)]">{title}</h1>
        {description ? <p className="mt-1 text-sm font-semibold text-[var(--app-text-muted)]">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap gap-2 sm:shrink-0 sm:flex-nowrap sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
