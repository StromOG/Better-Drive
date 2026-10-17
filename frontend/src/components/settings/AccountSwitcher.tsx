import { useSearchParams, useNavigate } from 'react-router-dom'
import { HardDrive, Plus, Cloud } from 'lucide-react'
import { CustomSelect } from '@/components/ui/select'

export interface ConnectedAccountOption {
  id: string
  displayName?: string | null
  email: string
  provider: string
  enabled?: boolean
}

export interface AccountSwitcherProps {
  accounts: ConnectedAccountOption[]
  className?: string
  onAccountChange?: (accountId: string | null) => void
}

export function AccountSwitcher({
  accounts = [],
  className = '',
  onAccountChange,
}: AccountSwitcherProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // Only enabled accounts appear in the switcher
  const enabledAccounts = accounts.filter((acc) => acc.enabled !== false)
  const currentAccountId = searchParams.get('account') || searchParams.get('accountId') || ''

  const selectOptions = [
    {
      value: '',
      label: 'All (pooled)',
      description: enabledAccounts.length > 0 ? `${enabledAccounts.length} connected` : 'Unified VFS',
      icon: <HardDrive className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />,
    },
    ...enabledAccounts.map((acc) => {
      const label = acc.displayName || acc.email || acc.id
      return {
        value: acc.id,
        label,
        description: acc.provider.toUpperCase(),
        icon: <Cloud className="w-3.5 h-3.5 text-slate-400 shrink-0" />,
      }
    }),
    {
      value: '__manage__',
      label: '+ Connect / Manage',
      description: 'Storage Gateway',
      icon: <Plus className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />,
    },
  ]

  return (
    <div className={`relative inline-flex items-center min-w-[160px] sm:min-w-[180px] ${className}`}>
      <CustomSelect
        size="sm"
        value={currentAccountId}
        onChange={(val) => {
          if (val === '__manage__') {
            navigate('/settings/accounts')
            return
          }
          const nextParams = new URLSearchParams(searchParams)
          if (val) {
            nextParams.set('account', val)
          } else {
            nextParams.delete('account')
            nextParams.delete('accountId')
          }
          setSearchParams(nextParams, { replace: true })
          onAccountChange?.(val || null)
        }}
        options={selectOptions}
        aria-label="Filter storage by account"
      />
    </div>
  )
}
