import { describe, it, expect } from 'vitest'
import { buildLineupRows, groupLineupForDisplay } from './lineup-b2b'
import type { LineupRow } from '@/src/core/types'

describe('buildLineupRows', () => {
  it('gives every solo artist a null b2b_group when no groups are passed', () => {
    const rows = buildLineupRows(['a1', 'a2'])
    expect(rows).toEqual([
      { artist_id: 'a1', b2b_group: null },
      { artist_id: 'a2', b2b_group: null },
    ])
  })

  it('assigns the same fresh group id to a real B2B pair', () => {
    const rows = buildLineupRows(['a1', 'a2', 'a3'], [['a1', 'a2']])

    const a1 = rows.find((r) => r.artist_id === 'a1')!
    const a2 = rows.find((r) => r.artist_id === 'a2')!
    const a3 = rows.find((r) => r.artist_id === 'a3')!

    expect(a1.b2b_group).not.toBeNull()
    expect(a1.b2b_group).toBe(a2.b2b_group)
    expect(a3.b2b_group).toBeNull()
  })

  it('supports a 3+ way B2B, not just pairs', () => {
    const rows = buildLineupRows(['a1', 'a2', 'a3'], [['a1', 'a2', 'a3']])
    const groupIds = new Set(rows.map((r) => r.b2b_group))
    expect(groupIds.size).toBe(1)
    expect(rows.every((r) => r.b2b_group !== null)).toBe(true)
  })

  it('gives independent groups different ids', () => {
    const rows = buildLineupRows(['a1', 'a2', 'a3', 'a4'], [['a1', 'a2'], ['a3', 'a4']])
    const g1 = rows.find((r) => r.artist_id === 'a1')!.b2b_group
    const g2 = rows.find((r) => r.artist_id === 'a3')!.b2b_group
    expect(g1).not.toBeNull()
    expect(g2).not.toBeNull()
    expect(g1).not.toBe(g2)
  })

  it('ignores a "group" of a single artist — that is not a B2B', () => {
    const rows = buildLineupRows(['a1', 'a2'], [['a1']])
    expect(rows.find((r) => r.artist_id === 'a1')!.b2b_group).toBeNull()
  })

  it('ignores a group member that is not part of the actual lineup, without dropping the rest of the group', () => {
    const rows = buildLineupRows(['a1', 'a2'], [['a1', 'a2', 'ghost-id']])
    const a1 = rows.find((r) => r.artist_id === 'a1')!
    const a2 = rows.find((r) => r.artist_id === 'a2')!
    expect(a1.b2b_group).toBe(a2.b2b_group)
    expect(a1.b2b_group).not.toBeNull()
  })

  it('keeps the first group when an artist is (incorrectly) listed in two groups', () => {
    const rows = buildLineupRows(['a1', 'a2', 'a3'], [['a1', 'a2'], ['a1', 'a3']])
    const a1 = rows.find((r) => r.artist_id === 'a1')!
    const a2 = rows.find((r) => r.artist_id === 'a2')!
    const a3 = rows.find((r) => r.artist_id === 'a3')!
    expect(a1.b2b_group).toBe(a2.b2b_group)
    expect(a3.b2b_group).toBeNull()
  })

  it('returns an empty array for an empty lineup', () => {
    expect(buildLineupRows([])).toEqual([])
  })
})

function row(id: string, name: string, b2bGroup: string | null = null): LineupRow {
  return { artists: { id, name, genre: null }, b2b_group: b2bGroup }
}

describe('groupLineupForDisplay', () => {
  it('keeps a solo artist as its own single-member group', () => {
    const groups = groupLineupForDisplay([row('a1', 'DJ Solo')])
    expect(groups).toEqual([{ artists: [{ id: 'a1', name: 'DJ Solo', genre: null }] }])
  })

  it('merges a real B2B pair into one group', () => {
    const groups = groupLineupForDisplay([row('a1', 'Sasha', 'g1'), row('a2', 'John Digweed', 'g1')])
    expect(groups).toHaveLength(1)
    expect(groups[0].artists.map((a) => a.name)).toEqual(['Sasha', 'John Digweed'])
  })

  it('does not merge two different B2B groups, or a group with a solo artist', () => {
    const groups = groupLineupForDisplay([
      row('a1', 'Sasha', 'g1'),
      row('a2', 'John Digweed', 'g1'),
      row('a3', 'Solo Act'),
      row('a4', 'Carl Cox', 'g2'),
      row('a5', 'Fatboy Slim', 'g2'),
    ])
    expect(groups).toHaveLength(3)
    expect(groups.map((g) => g.artists.map((a) => a.name))).toEqual([
      ['Sasha', 'John Digweed'],
      ['Solo Act'],
      ['Carl Cox', 'Fatboy Slim'],
    ])
  })

  it('keeps first-appearance order even if a solo row sits between two members of the same group', () => {
    const groups = groupLineupForDisplay([
      row('a1', 'Sasha', 'g1'),
      row('a3', 'Solo Act'),
      row('a2', 'John Digweed', 'g1'),
    ])
    // El grupo se arma completo en la posición de su primer miembro, no se
    // duplica cuando aparece el segundo.
    expect(groups).toHaveLength(2)
    expect(groups[0].artists.map((a) => a.name)).toEqual(['Sasha', 'John Digweed'])
    expect(groups[1].artists.map((a) => a.name)).toEqual(['Solo Act'])
  })

  it('returns an empty array for an empty lineup', () => {
    expect(groupLineupForDisplay([])).toEqual([])
  })
})
