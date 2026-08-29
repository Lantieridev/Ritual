// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const executeMutation = vi.fn()

vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return { ...actual, useMutation: () => [{ fetching: false }, executeMutation] }
})

import { OnboardingTour } from '@/src/domains/auth/components/OnboardingTour'
import { TRANSPORT_ERROR_MESSAGE } from '@/src/graphql/mutation-result'
import { transportError } from '@/src/graphql/transport-failure.testing'

describe('OnboardingTour', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    executeMutation.mockResolvedValue({
      data: { completeOnboarding: { success: true, error: null } },
    })
  })

  it('se renderiza en el paso 1 con el contenido correcto', () => {
    render(<OnboardingTour />)

    expect(screen.getByRole('dialog', { name: 'Tour de bienvenida' })).toBeInTheDocument()
    expect(screen.getByText('Bienvenido a Ritual')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Tu archivo personal de recitales: cada show que fuiste, con fecha, sede y cómo te sentiste esa noche.'
      )
    ).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anterior' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Saltear' })).toBeInTheDocument()
  })

  it('Siguiente avanza los pasos y Anterior retrocede', async () => {
    render(<OnboardingTour />)

    // Avanza al paso 2
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Buscá o cargá a mano')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeInTheDocument()

    // Avanza al paso 3
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Marcá tu asistencia')).toBeInTheDocument()

    // Retrocede al paso 2
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(screen.getByText('Buscá o cargá a mano')).toBeInTheDocument()
  })

  it('en el paso 4 el botón dice Empezar y no Siguiente', async () => {
    render(<OnboardingTour />)

    // Avanza hasta el paso 4
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(screen.getByText('Explorá tu historial')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()
  })

  it('Saltear en cualquier paso ejecuta la mutation y oculta el panel', async () => {
    render(<OnboardingTour />)

    await userEvent.click(screen.getByRole('button', { name: 'Saltear' }))

    await waitFor(() => {
      expect(executeMutation).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('terminar el paso 4 ejecuta la mutation y oculta el panel', async () => {
    render(<OnboardingTour />)

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }))

    await waitFor(() => {
      expect(executeMutation).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Escape cierra el panel ejecutando la mutation', async () => {
    render(<OnboardingTour />)

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => {
      expect(executeMutation).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('un error de la mutation no deja al usuario sin forma de cerrar el panel', async () => {
    executeMutation.mockResolvedValue({ data: undefined, error: transportError() })

    render(<OnboardingTour />)

    // Intenta saltear el tour
    await userEvent.click(screen.getByRole('button', { name: 'Saltear' }))

    // Muestra el mensaje de error de transporte
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(TRANSPORT_ERROR_MESSAGE)
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // El usuario aún puede cerrar el panel al hacer clic en Saltear nuevamente
    await userEvent.click(screen.getByRole('button', { name: 'Saltear' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
