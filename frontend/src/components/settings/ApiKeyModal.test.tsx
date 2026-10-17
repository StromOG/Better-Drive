import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ApiKeyModal } from './ApiKeyModal'

describe('ApiKeyModal Component (Part 1.5 & Part 5)', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ApiKeyModal
        isOpen={false}
        onClose={vi.fn()}
        onCreateKey={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders form and creates API key successfully', async () => {
    const onCreateKey = vi.fn().mockResolvedValue('bd_live_mocksecretkey123456789')
    const onClose = vi.fn()

    render(
      <ApiKeyModal
        isOpen={true}
        onClose={onClose}
        onCreateKey={onCreateKey}
      />
    )

    expect(screen.getByText('Create API Key')).toBeDefined()
    const input = screen.getByPlaceholderText(/Backup Script/i)

    fireEvent.change(input, { target: { value: 'My Production Key' } })
    fireEvent.click(screen.getByRole('button', { name: /create key/i }))

    await waitFor(() => {
      expect(onCreateKey).toHaveBeenCalledWith('My Production Key')
      expect(screen.getByDisplayValue('bd_live_mocksecretkey123456789')).toBeDefined()
    })

    // Now test copy button
    const copyBtn = screen.getByRole('button', { name: /copy key to clipboard/i })
    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('bd_live_mocksecretkey123456789')

    // Close button should be disabled until checkbox is checked
    const closeBtn = screen.getByRole('button', { name: /^close$/i }) as HTMLButtonElement
    expect(closeBtn.disabled).toBe(true)

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    expect(closeBtn.disabled).toBe(false)

    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('displays error if onCreateKey fails', async () => {
    const onCreateKey = vi.fn().mockRejectedValue(new Error('Label already exists'))

    render(
      <ApiKeyModal
        isOpen={true}
        onClose={vi.fn()}
        onCreateKey={onCreateKey}
      />
    )

    const input = screen.getByPlaceholderText(/Backup Script/i)
    fireEvent.change(input, { target: { value: 'Existing Key' } })
    fireEvent.click(screen.getByRole('button', { name: /create key/i }))

    await waitFor(() => {
      expect(screen.getByText('Label already exists')).toBeDefined()
    })
  })
})
