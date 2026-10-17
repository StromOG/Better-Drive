import fs from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '../../config/prisma.js'

export type MascotAccessory = 'none' | 'detective' | 'sunglasses' | 'crown' | 'party'
export type MascotColorTheme = 'candy' | 'cyan' | 'pink' | 'midnight' | 'mint'

export interface MascotSettings {
  accessory: MascotAccessory
  colorTheme: MascotColorTheme
  soundEnabled: boolean
  hasSeenTour: boolean
  position: { x: number; y: number } | null
  minimized: boolean
  dashboardTheme?: string
  avatarUrl?: string
}

const DEFAULT_SETTINGS: MascotSettings = {
  accessory: 'none',
  colorTheme: 'candy',
  soundEnabled: true,
  hasSeenTour: false,
  position: null,
  minimized: false,
  dashboardTheme: 'arctic-pure',
  avatarUrl: '',
}

const DATA_DIR = path.resolve(process.cwd(), 'data')
const SETTINGS_FILE = path.join(DATA_DIR, 'mascot_settings.json')

let memoryCache: Record<string, MascotSettings> | null = null

async function ensureDataFile(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
    try {
      await fs.access(SETTINGS_FILE)
    } catch {
      await fs.writeFile(SETTINGS_FILE, JSON.stringify({}), 'utf-8')
    }
  } catch (err) {
    console.error('Failed to initialize mascot data directory:', err)
  }
}

async function readAllSettings(): Promise<Record<string, MascotSettings>> {
  if (memoryCache) return memoryCache
  await ensureDataFile()
  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf-8')
    memoryCache = JSON.parse(raw) as Record<string, MascotSettings>
  } catch {
    memoryCache = {}
  }
  return memoryCache
}

async function writeAllSettings(all: Record<string, MascotSettings>): Promise<void> {
  memoryCache = all
  await ensureDataFile()
  try {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(all, null, 2), 'utf-8')
  } catch (err) {
    console.error('Failed to write mascot settings file:', err)
  }
}

export async function getMascotSettings(userId: string): Promise<MascotSettings> {
  const all = await readAllSettings()
  return all[userId] ? { ...DEFAULT_SETTINGS, ...all[userId] } : { ...DEFAULT_SETTINGS }
}

export async function updateMascotSettings(
  userId: string,
  patch: Partial<MascotSettings>,
): Promise<MascotSettings> {
  const all = await readAllSettings()
  const current = all[userId] ? { ...DEFAULT_SETTINGS, ...all[userId] } : { ...DEFAULT_SETTINGS }
  const updated: MascotSettings = {
    ...current,
    ...patch,
  }
  all[userId] = updated
  await writeAllSettings(all)
  return updated
}

