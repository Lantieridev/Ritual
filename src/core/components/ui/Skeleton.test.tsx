// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton } from '@/src/core/components/ui/Skeleton'

describe('Skeleton', () => {
  it('renders a pulsing placeholder div', () => {
    const { container } = render(<Skeleton data-testid="skel" />)
    expect(container.firstChild).toHaveClass('animate-pulse')
  })

  it('merges a custom className with its base styles', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />)
    expect(container.firstChild).toHaveClass('h-4')
    expect(container.firstChild).toHaveClass('animate-pulse')
  })

  it('forwards arbitrary HTML attributes', () => {
    const { getByTestId } = render(<Skeleton data-testid="skel" />)
    expect(getByTestId('skel')).toBeInTheDocument()
  })
})
