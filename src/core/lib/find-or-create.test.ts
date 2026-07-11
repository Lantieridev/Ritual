import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findOrCreateByName } from '@/src/core/lib/find-or-create'

function makeSupabaseMock(
  selectResult: { data: unknown; error: unknown },
  insertResult: { data: unknown; error: unknown }
) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.ilike = vi.fn(chain)
  builder.limit = vi.fn(() => Promise.resolve(selectResult))
  builder.insert = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(insertResult))
  const fromMock = vi.fn(() => builder)
  return { supabase: { from: fromMock }, builder, fromMock }
}

describe('findOrCreateByName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the existing row by case-insensitive name match without inserting', async () => {
    const { supabase, builder } = makeSupabaseMock(
      { data: [{ id: 'venue-1' }], error: null },
      { data: null, error: null }
    )

    const result = await findOrCreateByName(supabase as never, 'venues', 'niceto club')

    expect(builder.ilike).toHaveBeenCalledWith('name', 'niceto club')
    expect(result).toEqual({ id: 'venue-1' })
    expect(builder.insert).not.toHaveBeenCalled()
  })

  it('creates a new row with extra fields when no match exists', async () => {
    const { supabase, builder } = makeSupabaseMock(
      { data: [], error: null },
      { data: { id: 'venue-new' }, error: null }
    )

    const result = await findOrCreateByName(supabase as never, 'venues', 'Niceto Club', {
      city: 'CABA',
      country: 'AR',
    })

    expect(builder.insert).toHaveBeenCalledWith({ name: 'Niceto Club', city: 'CABA', country: 'AR' })
    expect(result).toEqual({ id: 'venue-new' })
  })

  it('returns a sanitized error when the insert fails', async () => {
    const { supabase } = makeSupabaseMock(
      { data: [], error: null },
      { data: null, error: { message: 'duplicate key value violates unique constraint' } }
    )

    const result = await findOrCreateByName(supabase as never, 'artists', 'Bandalos Chinos')

    expect(result).toEqual({ error: 'Ya existe un registro con esos datos.' })
  })
})
