import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { modifyProfile } from '@/src/domains/auth/service'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.upsert = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

function makeSupabase(opts: {
  user: { id: string } | null
  profileResult?: { data: unknown; error: unknown }
  uploadError?: { message: string } | null
}) {
  const profileBuilder = makeQueryBuilder(opts.profileResult ?? { data: null, error: null })
  const fromMock = vi.fn(() => profileBuilder)
  const uploadMock = vi.fn(() => Promise.resolve({ error: opts.uploadError ?? null }))
  const getPublicUrlMock = vi.fn(() => ({ data: { publicUrl: 'https://cdn.test/avatar.png' } }))
  return {
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: opts.user } })) },
    from: fromMock,
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
})
