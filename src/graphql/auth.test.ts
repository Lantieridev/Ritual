import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/auth/service', () => ({
  findProfile: vi.fn(),
  modifyProfile: vi.fn(),
  assignUserRole: vi.fn(),
  completeOnboarding: vi.fn(),
}))

const mocks = vi.hoisted(() => ({
  rpc: vi.fn().mockResolvedValue({ data: 'usuario', error: null }),
}))
export const mockRpc = mocks.rpc

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    rpc: mocks.rpc
  }),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue(null),
}))

import { findProfile, modifyProfile, assignUserRole, completeOnboarding } from '@/src/domains/auth/service'
import { getCurrentUserId } from '@/src/core/auth/session'
import { POST } from '@/app/api/graphql/route'

async function query(source: string) {
  const response = await POST(
    new Request('http://localhost/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: source }),
    })
  )
  return response.json()
}

describe('auth GraphQL schema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves "me" for the current session, no id argument needed', async () => {
    vi.mocked(findProfile).mockResolvedValue({ id: 'u1', username: 'martin', bio: null })

    const body = await query('{ me { id username } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ me: { id: 'u1', username: 'martin' } })
    expect(findProfile).toHaveBeenCalledWith()
  })

  it('expone onboardingCompletedAt tal cual, sin transformar', async () => {
    vi.mocked(findProfile).mockResolvedValue({
      id: 'u1',
      username: 'martin',
      bio: null,
      onboarding_completed_at: '2026-08-29T00:00:00.000Z',
    })

    const body = await query('{ me { onboardingCompletedAt } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ me: { onboardingCompletedAt: '2026-08-29T00:00:00.000Z' } })
  })

  it('onboardingCompletedAt es null para quien todavía no vio el tour', async () => {
    vi.mocked(findProfile).mockResolvedValue({ id: 'u1', username: 'martin', bio: null, onboarding_completed_at: null })

    const body = await query('{ me { onboardingCompletedAt } }')

    expect(body.data).toEqual({ me: { onboardingCompletedAt: null } })
  })

  it('resolves "me" as null when there is no session', async () => {
    vi.mocked(findProfile).mockResolvedValue(null)

    const body = await query('{ me { id } }')

    expect(body.data).toEqual({ me: null })
  })

  it('resolves another user\'s profile by id', async () => {
    vi.mocked(findProfile).mockResolvedValue({ id: 'u2', username: 'otra', bio: null, role: 'usuario' })

    const body = await query('{ profile(id: "u2") { username } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ profile: { username: 'otra' } })
    expect(findProfile).toHaveBeenCalledWith('u2')
  })

  it('resolves role on me query (viewer is the profile owner)', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('u1')
    mockRpc.mockResolvedValue({ data: 'moderador', error: null })
    vi.mocked(findProfile).mockResolvedValue({ id: 'u1', username: 'martin', bio: null, role: 'moderador' })

    const body = await query('{ me { role } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ me: { role: 'moderador' } })
  })

  it('hides another user\'s role from a non-admin viewer, to prevent privileged-account enumeration', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('u1')
    mockRpc.mockResolvedValue({ data: 'usuario', error: null })
    vi.mocked(findProfile).mockResolvedValue({ id: 'u2', username: 'otra', bio: null, role: 'admin' })

    const body = await query('{ profile(id: "u2") { username role } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ profile: { username: 'otra', role: null } })
  })

  it('reveals another user\'s role to an admin viewer', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('u1')
    mockRpc.mockResolvedValue({ data: 'admin', error: null })
    vi.mocked(findProfile).mockResolvedValue({ id: 'u2', username: 'otra', bio: null, role: 'moderador' })

    const body = await query('{ profile(id: "u2") { username role } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ profile: { username: 'otra', role: 'moderador' } })
  })
})

describe('auth GraphQL mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates the profile, mapping camelCase input to the domain snake_case shape', async () => {
    vi.mocked(modifyProfile).mockResolvedValue({})

    const body = await query(`mutation {
      updateProfile(input: { fullName: "Martin", username: "martin_dev" }) { success error }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ updateProfile: { success: true, error: null } })
    expect(modifyProfile).toHaveBeenCalledWith({
      full_name: 'Martin',
      username: 'martin_dev',
      bio: undefined,
      website: undefined,
      location: undefined,
      avatar_url: undefined,
    })
  })

  // El avatar entra como URL ya subida al bucket por la Server Action — el
  // archivo en sí no puede viajar por el schema sin un scalar Upload.
  it('carries an already-uploaded avatar URL into the same profile upsert', async () => {
    vi.mocked(modifyProfile).mockResolvedValue({})

    await query(`mutation {
      updateProfile(input: { username: "martin_dev", avatarUrl: "https://cdn.test/a.png" }) { success error }
    }`)

    expect(modifyProfile).toHaveBeenCalledWith(
      expect.objectContaining({ avatar_url: 'https://cdn.test/a.png' })
    )
  })

  it('reports failure through success:false, not a thrown GraphQL error', async () => {
    vi.mocked(modifyProfile).mockResolvedValue({ error: 'Ese nombre de usuario ya está en uso.' })

    const body = await query('mutation { updateProfile(input: { username: "taken" }) { success error } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      updateProfile: { success: false, error: 'Ese nombre de usuario ya está en uso.' },
    })
  })

  it('rejects assignRole if caller is not admin', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
    mockRpc.mockResolvedValue({ data: 'moderador', error: null })

    const body = await query('mutation { assignRole(userId: "target", role: "admin") { success error } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      assignRole: { success: false, error: 'No tenés permisos para realizar esta acción.' },
    })
    expect(assignUserRole).not.toHaveBeenCalled()
  })

  it('allows assignRole if caller is admin', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
    mockRpc.mockResolvedValue({ data: 'admin', error: null })
    vi.mocked(assignUserRole).mockResolvedValue({})

    const body = await query('mutation { assignRole(userId: "target", role: "moderador") { success error } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ assignRole: { success: true, error: null } })
    expect(assignUserRole).toHaveBeenCalledWith('target', 'moderador')
  })

  it('completeOnboarding no pide ningún argumento y delega al service', async () => {
    vi.mocked(completeOnboarding).mockResolvedValue({})

    const body = await query('mutation { completeOnboarding { success error } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ completeOnboarding: { success: true, error: null } })
    expect(completeOnboarding).toHaveBeenCalledWith()
  })

  it('completeOnboarding reporta el error del service sin tirar una excepción de GraphQL', async () => {
    vi.mocked(completeOnboarding).mockResolvedValue({ error: 'No estás autenticado.' })

    const body = await query('mutation { completeOnboarding { success error } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      completeOnboarding: { success: false, error: 'No estás autenticado.' },
    })
  })
})
