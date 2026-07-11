import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { getEventPhotos, uploadEventPhoto, deleteEventPhoto } from '@/src/domains/events/photo-actions'
import { getCurrentUserId } from '@/src/core/auth/session'

const VALID_EVENT_ID = '11111111-1111-1111-1111-111111111111'
const VALID_PHOTO_ID = '22222222-2222-2222-2222-222222222222'

function makeFile(name: string, size: number, type: string): File {
  return new File([new Uint8Array(size)], name, { type })
}

function makeStorageMock(uploadError: { message?: string; statusCode?: string } | null = null) {
  const uploadMock = vi.fn(() => Promise.resolve({ error: uploadError }))
  const getPublicUrlMock = vi.fn((path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }))
  const removeMock = vi.fn(() => Promise.resolve({ error: null }))
  return {
    from: vi.fn(() => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock, remove: removeMock })),
    uploadMock,
    removeMock,
  }
}

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.order = vi.fn(chain)
  builder.insert = vi.fn(chain)
  builder.delete = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

describe('getEventPhotos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects an invalid event id without touching the client', async () => {
    const result = await getEventPhotos('not-a-uuid')

    expect(result).toEqual([])
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('returns photos with resolved public URLs', async () => {
    const dbBuilder = makeQueryBuilder({
      data: [{ id: 'p1', event_id: VALID_EVENT_ID, storage_path: 'a/b.jpg', caption: null, created_at: 't' }],
      error: null,
    })
    const storage = makeStorageMock()
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => dbBuilder), storage }))

    const result = await getEventPhotos(VALID_EVENT_ID)

    expect(result[0].url).toBe('https://cdn.test/a/b.jpg')
  })

  it('returns an empty list when the query errors out', async () => {
    const dbBuilder = makeQueryBuilder({ data: null, error: { message: 'boom' } })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => dbBuilder), storage: makeStorageMock() }))

    const result = await getEventPhotos(VALID_EVENT_ID)

    expect(result).toEqual([])
  })
})

describe('uploadEventPhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  function makeFormData(overrides: Partial<{ eventId: string; file: File | null; caption: string }> = {}) {
    const fd = new FormData()
    fd.set('eventId', overrides.eventId ?? VALID_EVENT_ID)
    if (overrides.file !== null) {
      fd.set('file', overrides.file ?? makeFile('photo.jpg', 1024, 'image/jpeg'))
    }
    if (overrides.caption !== undefined) fd.set('caption', overrides.caption)
    return fd
  }

  it('rejects an invalid event id', async () => {
    const result = await uploadEventPhoto(makeFormData({ eventId: 'not-a-uuid' }))
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('requires a logged-in user', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await uploadEventPhoto(makeFormData())
    expect(result.error).toBeTruthy()
  })

  it('rejects a missing file', async () => {
    const result = await uploadEventPhoto(makeFormData({ file: null }))
    expect(result.error).toBe('Seleccioná una imagen.')
  })

  it('rejects a file over 5MB', async () => {
    const result = await uploadEventPhoto(
      makeFormData({ file: makeFile('big.jpg', 6 * 1024 * 1024, 'image/jpeg') })
    )
    expect(result.error).toBe('La imagen no puede superar 5MB.')
  })

  it('rejects an unsupported mime type', async () => {
    const result = await uploadEventPhoto(makeFormData({ file: makeFile('a.svg', 100, 'image/svg+xml') }))
    expect(result.error).toContain('Formato no soportado')
  })

  it('uploads, inserts the DB row, and returns the photo with its public URL', async () => {
    const dbBuilder = makeQueryBuilder({
      data: { id: 'p1', event_id: VALID_EVENT_ID, storage_path: `${VALID_EVENT_ID}/1.jpg`, caption: 'Linda', created_at: 't' },
      error: null,
    })
    const storage = makeStorageMock()
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => dbBuilder), storage }))

    const result = await uploadEventPhoto(makeFormData({ caption: '  Linda  ' }))

    expect(storage.uploadMock).toHaveBeenCalledTimes(1)
    expect(dbBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ event_id: VALID_EVENT_ID, caption: 'Linda' })
    )
    expect(result.photo?.url).toContain('https://cdn.test/')
  })

  it('gives an actionable error when the storage bucket does not exist', async () => {
    const storage = makeStorageMock({ message: 'Bucket not found', statusCode: '404' })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(), storage }))

    const result = await uploadEventPhoto(makeFormData())

    expect(result.error).toContain('bucket de fotos no existe')
  })

  it('cleans up the uploaded file when the DB insert fails', async () => {
    const dbBuilder = makeQueryBuilder({ data: null, error: { message: 'boom' } })
    const storage = makeStorageMock()
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => dbBuilder), storage }))

    const result = await uploadEventPhoto(makeFormData())

    expect(storage.removeMock).toHaveBeenCalledTimes(1)
    expect(result.error).toBeTruthy()
  })
})

describe('deleteEventPhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('rejects an invalid photo or event id', async () => {
    const badPhoto = await deleteEventPhoto('not-a-uuid', VALID_EVENT_ID)
    expect(badPhoto.error).toBeTruthy()

    const badEvent = await deleteEventPhoto(VALID_PHOTO_ID, 'not-a-uuid')
    expect(badEvent.error).toBeTruthy()

    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('requires a logged-in user', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await deleteEventPhoto(VALID_PHOTO_ID, VALID_EVENT_ID)
    expect(result.error).toBeTruthy()
  })

  it('removes the storage object then the DB row', async () => {
    const dbBuilder = makeQueryBuilder({ data: { storage_path: 'a/b.jpg' }, error: null })
    const storage = makeStorageMock()
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => dbBuilder), storage }))

    const result = await deleteEventPhoto(VALID_PHOTO_ID, VALID_EVENT_ID)

    expect(storage.removeMock).toHaveBeenCalledWith(['a/b.jpg'])
    expect(dbBuilder.delete).toHaveBeenCalled()
    expect(result).toEqual({})
  })

  it('returns an error when the photo is not found or not owned by the user', async () => {
    const dbBuilder = makeQueryBuilder({ data: null, error: { code: 'PGRST116' } })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => dbBuilder), storage: makeStorageMock() }))

    const result = await deleteEventPhoto(VALID_PHOTO_ID, VALID_EVENT_ID)

    expect(result.error).toBeTruthy()
  })
})
