import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

export function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <Card className="p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--app-text-muted)]">{label}</p>
          <p className="mt-2 text-2xl font-black text-[var(--app-text)]">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  )
}
