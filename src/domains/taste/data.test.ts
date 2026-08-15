import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

import { listGenres } from '@/src/domains/taste/data'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.order = vi.fn(() => Promise.resolve(result))
  return builder
}

describe('listGenres', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps the canonical genre rows to key/label, sorted by the catalog order', async () => {
    const rows = [
      { key: 'rock-nacional', label_es: 'Rock Nacional', sort: 10 },
      { key: 'indie', label_es: 'Indie', sort: 20 },
    ]
    const fromMock = vi.fn(() => makeQueryBuilder({ data: rows, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await listGenres()

    expect(fromMock).toHaveBeenCalledWith('genres')
    expect(result).toEqual([
      { key: 'rock-nacional', label: 'Rock Nacional' },
      { key: 'indie', label: 'Indie' },
    ])
  })

  it('returns an empty list when the query errors out', async () => {
    const fromMock = vi.fn(() => makeQueryBuilder({ data: null, error: { message: 'boom' } }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await listGenres()

    expect(result).toEqual([])
  })
})
