// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockToggleWishlist = vi.fn()

vi.mock('@/src/domains/artists/wishlist-actions', () => ({
  toggleWishlist: (...args: unknown[]) => mockToggleWishlist(...args),
}))

import { WishlistButton } from '@/src/domains/artists/components/WishlistButton'

describe('WishlistButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the "Seguir" state when not in the wishlist', () => {
    render(<WishlistButton artistId="a1" initialInWishlist={false} />)
    expect(screen.getByRole('button', { name: 'Seguir este artista' })).toBeInTheDocument()
  })

  it('shows the "Siguiendo" state when already in the wishlist', () => {
    render(<WishlistButton artistId="a1" initialInWishlist={true} />)
    expect(screen.getByRole('button', { name: 'Dejar de seguir este artista' })).toBeInTheDocument()
  })

  it('optimistically flips state on click, then confirms it once the action resolves', async () => {
    mockToggleWishlist.mockResolvedValue({ inWishlist: true })
    render(<WishlistButton artistId="a1" initialInWishlist={false} />)

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dejar de seguir este artista' })).toBeInTheDocument()
    })
    expect(mockToggleWishlist).toHaveBeenCalledWith('a1')
  })

  it('reverts the optimistic update when the action returns an error', async () => {
    mockToggleWishlist.mockResolvedValue({ inWishlist: false, error: 'No autenticado' })
    render(<WishlistButton artistId="a1" initialInWishlist={false} />)

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Seguir este artista' })).toBeInTheDocument()
    })
  })
})
