import { useState } from 'react'
import {
  Check,
  Cloud,
  Edit2,
  HardDrive,
  Power,
  RefreshCw,
  Unlink,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatBytes } from '@/lib/api'
import { ConfirmationDialog } from './ConfirmationDialog'

export interface ConnectedAccountData {
  id: string
  provider: string
  email: string
  displayName?: string | null
  enabled: boolean
  revokedAt?: string | null
  status: string
  createdAt: string
  s3StorageConfig?: {
    bucket: string
    region: string
    endpoint?: string | null
  } | null
  storageAccount?: {
    usedBytes: string
    totalBytes?: string | null
    availableBytes?: string | null
    lastSyncedAt?: string | null
  } | null
}

export interface AccountCardProps {
  account: ConnectedAccountData
  onRename: (id: string, newLabel: string) => Promise<void>
  onToggleEnabled: (id: string, enabled: boolean) => Promise<void>
  onReauth: (id: string) => Promise<void>
  onDisconnect: (id: string) => Promise<void>
}

export function AccountCard({
  account,
  onRename,
  onToggleEnabled,
  onReauth,
  onDisconnect,
}: AccountCardProps) {
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [labelVal, setLabelVal] = useState(account.displayName || account.email)
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)

  const used = Number(account.storageAccount?.usedBytes || 0)
  const total = Number(account.storageAccount?.totalBytes || 0)
  const percentUsed = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0

  const isRevoked = Boolean(account.revokedAt) || account.status === 'disconnected'
  const isHealthy = !isRevoked && account.status === 'connected'

  const handleSaveLabel = async () => {
    if (!labelVal.trim()) return
    setIsActionLoading(true)
    try {
      await onRename(account.id, labelVal.trim())
      setIsEditingLabel(false)
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleConfirmDisconnect = async () => {
    setIsActionLoading(true)
    try {
      await onDisconnect(account.id)
    } finally {
      setIsActionLoading(false)
      setIsDisconnectDialogOpen(false)
    }
  }

  return (
    <div className={`rounded-xl border p-5 transition bg-white dark:bg-neutral-900 ${
      !account.enabled
        ? 'border-neutral-200 dark:border-neutral-800 opacity-60'
        : isRevoked
          ? 'border-amber-300 dark:border-amber-800/60 shadow-sm'
          : 'border-neutral-200 dark:border-neutral-800 shadow-sm hover:border-neutral-300 dark:hover:border-neutral-700'
    }`}>
      {/* Header: Provider Icon, Label & Health Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
            {account.provider === 'google_drive' ? <Cloud className="w-5 h-5" /> : <HardDrive className="w-5 h-5" />}
          </div>
          <div>
            {isEditingLabel ? (
              <div className="flex items-center gap-2">
                <Input
                  value={labelVal}
                  onChange={(e) => setLabelVal(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveLabel} disabled={isActionLoading} className="h-8 px-2.5">
                  <Check className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {account.displayName || account.email}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsEditingLabel(true)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition"
                  aria-label="Rename account"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            )}
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {account.provider.toUpperCase()} &bull; {account.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRevoked ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              <AlertTriangle className="w-3 h-3" />
              Reauth Required
            </span>
          ) : isHealthy ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <CheckCircle2 className="w-3 h-3" />
              Healthy
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
              <AlertCircle className="w-3 h-3" />
              Error
            </span>
          )}

          {!account.enabled && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              Disabled
            </span>
          )}
        </div>
      </div>

      {/* S3 Details (No credentials shown) */}
      {account.s3StorageConfig && (
        <div className="mt-3.5 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 text-xs text-neutral-500 dark:text-neutral-400 flex flex-wrap gap-x-4 gap-y-1">
          <div>
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Bucket:</span> {account.s3StorageConfig.bucket}
          </div>
          <div>
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Region:</span> {account.s3StorageConfig.region}
          </div>
          {account.s3StorageConfig.endpoint && (
            <div>
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Endpoint:</span> {account.s3StorageConfig.endpoint}
            </div>
          )}
        </div>
      )}

      {/* Quota bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400 mb-1.5">
          <span>{formatBytes(used)} used</span>
          <span>{total > 0 ? `${formatBytes(total)} total (${percentUsed}%)` : 'Unlimited'}</span>
        </div>
        <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              percentUsed > 90 ? 'bg-red-500' : percentUsed > 75 ? 'bg-amber-500' : 'bg-blue-600 dark:bg-blue-500'
            }`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>
      </div>

      {/* Sync timestamp & actions */}
      <div className="mt-5 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
        <span className="text-[11px] text-neutral-400">
          Last sync:{' '}
          {account.storageAccount?.lastSyncedAt
            ? new Date(account.storageAccount.lastSyncedAt).toLocaleString()
            : 'Never'}
        </span>

        <div className="flex items-center gap-2">
          {/* Enable / Disable Toggle */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onToggleEnabled(account.id, !account.enabled)}
            disabled={isActionLoading}
            className="h-8 px-2.5 text-xs"
          >
            <Power className={`w-3.5 h-3.5 mr-1 ${account.enabled ? 'text-emerald-500' : 'text-neutral-400'}`} />
            <span>{account.enabled ? 'Enabled' : 'Disabled'}</span>
          </Button>

          {/* Reauth */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onReauth(account.id)}
            disabled={isActionLoading}
            className="h-8 px-2.5 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            <span>Reauth</span>
          </Button>

          {/* Disconnect */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsDisconnectDialogOpen(true)}
            disabled={isActionLoading}
            className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            <Unlink className="w-3.5 h-3.5 mr-1" />
            <span className="text-xs">Disconnect</span>
          </Button>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={isDisconnectDialogOpen}
        title="Disconnect Account"
        description={`Are you sure you want to disconnect ${account.displayName || account.email}? All your files will remain stored safely, but write operations to this account will be paused until re-authenticated.`}
        confirmLabel="Disconnect"
        isDestructive={true}
        isLoading={isActionLoading}
        onConfirm={handleConfirmDisconnect}
        onCancel={() => setIsDisconnectDialogOpen(false)}
      />
    </div>
  )
}
