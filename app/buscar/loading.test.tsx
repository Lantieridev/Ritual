// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import BuscarLoading from '@/app/buscar/loading'

describe('BuscarLoading', () => {
  it('uses ritual design tokens instead of the pre-redesign neutral-950/white skeleton styling', () => {
    const { container } = render(<BuscarLoading />)
    const html = container.innerHTML

    expect(html).not.toMatch(/neutral-950/)
    expect(html).not.toMatch(/bg-white\//)
    expect(html).toMatch(/bg-ritual-bg/)
    expect(html).toMatch(/bg-ritual-surface-high/)
  })
})
