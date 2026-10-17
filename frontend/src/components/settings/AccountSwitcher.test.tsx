import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AccountSwitcher, type ConnectedAccountOption } from './AccountSwitcher'

function SwitcherWithRouter({
  accounts,
  onAccountChange,
  initialUrl = '/all-files',
}: {
  accounts: ConnectedAccountOption[]
  onAccountChange?: (accountId: string | null) => void
  initialUrl?: string
}) {
  return (
    <MemoryRouter initialEntries={[initialUrl]}>
      <AccountSwitcher accounts={accounts} onAccountChange={onAccountChange} />
    </MemoryRouter>
  )
}

describe('AccountSwitcher Component', () => {
  const mockAccounts: ConnectedAccountOption[] = [
    { id: 'acc-1', email: 'alice@example.com', displayName: 'Alice Google', provider: 'google', enabled: true },
    { id: 'acc-2', email: 'bob@example.com', displayName: 'Bob S3', provider: 's3', enabled: true },
    { id: 'acc-3', email: 'charlie@example.com', displayName: 'Charlie Disabled', provider: 'google', enabled: false },
  ]

  it('renders switcher with All (pooled) even when 0 or 1 account connected', () => {
    const singleAccount: ConnectedAccountOption[] = [
      { id: 'acc-1', email: 'alice@example.com', provider: 'google', enabled: true },
    ]
    render(<SwitcherWithRouter accounts={singleAccount} />)
    const button = screen.getByLabelText(/filter storage by account/i)
    expect(button).toBeDefined()
    expect(screen.getByText('All (pooled)')).toBeDefined()
  })

  it('renders dropdown options excluding disabled accounts', () => {
    render(<SwitcherWithRouter accounts={mockAccounts} />)

    const trigger = screen.getByLabelText(/filter storage by account/i)
    expect(trigger).toBeDefined()

    // Click trigger to open CustomSelect menu
    fireEvent.click(trigger)

    expect(screen.getByText('Alice Google')).toBeDefined()
    expect(screen.getByText('Bob S3')).toBeDefined()
    expect(screen.queryByText(/Charlie Disabled/i)).toBeNull()
  })

  it('calls onAccountChange and updates selection when an account is clicked', () => {
    const onAccountChange = vi.fn()
    render(<SwitcherWithRouter accounts={mockAccounts} onAccountChange={onAccountChange} />)

    const trigger = screen.getByLabelText(/filter storage by account/i)
    fireEvent.click(trigger)

    const option = screen.getByText('Bob S3')
    fireEvent.click(option)

    expect(onAccountChange).toHaveBeenCalledWith('acc-2')
  })

  it('calls onAccountChange with null when All (pooled) is clicked', () => {
    const onAccountChange = vi.fn()
    render(
      <SwitcherWithRouter
        accounts={mockAccounts}
        onAccountChange={onAccountChange}
        initialUrl="/all-files?account=acc-1"
      />
    )

    const trigger = screen.getByLabelText(/filter storage by account/i)
    fireEvent.click(trigger)

    const pooledOption = screen.getAllByText('All (pooled)')[0]
    fireEvent.click(pooledOption)

    expect(onAccountChange).toHaveBeenCalledWith(null)
  })
})
