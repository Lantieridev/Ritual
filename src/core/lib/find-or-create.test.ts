import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findOrCreateByName } from '@/src/core/lib/find-or-create'

function makeUpsertBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.upsert = vi.fn(chain)
  builder.select = vi.fn(chain)
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))
  return builder
}

function makeSelectBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.ilike = vi.fn(chain)
  builder.limit = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(result))
  return builder
}

describe('findOrCreateByName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a new row with extra fields via an atomic upsert when no match exists', async () => {
    const upsertBuilder = makeUpsertBuilder({ data: { id: 'venue-new' }, error: null })
    const fromMock = vi.fn(() => upsertBuilder)
    const supabase = { from: fromMock }

    const result = await findOrCreateByName(supabase as never, 'venues', 'Niceto Club', {
      city: 'CABA',
      country: 'AR',
    })

    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      { name: 'Niceto Club', city: 'CABA', country: 'AR' },
      { onConflict: 'name_key', ignoreDuplicates: true }
    )
    expect(result).toEqual({ id: 'venue-new' })
    expect(fromMock).toHaveBeenCalledTimes(1) // no fallback select needed
  })

  it(
    'falls back to a select when the upsert is silently skipped by a conflict ' +
      '(regression test: two concurrent "Agregar" clicks on the same result used to ' +
      'create two duplicate rows since there was no DB-level uniqueness backing the ' +
      'old select-then-insert flow)',
    async () => {
      const upsertBuilder = makeUpsertBuilder({ data: null, error: null })
      const selectBuilder = makeSelectBuilder({ data: { id: 'venue-existing' }, error: null })
      const fromMock = vi
        .fn()
        .mockReturnValueOnce(upsertBuilder)
        .mockReturnValueOnce(selectBuilder)
      const supabase = { from: fromMock }

      const result = await findOrCreateByName(supabase as never, 'venues', 'niceto club')

      expect(selectBuilder.ilike).toHaveBeenCalledWith('name', 'niceto club')
      expect(result).toEqual({ id: 'venue-existing' })
    }
  )

  it("does not overwrite an existing row's fields when it already exists", async () => {
    // The upsert payload includes extraFields, but since ignoreDuplicates is
    // true, Postgres performs DO NOTHING on conflict — the existing row's
    // city/country are never touched even though they were in the payload.
    const upsertBuilder = makeUpsertBuilder({ data: null, error: null })
    const selectBuilder = makeSelectBuilder({ data: { id: 'venue-existing' }, error: null })
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(upsertBuilder)
      .mockReturnValueOnce(selectBuilder)
    const supabase = { from: fromMock }

    const result = await findOrCreateByName(supabase as never, 'venues', 'Niceto Club', {
      city: 'A new city that should never overwrite the existing one',
    })

    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      { name: 'Niceto Club', city: 'A new city that should never overwrite the existing one' },
      { onConflict: 'name_key', ignoreDuplicates: true }
    )
    expect(result).toEqual({ id: 'venue-existing' })
  })

  it('returns a sanitized error when the upsert itself fails', async () => {
    const upsertBuilder = makeUpsertBuilder({ data: null, error: { message: 'connection refused' } })
    const supabase = { from: vi.fn(() => upsertBuilder) }

    const result = await findOrCreateByName(supabase as never, 'artists', 'Bandalos Chinos')

    expect(result).toEqual({ error: 'Ocurrió un error inesperado. Intentá de nuevo.' })
  })

  it('returns a sanitized error when the fallback select fails after a conflict', async () => {
    const upsertBuilder = makeUpsertBuilder({ data: null, error: null })
    const selectBuilder = makeSelectBuilder({ data: null, error: { message: 'connection refused' } })
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(upsertBuilder)
      .mockReturnValueOnce(selectBuilder)
    const supabase = { from: fromMock }

    const result = await findOrCreateByName(supabase as never, 'artists', 'Bandalos Chinos')

    expect(result).toEqual({ error: 'Ocurrió un error inesperado. Intentá de nuevo.' })
  })
})
