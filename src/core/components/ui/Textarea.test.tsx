// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Textarea } from '@/src/core/components/ui/Textarea'

describe('Textarea', () => {
  it('renders a label associated with the textarea via id', () => {
    render(<Textarea id="bio" label="Bio" />)
    expect(screen.getByLabelText('Bio')).toBeInTheDocument()
  })

  it('shows the error message and applies error styling', () => {
    render(<Textarea id="bio" error="Muy larga" />)
    expect(screen.getByText('Muy larga')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveClass('border-red-500')
  })

  it('forwards typing to the underlying textarea', async () => {
    const onChange = vi.fn()
    render(<Textarea id="bio" onChange={onChange} />)

    await userEvent.type(screen.getByRole('textbox'), 'Fan del rock')

    expect(onChange).toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveValue('Fan del rock')
  })

  it('forwards a ref to the underlying textarea element', () => {
    let ref: HTMLTextAreaElement | null = null
    render(
      <Textarea
        id="bio"
        ref={(el) => {
          ref = el
        }}
      />
    )
    expect(ref).toBeInstanceOf(HTMLTextAreaElement)
  })
})
