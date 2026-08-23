import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

import { uploadAvatar } from '@/src/domains/auth/avatar-actions'

function makeSupabase(opts: {
  user: { id: string } | null
  uploadError?: { message: string } | null
}) {
  const uploadMock = vi.fn(() => Promise.resolve({ error: opts.uploadError ?? null }))
  const getPublicUrlMock = vi.fn(() => ({ data: { publicUrl: 'https://cdn.test/avatar.png' } }))
  return {
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: opts.user } })) },
    storage: { from: vi.fn(() => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock })) },
    uploadMock,
  }
}

function makeFormData(file?: File): FormData {
  const formData = new FormData()
  if (file) formData.set('avatar', file)
  return formData
}

function makeFile(name: string, size: number, type: string): File {
  const bytes = new Uint8Array(size)
  return new File([bytes], name, { type })
}

describe('uploadAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires a logged-in user', async () => {
    const supabase = makeSupabase({ user: null })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await uploadAvatar(makeFormData(makeFile('avatar.png', 1024, 'image/png')))

    expect(result).toEqual({ error: 'No estás autenticado.' })
    expect(supabase.uploadMock).not.toHaveBeenCalled()
  })

  it('reports a missing file instead of uploading an empty one', async () => {
    const supabase = makeSupabase({ user: { id: 'user-1' } })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await uploadAvatar(makeFormData())

    expect(result).toEqual({ error: 'No se recibió ninguna imagen.' })
    expect(supabase.uploadMock).not.toHaveBeenCalled()
  })

  it('rejects an avatar larger than 5MB without uploading', async () => {
    const supabase = makeSupabase({ user: { id: 'user-1' } })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await uploadAvatar(makeFormData(makeFile('big.png', 6 * 1024 * 1024, 'image/png')))

    expect(result).toEqual({ error: 'La imagen no puede superar 5MB.' })
    expect(supabase.uploadMock).not.toHaveBeenCalled()
  })

  it('rejects an unsupported avatar mime type without uploading', async () => {
    const supabase = makeSupabase({ user: { id: 'user-1' } })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await uploadAvatar(makeFormData(makeFile('avatar.svg', 1024, 'image/svg+xml')))

    expect(result).toEqual({ error: 'Formato no soportado. Usá JPG, PNG, WebP o GIF.' })
    expect(supabase.uploadMock).not.toHaveBeenCalled()
  })

  it('uploads a valid avatar and returns its public URL', async () => {
    const supabase = makeSupabase({ user: { id: 'user-1' } })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await uploadAvatar(makeFormData(makeFile('avatar.png', 1024, 'image/png')))

    expect(supabase.uploadMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ avatarUrl: 'https://cdn.test/avatar.png' })
  })

  it('returns a friendly error when the upload fails', async () => {
    const supabase = makeSupabase({
      user: { id: 'user-1' },
      uploadError: { message: 'bucket not found' },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await uploadAvatar(makeFormData(makeFile('avatar.png', 1024, 'image/png')))

    expect(result.error).toContain('bucket "avatars"')
    expect(result.avatarUrl).toBeUndefined()
  })
})
