import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { updateProfile } from '@/src/domains/auth/actions'

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

function makeFile(name: string, size: number, type: string): File {
  const bytes = new Uint8Array(size)
  return new File([bytes], name, { type })
}

describe('updateProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires a logged-in user', async () => {
    const supabase = makeSupabase({ user: null })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await updateProfile({}, new FormData())

    expect(result).toEqual({ error: 'No estás autenticado.' })
  })

  it('trims and caps text fields before upserting', async () => {
    const supabase = makeSupabase({
      user: { id: 'user-1' },
      profileResult: { data: null, error: null },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const formData = new FormData()
    formData.set('full_name', '  Martin  ')
    formData.set('username', '  martin_dev  ')
    formData.set('bio', '  Fan del rock  ')
    formData.set('website', '  https://example.com  ')
    formData.set('location', '  CABA  ')
    formData.set('current_avatar_url', '')

    await updateProfile({}, formData)

    expect(supabase.profileBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: 'Martin',
        username: 'martin_dev',
        bio: 'Fan del rock',
        website: 'https://example.com',
        location: 'CABA',
      })
    )
  })

  it('rejects an avatar larger than 5MB without uploading', async () => {
    const supabase = makeSupabase({ user: { id: 'user-1' } })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const formData = new FormData()
    formData.set('avatar', makeFile('big.png', 6 * 1024 * 1024, 'image/png'))

    const result = await updateProfile({}, formData)

    expect(result).toEqual({ error: 'La imagen no puede superar 5MB.' })
    expect(supabase.uploadMock).not.toHaveBeenCalled()
  })

  it('rejects an unsupported avatar mime type without uploading', async () => {
    const supabase = makeSupabase({ user: { id: 'user-1' } })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const formData = new FormData()
    formData.set('avatar', makeFile('avatar.svg', 1024, 'image/svg+xml'))

    const result = await updateProfile({}, formData)

    expect(result).toEqual({ error: 'Formato no soportado. Usá JPG, PNG, WebP o GIF.' })
    expect(supabase.uploadMock).not.toHaveBeenCalled()
  })

  it('uploads a valid avatar and stores its public URL', async () => {
    const supabase = makeSupabase({
      user: { id: 'user-1' },
      profileResult: { data: null, error: null },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const formData = new FormData()
    formData.set('avatar', makeFile('avatar.png', 1024, 'image/png'))

    await updateProfile({}, formData)

    expect(supabase.uploadMock).toHaveBeenCalledTimes(1)
    expect(supabase.profileBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ avatar_url: 'https://cdn.test/avatar.png' })
    )
  })

  it('returns a friendly error when the avatar upload fails', async () => {
    const supabase = makeSupabase({
      user: { id: 'user-1' },
      uploadError: { message: 'bucket not found' },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const formData = new FormData()
    formData.set('avatar', makeFile('avatar.png', 1024, 'image/png'))

    const result = await updateProfile({}, formData)

    expect(result.error).toContain('bucket "avatars"')
  })

  it('returns a specific error for a duplicate username', async () => {
    const supabase = makeSupabase({
      user: { id: 'user-1' },
      profileResult: { data: null, error: { code: '23505' } },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const formData = new FormData()
    formData.set('username', 'taken')

    const result = await updateProfile({}, formData)

    expect(result).toEqual({ error: 'Ese nombre de usuario ya está en uso.' })
  })

  it('returns success and revalidates the profile path on a clean update', async () => {
    const supabase = makeSupabase({
      user: { id: 'user-1' },
      profileResult: { data: null, error: null },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await updateProfile({}, new FormData())

    expect(result).toEqual({ success: 'Perfil actualizado correctamente.' })
  })
})
