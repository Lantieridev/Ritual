// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StarRating } from './StarRating'

describe('StarRating', () => {
  it('renders read-only spans (no buttons) when onChange is omitted', () => {
    render(<StarRating value={3} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getAllByText('★')).toHaveLength(5)
  })

  it('lights up exactly the stars up to the given value in read-only mode', () => {
    const { container } = render(<StarRating value={3} />)
    const stars = container.querySelectorAll('span')
    expect(Array.from(stars).map((s) => s.className.includes('text-ritual-red'))).toEqual([
      true,
      true,
      true,
      false,
      false,
    ])
  })

  it('renders 5 accessible buttons when onChange is provided', () => {
    render(<StarRating value={0} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '1 estrella' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3 estrellas' })).toBeInTheDocument()
  })

  it('calls onChange with the clicked star', async () => {
    const onChange = vi.fn()
    render(<StarRating value={0} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: '4 estrellas' }))

    expect(onChange).toHaveBeenCalledWith(4)
  })
})
