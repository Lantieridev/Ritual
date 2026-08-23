// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const push = vi.fn()
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push }),
}))

const createFestivalMock = vi.fn()
vi.mock('urql', async () => {
    const actual = await vi.importActual<typeof import('urql')>('urql')
    return { ...actual, useMutation: () => [{ fetching: false }, createFestivalMock] }
})

import NuevoFestivalPage from '@/app/festivals/nuevo/page'
import { TRANSPORT_ERROR_MESSAGE } from '@/src/graphql/mutation-result'
import { transportError } from '@/src/graphql/transport-failure.testing'

async function fillAndSubmit() {
    await userEvent.type(screen.getByLabelText(/Nombre del festival/), 'Lollapalooza')
    await userEvent.type(screen.getByLabelText(/Fecha de inicio/), '2026-03-20')
    await userEvent.click(screen.getByRole('button', { name: 'Crear festival' }))
}

describe('NuevoFestivalPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        createFestivalMock.mockResolvedValue({ data: { createFestival: { id: 'f-new' } } })
    })

    it('navigates to the new festival once creation succeeds', async () => {
        render(<NuevoFestivalPage />)
        await fillAndSubmit()

        await waitFor(() => expect(push).toHaveBeenCalledWith('/festivals/f-new'))
    })

    it('shows the resolver error and stays on the page when creation is rejected', async () => {
        createFestivalMock.mockResolvedValue({
            data: { createFestival: { error: 'Ya existe un registro con esos datos.' } },
        })
        render(<NuevoFestivalPage />)
        await fillAndSubmit()

        await waitFor(() => {
            expect(screen.getByText('Ya existe un registro con esos datos.')).toBeInTheDocument()
        })
        expect(push).not.toHaveBeenCalled()
    })

    it('stays on the page and surfaces an error when the request never reaches the resolver', async () => {
        createFestivalMock.mockResolvedValue({ data: undefined, error: transportError() })
        render(<NuevoFestivalPage />)
        await fillAndSubmit()

        await waitFor(() => {
            expect(screen.getByText(TRANSPORT_ERROR_MESSAGE)).toBeInTheDocument()
        })
        expect(push).not.toHaveBeenCalled()
    })
})
