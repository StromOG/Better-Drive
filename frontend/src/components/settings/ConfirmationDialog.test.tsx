import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmationDialog } from './ConfirmationDialog'

describe('ConfirmationDialog Component (Part 1.5 & Part 5)', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ConfirmationDialog
        isOpen={false}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders title, description, and default button labels when open', () => {
    render(
      <ConfirmationDialog
        isOpen={true}
        title="Revoke Invitation"
        description="This action cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Revoke Invitation')).toBeDefined()
    expect(screen.getByText('This action cannot be undone.')).toBeDefined()
    expect(screen.getByText('Cancel')).toBeDefined()
    expect(screen.getByText('Confirm')).toBeDefined()
  })

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmationDialog
        isOpen={true}
        title="Confirm Action"
        description="Test desc"
        confirmLabel="Yes, Delete"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Yes, Delete'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when cancel or close button clicked', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmationDialog
        isOpen={true}
        title="Confirm Action"
        description="Test desc"
        cancelLabel="Nevermind"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )

    fireEvent.click(screen.getByText('Nevermind'))
    expect(onCancel).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText(/close dialog/i))
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('handles loading state properly', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmationDialog
        isOpen={true}
        title="Processing Task"
        description="Please wait"
        isLoading={true}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Processing...')).toBeDefined()
    const confirmBtn = screen.getByText('Processing...') as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)

    const cancelBtn = screen.getByText('Cancel') as HTMLButtonElement
    expect(cancelBtn.disabled).toBe(true)
  })
})
