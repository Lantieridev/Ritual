import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { modifyProfile, assignUserRole, completeOnboarding } from '@/src/domains/auth/service'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.upsert = vi.fn(chain)
  builder.update = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

function makeSupabase(opts: {
  user: { id: string } | null
  profileResult?: { data: unknown; error: unknown }
  uploadError?: { message: string } | null
  rpcResult?: { error: unknown }
}) {
  const profileBuilder = makeQueryBuilder(opts.profileResult ?? { data: null, error: null })
  const fromMock = vi.fn(() => profileBuilder)
  const uploadMock = vi.fn(() => Promise.resolve({ error: opts.uploadError ?? null }))
  const getPublicUrlMock = vi.fn(() => ({ data: { publicUrl: 'https://cdn.test/avatar.png' } }))
  const rpcMock = vi.fn(() => Promise.resolve(opts.rpcResult ?? { error: null }))
  return {
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: opts.user } })) },
    from: fromMock,
    rpc: rpcMock,
    storage: { from: vi.fn(() => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock })) },
    profileBuilder,
    uploadMock,
  }
}

describe('modifyProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires a logged-in user', async () => {
    const supabase = makeSupabase({ user: null })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await modifyProfile({ username: 'martin' })

    expect(result).toEqual({ error: 'No estás autenticado.' })
  })

  it('trims and caps text fields, and never touches avatar_url', async () => {
    const supabase = makeSupabase({
      user: { id: 'user-1' },
      profileResult: { data: null, error: null },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    await modifyProfile({
      full_name: '  Martin  ',
      username: '  martin_dev  ',
      bio: '  Fan del rock  ',
      website: '  https://example.com  ',
      location: '  CABA  ',
    })

    const upsertMock = supabase.profileBuilder.upsert as ReturnType<typeof vi.fn>
    const upserted = upsertMock.mock.calls[0][0]
    expect(upserted).toMatchObject({
      full_name: 'Martin',
      username: 'martin_dev',
      bio: 'Fan del rock',
      website: 'https://example.com',
      location: 'CABA',
    })
    expect(upserted).not.toHaveProperty('avatar_url')
  })

  it('returns a specific error for a duplicate username', async () => {
    const supabase = makeSupabase({
      user: { id: 'user-1' },
      profileResult: { data: null, error: { code: '23505' } },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await modifyProfile({ username: 'taken' })

    expect(result).toEqual({ error: 'Ese nombre de usuario ya está en uso.' })
  })

  it('returns {} on success, no redirect involved', async () => {
    const supabase = makeSupabase({
      user: { id: 'user-1' },
      profileResult: { data: null, error: null },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await modifyProfile({})

    expect(result).toEqual({})
  })

  it('sanitizes an unrecognized DB error instead of returning it raw', async () => {
    const supabase = makeSupabase({
      user: { id: 'user-1' },
      profileResult: { data: null, error: { message: 'relation "profiles" does not exist' } },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await modifyProfile({ username: 'martin' })

    expect(result).toEqual({ error: 'Ocurrió un error inesperado. Intentá de nuevo.' })
  })

  // El avatar viaja como URL ya subida (ver ./avatar-actions.ts) y entra en
  // el mismo upsert que el texto, para no partir el guardado en dos.
  it('writes avatar_url in the same upsert when one is provided', async () => {
    const supabase = makeSupabase({
      user: { id: 'user-1' },
      profileResult: { data: null, error: null },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    await modifyProfile({ username: 'martin', avatar_url: 'https://cdn.test/avatar.png' })

    expect(supabase.profileBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ avatar_url: 'https://cdn.test/avatar.png' })
    )
  })

  it('ignores injected role field', async () => {
    const supabase = makeSupabase({
      user: { id: 'user-1' },
      profileResult: { data: null, error: null },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    // @ts-expect-error Testing invalid input injection
    await modifyProfile({ username: 'martin', role: 'admin' })

    const upsertMock = supabase.profileBuilder.upsert as ReturnType<typeof vi.fn>
    const upserted = upsertMock.mock.calls[0][0]
    expect(upserted).not.toHaveProperty('role')
  })
})

describe('assignUserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls assign_user_role RPC and returns empty object on success', async () => {
    const supabase = makeSupabase({ user: null })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await assignUserRole('user-1', 'admin')

    expect(supabase.rpc).toHaveBeenCalledWith('assign_user_role', {
      target_user_id: 'user-1',
      new_role: 'admin',
    })
    expect(result).toEqual({})
  })

  it('surfaces error via sanitizeError on failure', async () => {
    const supabase = makeSupabase({
      user: null,
      rpcResult: { error: { message: 'insufficient_privilege' } },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await assignUserRole('user-1', 'admin')

    expect(result).toEqual({ error: 'Ocurrió un error inesperado. Intentá de nuevo.' })
  })
})

describe('completeOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires a logged-in user', async () => {
    const supabase = makeSupabase({ user: null })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await completeOnboarding()

    expect(result).toEqual({ error: 'No estás autenticado.' })
  })

  it('sets onboarding_completed_at for the current user and returns empty object on success', async () => {
    const supabase = makeSupabase({ user: { id: 'u1' } })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await completeOnboarding()

    expect(supabase.from).toHaveBeenCalledWith('profiles')
    const updateMock = supabase.profileBuilder.update as ReturnType<typeof vi.fn>
    expect(updateMock).toHaveBeenCalledWith({ onboarding_completed_at: expect.any(String) })
    expect(supabase.profileBuilder.eq).toHaveBeenCalledWith('id', 'u1')
    expect(result).toEqual({})
  })

  it('surfaces error via sanitizeError on failure', async () => {
    const supabase = makeSupabase({
      user: { id: 'u1' },
      profileResult: { data: null, error: { message: 'connection reset' } },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await completeOnboarding()

    expect(result).toEqual({ error: 'Ocurrió un error inesperado. Intentá de nuevo.' })
  })
})
