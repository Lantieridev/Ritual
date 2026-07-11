// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from '@/src/core/components/ui/Card'

describe('Card', () => {
  it('renders its children', () => {
    render(<Card>Contenido</Card>)
    expect(screen.getByText('Contenido')).toBeInTheDocument()
  })

  it('merges a custom className with its base styles', () => {
    render(<Card className="mt-4">Contenido</Card>)
    const el = screen.getByText('Contenido')
    expect(el).toHaveClass('mt-4')
    expect(el).toHaveClass('rounded-xl')
  })
})
