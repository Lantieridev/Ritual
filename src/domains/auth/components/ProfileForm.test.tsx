// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const executeMutation = vi.fn()
const uploadAvatar = vi.fn()
const refresh = vi.fn()

vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return { ...actual, useMutation: () => [{ fetching: false }, executeMutation] }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

vi.mock('@/src/domains/auth/avatar-actions', () => ({
  uploadAvatar: (...args: unknown[]) => uploadAvatar(...args),
}))

import { ProfileForm } from '@/src/domains/auth/components/ProfileForm'
import { TRANSPORT_ERROR_MESSAGE } from '@/src/graphql/mutation-result'
import { transportError } from '@/src/graphql/transport-failure.testing'
import type { Profile } from '@/src/core/types'

const user = { id: 'u1', email: 'martin@example.com' }
const profile: Profile = {
  id: 'u1',
  username: 'martin_dev',
  full_name: 'Martin',
  avatar_url: 'https://cdn.test/old.png',
  website: 'https://example.com',
  bio: 'Fan del rock',
  location: 'CABA',
}

function makeFile(name: string, type: string): File {
  return new File([new Uint8Array(16)], name, { type })
}

describe('ProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    executeMutation.mockResolvedValue({ data: { updateProfile: { error: null } } })
    global.URL.createObjectURL = vi.fn(() => 'blob:preview')
  })

  it('pre-fills the form from the existing profile', () => {
    render(<ProfileForm user={user} profile={profile} />)

    expect(screen.getByLabelText('Nombre Completo')).toHaveValue('Martin')
    expect(screen.getByLabelText('Nombre de Usuario')).toHaveValue('martin_dev')
    expect(screen.getByLabelText('Biografía')).toHaveValue('Fan del rock')
  })

  it('submits the text fields without an avatar URL when no new image was chosen', async () => {
    render(<ProfileForm user={user} profile={profile} />)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    await waitFor(() => {
      expect(executeMutation).toHaveBeenCalledWith({
        input: {
          fullName: 'Martin',
          username: 'martin_dev',
          bio: 'Fan del rock',
          website: 'https://example.com',
          location: 'CABA',
          avatarUrl: undefined,
        },
      })
    })
    expect(uploadAvatar).not.toHaveBeenCalled()
  })

  // El archivo no puede viajar por GraphQL (sin scalar Upload): lo sube la
  // Server Action y solo la URL entra en el mismo upsert que el texto.
  it('uploads a chosen avatar first and sends the resulting URL in the same mutation', async () => {
    uploadAvatar.mockResolvedValue({ avatarUrl: 'https://cdn.test/new.png' })
    render(<ProfileForm user={user} profile={profile} />)

    await userEvent.upload(screen.getByLabelText('Foto de Perfil'), makeFile('a.png', 'image/png'))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    await waitFor(() => expect(uploadAvatar).toHaveBeenCalledTimes(1))
    await waitFor(() => {
      expect(executeMutation).toHaveBeenCalledWith({
        input: expect.objectContaining({ avatarUrl: 'https://cdn.test/new.png' }),
      })
    })
  })

  it('does not write the profile at all when the avatar upload fails', async () => {
    uploadAvatar.mockResolvedValue({ error: 'Error al subir la imagen.' })
    render(<ProfileForm user={user} profile={profile} />)

    await userEvent.upload(screen.getByLabelText('Foto de Perfil'), makeFile('a.png', 'image/png'))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Error al subir la imagen.')
    })
    expect(executeMutation).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Guardar Cambios' })).toBeEnabled()
  })

  it('shows the business error returned by the resolver', async () => {
    executeMutation.mockResolvedValue({
      data: { updateProfile: { error: 'Ese nombre de usuario ya está en uso.' } },
    })
    render(<ProfileForm user={user} profile={profile} />)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ese nombre de usuario ya está en uso.')
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('confirms the save and refreshes the route on success', async () => {
    render(<ProfileForm user={user} profile={profile} />)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Perfil actualizado correctamente.')
    })
    expect(refresh).toHaveBeenCalled()
  })

  it('reports an error instead of a save when the request never reaches the resolver', async () => {
    executeMutation.mockResolvedValue({ data: undefined, error: transportError() })
    render(<ProfileForm user={user} profile={profile} />)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(TRANSPORT_ERROR_MESSAGE)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })
})
