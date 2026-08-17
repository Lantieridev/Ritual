import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/taste/service', () => ({
  listGenres: vi.fn(),
  updateTasteProfile: vi.fn(),
  connectLastfm: vi.fn(),
  disconnectLastfm: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue(null),
}))

import { listGenres, updateTasteProfile, connectLastfm, disconnectLastfm } from '@/src/domains/taste/service'
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

describe('taste GraphQL schema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves the genres query with the canonical vocabulary, sorted', async () => {
    vi.mocked(listGenres).mockResolvedValue([
      { key: 'rock-nacional', label: 'Rock Nacional' },
      { key: 'indie', label: 'Indie' },
    ])

    const body = await query('{ genres { key label } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      genres: [
        { key: 'rock-nacional', label: 'Rock Nacional' },
        { key: 'indie', label: 'Indie' },
      ],
    })
  })

  it('resolves an empty list without throwing when the catalog read fails upstream', async () => {
    vi.mocked(listGenres).mockResolvedValue([])

    const body = await query('{ genres { key label } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ genres: [] })
  })
})

describe('taste GraphQL mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updateTasteProfile forwards the picker state to the service, unwrapped from the input object', async () => {
    vi.mocked(updateTasteProfile).mockResolvedValue({})

    const body = await query(`mutation {
      updateTasteProfile(input: { genres: ["indie", "pop"], birthYear: 1995 }) { success error }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ updateTasteProfile: { success: true, error: null } })
    expect(updateTasteProfile).toHaveBeenCalledWith({ genres: ['indie', 'pop'], birthYear: 1995 })
  })

  it('updateTasteProfile reports a business error through success:false, not a thrown GraphQL error', async () => {
    vi.mocked(updateTasteProfile).mockResolvedValue({ error: 'Revisá el año de nacimiento.' })

    const body = await query(`mutation {
      updateTasteProfile(input: { genres: [], birthYear: 1800 }) { success error }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      updateTasteProfile: { success: false, error: 'Revisá el año de nacimiento.' },
    })
  })

  it('connectLastfm delegates the raw username to the service and reports success', async () => {
    vi.mocked(connectLastfm).mockResolvedValue({})

    const body = await query('mutation { connectLastfm(username: "realuser") { success error } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ connectLastfm: { success: true, error: null } })
    expect(connectLastfm).toHaveBeenCalledWith('realuser')
  })

  it('surfaces the unknown-username error without throwing', async () => {
    vi.mocked(connectLastfm).mockResolvedValue({ error: 'No encontramos ese usuario en Last.fm.' })

    const body = await query('mutation { connectLastfm(username: "ghost") { success error } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      connectLastfm: { success: false, error: 'No encontramos ese usuario en Last.fm.' },
    })
  })

  it('disconnectLastfm needs no arguments and delegates to the service', async () => {
    vi.mocked(disconnectLastfm).mockResolvedValue({})

    const body = await query('mutation { disconnectLastfm { success error } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ disconnectLastfm: { success: true, error: null } })
    expect(disconnectLastfm).toHaveBeenCalledWith()
  })
})
