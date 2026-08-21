// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GenrePicker } from '@/src/domains/taste/components/GenrePicker'

const GENRES = [
  { key: 'rock-nacional', label: 'Rock Nacional' },
  { key: 'indie', label: 'Indie' },
  { key: 'pop', label: 'Pop' },
  { key: 'trap', label: 'Trap' },
  { key: 'cuarteto', label: 'Cuarteto' },
  { key: 'jazz', label: 'Jazz' },
]

describe('GenrePicker', () => {
  it('renders every genre as an unpressed chip with no hidden inputs selected', () => {
    render(<GenrePicker genres={GENRES} />)

    for (const genre of GENRES) {
      expect(screen.getByRole('button', { name: genre.label })).toHaveAttribute('aria-pressed', 'false')
    }
    expect(screen.queryAllByDisplayValue(/./)).toHaveLength(0)
  })

  it('names the chip group after the visible heading passed as labelledBy', () => {
    render(
      <>
        <p id="genres-heading">Géneros favoritos</p>
        <GenrePicker genres={GENRES} labelledBy="genres-heading" />
      </>
    )

    expect(screen.getByRole('group', { name: 'Géneros favoritos' })).toHaveAttribute('aria-labelledby', 'genres-heading')
  })

  it('toggles a chip on click, marking it pressed and mirroring it into a hidden input', async () => {
    render(<GenrePicker genres={GENRES} />)

    await userEvent.click(screen.getByRole('button', { name: 'Indie' }))

    const chip = screen.getByRole('button', { name: 'Indie' })
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    const hidden = document.querySelector('input[type="hidden"][name="genres"][value="indie"]')
    expect(hidden).not.toBeNull()
  })

  it('clicking a pressed chip again deselects it and removes its hidden input', async () => {
    render(<GenrePicker genres={GENRES} />)

    const chip = screen.getByRole('button', { name: 'Pop' })
    await userEvent.click(chip)
    await userEvent.click(chip)

    expect(chip).toHaveAttribute('aria-pressed', 'false')
    expect(document.querySelector('input[type="hidden"][name="genres"][value="pop"]')).toBeNull()
  })

  it('disables the unselected chips once 5 genres are picked, without disabling the selected ones', async () => {
    render(<GenrePicker genres={GENRES} />)

    for (const genre of GENRES.slice(0, 5)) {
      await userEvent.click(screen.getByRole('button', { name: genre.label }))
    }

    for (const genre of GENRES.slice(0, 5)) {
      expect(screen.getByRole('button', { name: genre.label })).toBeEnabled()
    }
    expect(screen.getByRole('button', { name: 'Jazz' })).toBeDisabled()
  })
})