function formatBytes(bytes: bigint | number): string {
  const b = Number(bytes)
  if (b === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export interface MascotSmartInsight {
  id: string
  text: string
  category: 'setup' | 'storage' | 'dedup' | 'sftp' | 'trash' | 'quota' | 'organization' | 'shortcuts'
  mood: 'happy' | 'celebrate' | 'confused' | 'searching' | 'peek' | 'tour' | 'idle'
  badge?: string
  priority: number
  action?: {
    label: string
    actionKey: string
  }
}

export interface MascotTelemetryData {
  connectedAccountsCount: number
  googleAccountsCount: number
  s3AccountsCount: number
  fileCount: number
  trashCount: number
  starredCount: number
  folderCount: number
  totalBytes: number
  formattedSize: string
  quotaUsedBytes: number
  quotaTotalBytes: number
  quotaPercent: number
  duplicateCount: number
  duplicateReclaimableBytes: number
  formattedDuplicateReclaimable: string
  deduplicatedSavingsBytes: number
  formattedDedupSavings: string
  sftpEnabled: boolean
  sftpProfilesCount: number
  sftpKeysCount: number
  recentFileName: string | null
  primaryGreeting: {
    text: string
    mood: 'happy' | 'celebrate' | 'confused' | 'searching' | 'peek' | 'tour' | 'idle'
    badge?: string
    action?: {
      label: string
      actionKey: string
    }
  }
  insights: MascotSmartInsight[]
  tips: string[]
}

export async function getSmartMascotTelemetry(userId: string): Promise<MascotTelemetryData> {
  try {
    const [
      fileCount,
      trashCount,
      starredCount,
      folderCount,
      sizeAgg,
      accounts,
      recentFile,
      sftpProfilesCount,
      sftpKeysCount,
      totalStorageAcc,
      dedupGroups,
    ] = await Promise.all([
      prisma.file.count({ where: { userId, deletedAt: null } }),
      prisma.file.count({ where: { userId, deletedAt: { not: null } } }),
      prisma.file.count({ where: { userId, starred: true, deletedAt: null } }),
      prisma.folder.count({ where: { userId } }),
      prisma.file.aggregate({
        where: { userId, deletedAt: null },
        _sum: { sizeBytes: true },
      }),
      prisma.connectedAccount.findMany({
        where: { userId },
        select: { provider: true, status: true, displayName: true, email: true },
      }),
      prisma.file.findFirst({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { name: true },
      }),
      prisma.sftpAccessProfile.count({ where: { userId, enabled: true } }).catch(() => 0),
      prisma.sftpAuthorizedKey.count({ where: { profile: { userId }, revokedAt: null } }).catch(() => 0),
      prisma.storageAccount.findMany({
        where: { connectedAccount: { userId } },
        select: { usedBytes: true, totalBytes: true },
      }).catch(() => []),
      prisma.file.groupBy({
        by: ['checksum'],
        where: { userId, status: 'active', checksum: { not: null } },
        _count: { _all: true },
        _sum: { sizeBytes: true },
        having: { checksum: { _count: { gt: 1 } } },
      }).catch(() => []),
    ])

    const totalBytes = sizeAgg._sum.sizeBytes ? Number(sizeAgg._sum.sizeBytes) : 0
    const formattedSize = formatBytes(totalBytes)

    const googleAccounts = accounts.filter(
      (a) => a.provider === 'google' && a.status === 'connected',
    )
    const s3Accounts = accounts.filter(
      (a) => a.provider === 's3' && a.status === 'connected',
    )
    const connectedAccountsCount = googleAccounts.length + s3Accounts.length

    // Quota totals
    let poolUsed = 0
    let poolTotal = 0
    for (const sa of totalStorageAcc) {
      poolUsed += Number(sa.usedBytes || 0)
      if (sa.totalBytes) poolTotal += Number(sa.totalBytes)
    }
    const quotaPercent = poolTotal > 0 ? Math.min(100, Math.round((poolUsed / poolTotal) * 100)) : 0

    // Deduplication calculations
    let duplicateReclaimableBytes = 0
    let duplicateCount = 0
    for (const group of dedupGroups) {
      const count = Number(group._count._all)
      if (count > 1 && group._sum.sizeBytes) {
        duplicateCount += (count - 1)
        const unitBytes = Number(group._sum.sizeBytes) / count
        duplicateReclaimableBytes += unitBytes * (count - 1)
      }
    }
    const formattedDuplicateReclaimable = formatBytes(duplicateReclaimableBytes)
    const deduplicatedSavingsBytes = duplicateReclaimableBytes
    const formattedDedupSavings = formattedDuplicateReclaimable

    const insights: MascotSmartInsight[] = []
    const tips: string[] = []

    // 1. Determine Primary Contextual Greeting based on REAL state
    let primaryGreeting: MascotTelemetryData['primaryGreeting']

    if (connectedAccountsCount === 0 && fileCount === 0) {
      primaryGreeting = {
        text: "👋 Welcome to Better Drive! No cloud drives are connected yet. Link Google Drive or S3 in Settings to pool storage!",
        mood: 'tour',
        badge: 'SETUP VAULT',
        action: { label: 'Connect Storage', actionKey: 'connect_storage' },
      }
    } else if (connectedAccountsCount === 0 && fileCount > 0) {
      primaryGreeting = {
        text: `⚠️ Storage buffer active: ${fileCount} file(s) saved in local SQLite. Connect Google Drive or S3 to activate an encrypted cloud pool!`,
        mood: 'searching',
        badge: 'NO CLOUD POOL',
        action: { label: 'Connect Cloud', actionKey: 'connect_storage' },
      }
    } else if (connectedAccountsCount > 0 && fileCount === 0) {
      const providerBreakdown = [
        googleAccounts.length > 0 ? `${googleAccounts.length} Google Drive(s)` : '',
        s3Accounts.length > 0 ? `${s3Accounts.length} S3 bucket(s)` : '',
      ].filter(Boolean).join(' & ')

      primaryGreeting = {
        text: `🚀 Storage engines online! ${providerBreakdown} pooled. Drag and drop any files or folders to start uploading!`,
        mood: 'happy',
        badge: 'READY TO UPLOAD',
        action: { label: 'Upload Files', actionKey: 'trigger_upload' },
      }
    } else {
      const providerBreakdown = [
        googleAccounts.length > 0 ? `${googleAccounts.length} Google Drive(s)` : '',
        s3Accounts.length > 0 ? `${s3Accounts.length} S3 bucket(s)` : '',
      ].filter(Boolean).join(' & ')

      primaryGreeting = {
        text: `⚡ Vault healthy: ${providerBreakdown} pooled with ${fileCount} active files (${formattedSize}).`,
        mood: 'happy',
        badge: 'ENGINES NOMINAL',
        action: { label: 'Storage Pool', actionKey: 'open_quota' },
      }
    }

    // 2. High-Priority Actionable Insights
    if (connectedAccountsCount === 0) {
      insights.push({
        id: 'no_accounts',
        priority: 100,
        text: '⚠️ You have no cloud storage linked yet! Files are currently buffered in local SQLite storage.',
        category: 'setup',
        mood: 'confused',
        badge: 'SETUP STORAGE',
        action: { label: 'Connect Storage', actionKey: 'connect_storage' },
      })
      tips.push('⚠️ Storing files in local SQLite. Link Google Drive or S3 in Settings to expand into a unified cloud pool!')
      tips.push('💡 Pro tip: Pool multiple Google Drives or S3 buckets to combine quotas into one giant vault.')
    } else {
      const providerBreakdown = [
        googleAccounts.length > 0 ? `${googleAccounts.length} Google Drive(s)` : '',
        s3Accounts.length > 0 ? `${s3Accounts.length} S3 bucket(s)` : '',
      ].filter(Boolean).join(' & ')

      tips.push(`🤖 Storage pool online: ${providerBreakdown} synced and active with automated load balancing.`)
    }

    if (fileCount === 0) {
      insights.push({
        id: 'zero_files',
        priority: 95,
        text: '📂 Your vault is empty! Drag and drop files anywhere on the dashboard or click Upload in the top header.',
        category: 'organization',
        mood: 'tour',
        badge: 'GET STARTED',
        action: { label: 'Upload Files', actionKey: 'trigger_upload' },
      })
      tips.push('📁 Your storage vault is empty. Drag and drop any files or folders to start uploading!')
    } else {
      tips.push(`✨ Vault Status: ${fileCount} files (${formattedSize}) securely encrypted with client-side SHA-256 pre-hashing.`)
    }

    // Quota warning if approaching limits
    if (quotaPercent >= 80) {
      insights.push({
        id: 'high_quota',
        priority: 98,
        text: `🚨 Storage warning: Pooled capacity is at ${quotaPercent}% (${formatBytes(poolUsed)} / ${formatBytes(poolTotal)}). Add another S3 bucket or Google account!`,
        category: 'quota',
        mood: 'searching',
        badge: 'QUOTA WARNING',
        action: { label: 'Expand Pool', actionKey: 'connect_storage' },
      })
      tips.push(`🚨 Storage warning: Vault is at ${quotaPercent}% capacity. Consider connecting an additional cloud bucket in Settings.`)
    }

    // Duplicate detection insight
    if (duplicateCount > 0) {
      insights.push({
        id: 'duplicates_found',
        priority: 90,
        text: `⚡ Deduplication: ${duplicateCount} duplicate file(s) found wasting ${formattedDuplicateReclaimable}. Clean them in 1 click!`,
        category: 'dedup',
        mood: 'celebrate',
        badge: 'DEDUP OPPORTUNITY',
        action: { label: 'Clean Duplicates', actionKey: 'open_quota' },
      })
      tips.push(`⚡ Zero-copy dedup: Found ${duplicateCount} duplicate file(s) saving ${formattedDuplicateReclaimable} in Quota Tracker.`)
    }

    // Trash cleanup insight
    if (trashCount > 0) {
      insights.push({
        id: 'trash_cleanup',
        priority: 85,
        text: `🗑️ ${trashCount} deleted item(s) are resting in your Trash. Empty trash to free up pooled quota!`,
        category: 'trash',
        mood: 'idle',
        badge: 'TRASH',
        action: { label: 'View Trash', actionKey: 'open_trash' },
      })
      tips.push(`🗑️ Trash contains ${trashCount} deleted item(s). Empty trash in the sidebar anytime to reclaim storage space.`)
    }

    // SFTP Gateway awareness
    if (sftpKeysCount === 0) {
      insights.push({
        id: 'sftp_setup',
        priority: 75,
        text: '🖥️ Termius & SFTP Gateway: Stream your cloud vault directly to iOS, Android, macOS, or terminal on port 2222 with zero passwords.',
        category: 'sftp',
        mood: 'tour',
        badge: 'SFTP STREAMING',
        action: { label: 'Setup Termius', actionKey: 'open_termius' },
      })
      tips.push('⚡ Termius ready: Add your SSH public key in Termius / SFTP to mount Better Drive on port 2222!')
    } else {
      tips.push(`🔑 SFTP Gateway is armed with ${sftpKeysCount} authorized SSH key(s) for high-speed streaming on port 2222.`)
    }

    // Starred files awareness
    if (starredCount > 0) {
      tips.push(`⭐ You have ${starredCount} starred file(s) pinned for instant access in the Starred tab.`)
    }

    // Recent file awareness
    if (recentFile?.name) {
      const shortName =
        recentFile.name.length > 25
          ? `${recentFile.name.slice(0, 22)}...`
          : recentFile.name
      tips.push(`✨ Recent activity: '${shortName}' safely synced with AES-256 integrity.`)
    }

    // Universal pro-tips
    tips.push("💡 Pro tip: Press '/' or Ctrl+K anywhere on the dashboard to jump to Fast Global Search in <50ms!")
    tips.push('📦 Bulk actions: Select multiple files with checkboxes to download them as a unified ZIP archive!')
    tips.push('🎨 Customize Byte: Head to Settings → Mascot to choose outfits, hats, and change my color palette.')

    // Sort insights by priority descending
    insights.sort((a, b) => b.priority - a.priority)

    return {
      connectedAccountsCount,
      googleAccountsCount: googleAccounts.length,
      s3AccountsCount: s3Accounts.length,
      fileCount,
      trashCount,
      starredCount,
      folderCount,
      totalBytes,
      formattedSize,
      quotaUsedBytes: poolUsed,
      quotaTotalBytes: poolTotal,
      quotaPercent,
      duplicateCount,
      duplicateReclaimableBytes,
      formattedDuplicateReclaimable,
      deduplicatedSavingsBytes,
      formattedDedupSavings,
      sftpEnabled: sftpProfilesCount > 0,
      sftpProfilesCount,
      sftpKeysCount,
      recentFileName: recentFile?.name || null,
      primaryGreeting,
      insights,
      tips,
    }
  } catch (err) {
    console.error('Failed to generate smart live mascot telemetry:', err)
    return {
      connectedAccountsCount: 0,
      googleAccountsCount: 0,
      s3AccountsCount: 0,
      fileCount: 0,
      trashCount: 0,
      starredCount: 0,
      folderCount: 0,
      totalBytes: 0,
      formattedSize: '0 B',
      quotaUsedBytes: 0,
      quotaTotalBytes: 0,
      quotaPercent: 0,
      duplicateCount: 0,
      duplicateReclaimableBytes: 0,
      formattedDuplicateReclaimable: '0 B',
      deduplicatedSavingsBytes: 0,
      formattedDedupSavings: '0 B',
      sftpEnabled: false,
      sftpProfilesCount: 0,
      sftpKeysCount: 0,
      recentFileName: null,
      primaryGreeting: {
        text: "👋 Hi there! I'm Byte, your storage companion.",
        mood: 'happy',
      },
      insights: [],
      tips: [
        '📁 Keep your storage organized: create folders to group related project files and media!',
        '🛡️ All files are private and 100% self-hosted on your machine.',
        "💡 Pro tip: Press '/' to jump straight to Fast Global Search!",
      ],
    }
  }
}

export async function getSmartMascotTips(userId: string): Promise<string[]> {
  const telemetry = await getSmartMascotTelemetry(userId)
  return telemetry.tips
}
