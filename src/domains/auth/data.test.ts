import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

import { getProfile } from '@/src/domains/auth/data'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(result))
  return builder
}

function makeSupabase(opts: {
  user: { id: string } | null
  profileResult?: { data: unknown; error: unknown }
}) {
  const profileBuilder = makeQueryBuilder(opts.profileResult ?? { data: null, error: null })
  const fromMock = vi.fn(() => profileBuilder)
  return {
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: opts.user } })) },
    from: fromMock,
    profileBuilder,
  }
}

describe('getProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches the current authenticated user profile when no id is passed', async () => {
    const supabase = makeSupabase({
      user: { id: 'user-1' },
      profileResult: { data: { id: 'user-1', username: 'martin' }, error: null },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const profile = await getProfile()

    expect(supabase.auth.getUser).toHaveBeenCalledTimes(1)
    expect(supabase.profileBuilder.eq).toHaveBeenCalledWith('id', 'user-1')
    expect(profile).toEqual({ id: 'user-1', username: 'martin' })
  })

  it('fetches a specific profile by id without checking the session', async () => {
    const supabase = makeSupabase({
      user: null,
      profileResult: { data: { id: 'user-2', username: 'other' }, error: null },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const profile = await getProfile('user-2')

    expect(supabase.auth.getUser).not.toHaveBeenCalled()
    expect(profile).toEqual({ id: 'user-2', username: 'other' })
  })

  it('returns null when there is no logged-in user and no id was passed', async () => {
    const supabase = makeSupabase({ user: null })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const profile = await getProfile()

    expect(profile).toBeNull()
  })

  it('returns null when the query errors out', async () => {
    const supabase = makeSupabase({
      user: { id: 'user-1' },
      profileResult: { data: null, error: { message: 'boom' } },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const profile = await getProfile()

    expect(profile).toBeNull()
  })
})
