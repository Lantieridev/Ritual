// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WrappedStories } from './WrappedStories'

vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,mock')
}))

describe('WrappedStories', () => {
  const slides = [
    { kind: 'cover' as const, content: <div>Slide 1</div> },
    { kind: 'shows' as const, content: <div>Slide 2</div> }
  ]

  it('renders story content and navigation buttons including Descargar', () => {
    render(<WrappedStories slides={slides} handle="testuser" />)
    
    expect(screen.getByText('Slide 1')).toBeInTheDocument()
    expect(screen.getByText('@testuser')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descargar' })).toBeInTheDocument()
  })

  it('triggers download when Descargar button is clicked', async () => {
    render(<WrappedStories slides={slides} handle="testuser" />)

    const downloadButton = screen.getByRole('button', { name: 'Descargar' })
    await userEvent.click(downloadButton)

    const { toPng } = await import('html-to-image')
    expect(toPng).toHaveBeenCalled()
  })

  it('shows a visible error message when the export fails, instead of failing silently', async () => {
    const { toPng } = await import('html-to-image')
    vi.mocked(toPng).mockRejectedValueOnce(new Error('tainted canvas'))

    render(<WrappedStories slides={slides} handle="testuser" />)

    const downloadButton = screen.getByRole('button', { name: 'Descargar' })
    await userEvent.click(downloadButton)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo descargar la imagen. Probá de nuevo.'
    )
  })
})
