// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

const mutationsByOperation: Record<string, ReturnType<typeof vi.fn>> = {}
function operationNameOf(doc: string): string {
  return doc.match(/(?:mutation|query)\s+(\w+)/)?.[1] ?? ''
}

const mockQuery = vi.fn()

vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return {
    ...actual,
    useMutation: (doc: string) => {
      const name = operationNameOf(doc)
      return [{ fetching: false }, mutationsByOperation[name]]
    },
    useClient: () => ({ query: mockQuery }),
  }
})

import { ModerationActions } from './ModerationActions'

/**
 * `confirm()` bloquea el flujo real de aprobar/fusionar — se stubea para no
 * depender de un diálogo nativo del navegador en jsdom.
 */
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('confirm', vi.fn(() => true))
  mutationsByOperation.ApproveArtist = vi.fn()
  mutationsByOperation.ApproveVenue = vi.fn()
  mutationsByOperation.ApproveEvent = vi.fn()
  mutationsByOperation.MergeArtists = vi.fn()
  mutationsByOperation.MergeVenues = vi.fn()
  mutationsByOperation.MergeEvents = vi.fn()
})

describe('ModerationActions — aprobar', () => {
  it('aprueba y refresca cuando la mutation devuelve success', async () => {
    mutationsByOperation.ApproveArtist.mockResolvedValue({ data: { approveArtist: { success: true, error: null } } })

    render(<ModerationActions entityType="artists" id="a1" name="Bandalos Chinos" />)
    await userEvent.click(screen.getByText('✓ Aprobar'))

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
    expect(mutationsByOperation.ApproveArtist).toHaveBeenCalledWith({ id: 'a1' })
  })

  it('muestra el error del backend y NO refresca cuando la mutation falla', async () => {
    mutationsByOperation.ApproveVenue.mockResolvedValue({
      data: { approveVenue: { success: false, error: 'Ya fue aprobado por otro moderador.' } },
    })

    render(<ModerationActions entityType="venues" id="v1" name="Teatro Vorterix" />)
    await userEvent.click(screen.getByText('✓ Aprobar'))

    expect(await screen.findByText('Ya fue aprobado por otro moderador.')).toBeInTheDocument()
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('muestra un mensaje cuando la mutation entera falla a nivel red/GraphQL', async () => {
    mutationsByOperation.ApproveEvent.mockResolvedValue({ data: null, error: { message: 'Network error' } })

    render(<ModerationActions entityType="events" id="e1" name="Recital sin nombre" />)
    await userEvent.click(screen.getByText('✓ Aprobar'))

    expect(await screen.findByText('Network error')).toBeInTheDocument()
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('no llama a la mutation si el moderador cancela la confirmación', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false))
    render(<ModerationActions entityType="artists" id="a1" name="Bandalos Chinos" />)

    await userEvent.click(screen.getByText('✓ Aprobar'))

    expect(mutationsByOperation.ApproveArtist).not.toHaveBeenCalled()
  })
})

describe('ModerationActions — fusionar', () => {
  it('busca destinos vía mergeTargets a partir de 2 caracteres, con el entityType y excludeId correctos', async () => {
    mockQuery.mockReturnValue({
      toPromise: () => Promise.resolve({ data: { mergeTargets: [{ id: 't1', name: 'Bandalos Chinos', detail: 'Rock' }] } }),
    })

    render(<ModerationActions entityType="artists" id="a1" name="Bandalos Chinoss" />)
    await userEvent.click(screen.getByText('Fusionar...'))

    const input = screen.getByPlaceholderText('Buscar destino por nombre...')
    fireEvent.change(input, { target: { value: 'Ba' } })

    await waitFor(() =>
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('mergeTargets'),
        { entityType: 'artists', query: 'Ba', excludeId: 'a1' }
      )
    )
    expect(await screen.findByText('Bandalos Chinos')).toBeInTheDocument()
  })

  it('no busca con menos de 2 caracteres', async () => {
    render(<ModerationActions entityType="artists" id="a1" name="Test" />)
    await userEvent.click(screen.getByText('Fusionar...'))

    fireEvent.change(screen.getByPlaceholderText('Buscar destino por nombre...'), { target: { value: 'B' } })

    await new Promise((r) => setTimeout(r, 300))
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('confirma la fusión con el target elegido y refresca al tener éxito', async () => {
    mockQuery.mockReturnValue({
      toPromise: () => Promise.resolve({ data: { mergeTargets: [{ id: 't1', name: 'Divididos', detail: null }] } }),
    })
    mutationsByOperation.MergeArtists.mockResolvedValue({ data: { mergeArtists: { success: true, error: null } } })

    render(<ModerationActions entityType="artists" id="a1" name="Dividido" />)
    await userEvent.click(screen.getByText('Fusionar...'))
    fireEvent.change(screen.getByPlaceholderText('Buscar destino por nombre...'), { target: { value: 'Div' } })
    await userEvent.click(await screen.findByText('Divididos'))
    await userEvent.click(screen.getByText('Confirmar'))

    expect(mutationsByOperation.MergeArtists).toHaveBeenCalledWith({ sourceId: 'a1', targetId: 't1' })
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
  })

  it('muestra el error y se queda en modo fusión cuando el merge falla', async () => {
    mockQuery.mockReturnValue({
      toPromise: () => Promise.resolve({ data: { mergeTargets: [{ id: 't1', name: 'Divididos', detail: null }] } }),
    })
    mutationsByOperation.MergeArtists.mockResolvedValue({
      data: { mergeArtists: { success: false, error: 'No se puede fusionar una entidad consigo misma.' } },
    })

    render(<ModerationActions entityType="artists" id="a1" name="Dividido" />)
    await userEvent.click(screen.getByText('Fusionar...'))
    fireEvent.change(screen.getByPlaceholderText('Buscar destino por nombre...'), { target: { value: 'Div' } })
    await userEvent.click(await screen.findByText('Divididos'))
    await userEvent.click(screen.getByText('Confirmar'))

    expect(await screen.findByText('No se puede fusionar una entidad consigo misma.')).toBeInTheDocument()
    expect(mockRefresh).not.toHaveBeenCalled()
    expect(screen.getByText('Confirmar')).toBeInTheDocument()
  })

  it('el botón Confirmar arranca deshabilitado hasta elegir un destino', async () => {
    render(<ModerationActions entityType="artists" id="a1" name="Test" />)
    await userEvent.click(screen.getByText('Fusionar...'))

    expect(screen.getByText('Confirmar')).toBeDisabled()
  })

  it('Cancelar vuelve a la vista de aprobar/fusionar y limpia la búsqueda', async () => {
    render(<ModerationActions entityType="artists" id="a1" name="Test" />)
    await userEvent.click(screen.getByText('Fusionar...'))
    await userEvent.click(screen.getByText('Cancelar'))

    expect(screen.getByText('✓ Aprobar')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Buscar destino por nombre...')).not.toBeInTheDocument()
  })
})
