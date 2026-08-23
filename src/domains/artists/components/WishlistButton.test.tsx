// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockToggleWishlist = vi.fn()

vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return { ...actual, useMutation: () => [{ fetching: false }, mockToggleWishlist] }
})

import { WishlistButton } from '@/src/domains/artists/components/WishlistButton'
import { TRANSPORT_ERROR_MESSAGE } from '@/src/graphql/mutation-result'
import { transportError } from '@/src/graphql/transport-failure.testing'

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
    mockToggleWishlist.mockResolvedValue({ data: { toggleWishlist: { inWishlist: true } } })
    render(<WishlistButton artistId="a1" initialInWishlist={false} />)

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dejar de seguir este artista' })).toBeInTheDocument()
    })
    expect(mockToggleWishlist).toHaveBeenCalledWith({ artistId: 'a1' })
  })

  it('reverts the optimistic update when the action returns an error', async () => {
    mockToggleWishlist.mockResolvedValue({
      data: { toggleWishlist: { inWishlist: false, error: 'No autenticado' } },
    })
    render(<WishlistButton artistId="a1" initialInWishlist={false} />)

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Seguir este artista' })).toBeInTheDocument()
    })
  })

  // The button rolled back correctly on failure, but never told the user
  // WHY — the star just silently flipped back with zero explanation.
  it('shows the error message when the action fails, not just a silent rollback', async () => {
    mockToggleWishlist.mockResolvedValue({
      data: { toggleWishlist: { inWishlist: false, error: 'No autenticado' } },
    })
    render(<WishlistButton artistId="a1" initialInWishlist={false} />)

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('No autenticado')
    })
  })

  it('rolls back the optimistic star and shows an error when the request never reaches the resolver', async () => {
    mockToggleWishlist.mockResolvedValue({ data: undefined, error: transportError() })
    render(<WishlistButton artistId="a1" initialInWishlist={false} />)

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(TRANSPORT_ERROR_MESSAGE)
    })
    expect(screen.getByRole('button', { name: 'Seguir este artista' })).toBeInTheDocument()
  })
})
