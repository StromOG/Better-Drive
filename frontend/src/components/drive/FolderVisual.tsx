import { createElement } from 'react'
import {
  Folder,
  FolderOpen,
  FolderArchive,
  Files,
  FileText,
  FileCode,
  Briefcase,
  Archive,
  Cloud,
  HardDrive,
  Database,
  Server,
  Image,
  Video,
  Film,
  Music,
  Headphones,
  Code,
  Terminal,
  Package,
  Box,
  BookOpen,
  GraduationCap,
  Receipt,
  Wallet,
  BarChart3,
  Calendar,
  Clock,
  Users,
  Share2,
  Lock,
  Shield,
  Star,
  Heart,
  Rocket,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FolderItem } from '@/data/drive-data'

const legacyColorMap: Record<string, string> = {
  'text-blue-500': '#3b82f6',
  'text-lime-500': '#84cc16',
  'text-cyan-400': '#22d3ee',
  'text-yellow-400': '#facc15',
  'text-orange-500': '#f97316',
}

export const defaultFolderColor = '#3b82f6'
export const defaultFolderIconUrl = 'https://api.iconify.design/lucide:folder.svg'

export interface FolderIconDef {
  id: string
  label: string
  url: string
  Icon: LucideIcon
}

export const folderIconOptions: FolderIconDef[] = [
  { id: 'folder', label: 'Folder', url: defaultFolderIconUrl, Icon: Folder },
  { id: 'folder-open', label: 'Open Folder', url: 'https://api.iconify.design/lucide:folder-open.svg', Icon: FolderOpen },
  { id: 'folders', label: 'Archive Folder', url: 'https://api.iconify.design/lucide:folders.svg', Icon: FolderArchive },
  { id: 'files', label: 'Files', url: 'https://api.iconify.design/lucide:files.svg', Icon: Files },
  { id: 'file-text', label: 'Document', url: 'https://api.iconify.design/lucide:file-text.svg', Icon: FileText },
  { id: 'file-code', label: 'Script', url: 'https://api.iconify.design/lucide:file-code.svg', Icon: FileCode },
  { id: 'briefcase', label: 'Work', url: 'https://api.iconify.design/lucide:briefcase.svg', Icon: Briefcase },
  { id: 'archive', label: 'Archive', url: 'https://api.iconify.design/lucide:archive.svg', Icon: Archive },
  { id: 'cloud', label: 'Cloud', url: 'https://api.iconify.design/lucide:cloud.svg', Icon: Cloud },
  { id: 'hard-drive', label: 'Hard Drive', url: 'https://api.iconify.design/lucide:hard-drive.svg', Icon: HardDrive },
  { id: 'database', label: 'Database', url: 'https://api.iconify.design/lucide:database.svg', Icon: Database },
  { id: 'server', label: 'Server', url: 'https://api.iconify.design/lucide:server.svg', Icon: Server },
  { id: 'image', label: 'Photos', url: 'https://api.iconify.design/lucide:image.svg', Icon: Image },
  { id: 'video', label: 'Videos', url: 'https://api.iconify.design/lucide:video.svg', Icon: Video },
  { id: 'film', label: 'Film & Cinema', url: 'https://api.iconify.design/lucide:film.svg', Icon: Film },
  { id: 'music', label: 'Audio', url: 'https://api.iconify.design/lucide:music.svg', Icon: Music },
  { id: 'headphones', label: 'Podcasts', url: 'https://api.iconify.design/lucide:headphones.svg', Icon: Headphones },
  { id: 'code', label: 'Development', url: 'https://api.iconify.design/lucide:code.svg', Icon: Code },
  { id: 'terminal', label: 'Terminal', url: 'https://api.iconify.design/lucide:terminal.svg', Icon: Terminal },
  { id: 'package', label: 'Package', url: 'https://api.iconify.design/lucide:package.svg', Icon: Package },
  { id: 'box', label: 'Box Assets', url: 'https://api.iconify.design/lucide:box.svg', Icon: Box },
  { id: 'book-open', label: 'Documentation', url: 'https://api.iconify.design/lucide:book-open.svg', Icon: BookOpen },
  { id: 'graduation-cap', label: 'Education', url: 'https://api.iconify.design/lucide:graduation-cap.svg', Icon: GraduationCap },
  { id: 'receipt', label: 'Receipts', url: 'https://api.iconify.design/lucide:receipt.svg', Icon: Receipt },
  { id: 'wallet', label: 'Finance', url: 'https://api.iconify.design/lucide:wallet.svg', Icon: Wallet },
  { id: 'chart', label: 'Analytics', url: 'https://api.iconify.design/lucide:chart-column.svg', Icon: BarChart3 },
  { id: 'calendar', label: 'Calendar', url: 'https://api.iconify.design/lucide:calendar.svg', Icon: Calendar },
  { id: 'clock', label: 'Timeline', url: 'https://api.iconify.design/lucide:clock.svg', Icon: Clock },
  { id: 'users', label: 'Team', url: 'https://api.iconify.design/lucide:users.svg', Icon: Users },
  { id: 'share', label: 'Shared', url: 'https://api.iconify.design/lucide:share-2.svg', Icon: Share2 },
  { id: 'lock', label: 'Vault', url: 'https://api.iconify.design/lucide:lock.svg', Icon: Lock },
  { id: 'shield', label: 'Security', url: 'https://api.iconify.design/lucide:shield.svg', Icon: Shield },
  { id: 'star', label: 'Starred', url: 'https://api.iconify.design/lucide:star.svg', Icon: Star },
  { id: 'heart', label: 'Favorites', url: 'https://api.iconify.design/lucide:heart.svg', Icon: Heart },
  { id: 'rocket', label: 'Releases', url: 'https://api.iconify.design/lucide:rocket.svg', Icon: Rocket },
  { id: 'sparkles', label: 'Highlights', url: 'https://api.iconify.design/lucide:sparkles.svg', Icon: Sparkles },
]

export function getFolderIconComponent(urlOrId?: string | null): LucideIcon {
  if (!urlOrId) return Folder
  const clean = urlOrId.toLowerCase()
  const found = folderIconOptions.find(
    (opt) =>
      opt.url.toLowerCase() === clean ||
      opt.id.toLowerCase() === clean ||
      clean.includes(opt.id.toLowerCase())
  )
  return found?.Icon ?? Folder
}

export const folderColorOptions = [
  '#3b82f6', // Electric Blue
  '#84cc16', // Lime
  '#22d3ee', // Cyan
  '#facc15', // Gold
  '#f97316', // Orange
  '#ef4444', // Crimson
  '#a855f7', // Purple
  '#14b8a6', // Teal
]

export function normalizeFolderColor(color?: string | null) {
  if (color?.startsWith('#')) return color
  return legacyColorMap[color ?? ''] ?? defaultFolderColor
}

export function iconUrlWithColor(iconUrl: string, color: string) {
  const separator = iconUrl.includes('?') ? '&' : '?'
  return `${iconUrl}${separator}color=${encodeURIComponent(color)}`
}

export function FolderVisual({
  folder,
  className,
  iconClassName,
}: {
  folder: Pick<FolderItem, 'color' | 'iconUrl'>
  className?: string
  iconClassName?: string
}) {
  const color = normalizeFolderColor(folder.color)
  const IconComponent = getFolderIconComponent(folder.iconUrl)

  return (
    <span className={cn('inline-flex items-center justify-center', className)}>
      {createElement(IconComponent, {
        className: cn('h-full w-full stroke-current', iconClassName),
        style: { color },
      })}
    </span>
  )
}
