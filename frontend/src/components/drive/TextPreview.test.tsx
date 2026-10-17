import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CodePreview } from './TextPreview'

describe('TextPreview Component XSS Immunity (Part 2.1)', () => {
  it('renders script tag as text, not executable DOM', () => {
    const content = '<script>alert(1)</script>'
    const { container } = render(<CodePreview content={content} />)

    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('<script>alert(1)</script>')
  })
})
