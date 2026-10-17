import { Clock, Download, Edit3, Eye } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { FileTable } from '@/components/drive/FileTable'
import { MetricCard } from '@/components/drive/MetricCard'
import { PageHeader } from '@/components/drive/PageHeader'
import { files } from '@/data/drive-data'

const activities = [
  { text: 'Opened Travel Landing Page', time: '10 minutes ago', icon: Eye },
  { text: 'Edited Campaign Assets', time: '1 hour ago', icon: Edit3 },
  { text: 'Downloaded Wedding Video', time: 'Yesterday', icon: Download },
]

export function RecentPage() {
  return (
    <>
      <PageHeader title="Recent" description="Latest opened and modified files." />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <MetricCard label="Opened Today" value="8" icon={Eye} />
        <MetricCard label="Modified" value="4" icon={Edit3} />
        <MetricCard label="Downloads" value="2" icon={Download} />
      </div>
      <Card className="mt-8 p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
        <h2 className="font-black text-base text-[var(--app-text)]">Recent Activity</h2>
        <div className="mt-4 grid gap-3">
          {activities.map((activity) => (
            <div key={activity.text} className="flex items-center gap-3 rounded-xl bg-slate-500/5 p-3.5 border border-[var(--card-border)]">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                <activity.icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-[var(--app-text)] text-sm">{activity.text}</p>
                <p className="text-xs font-semibold text-[var(--app-text-muted)] mt-0.5">{activity.time}</p>
              </div>
              <Clock className="h-4 w-4 text-[var(--app-text-muted)]" />
            </div>
          ))}
        </div>
      </Card>
      <FileTable files={files} mode="recent" />
    </>
  )
}
