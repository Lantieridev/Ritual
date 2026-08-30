import { describe, it, expect } from 'vitest'
import { tallyZonesVisited } from './zones'

describe('tallyZonesVisited', () => {
  it('counts "went" attendance by zone, most visited first', () => {
    const tally = tallyZonesVisited([
      { attendance: [{ status: 'went', zone: 'Campo General' }] },
      { attendance: [{ status: 'went', zone: 'Campo General' }] },
      { attendance: [{ status: 'went', zone: 'Platea Alta' }] },
    ])

    expect(tally).toEqual([
      { zone: 'Campo General', count: 2 },
      { zone: 'Platea Alta', count: 1 },
    ])
  })

  it('ignores events the user has not actually attended, even with a zone value', () => {
    const tally = tallyZonesVisited([
      { attendance: [{ status: 'going', zone: 'Campo General' }] },
      { attendance: [{ status: 'interested', zone: 'Platea Alta' }] },
    ])

    expect(tally).toEqual([])
  })

  it('ignores went attendance with no zone recorded', () => {
    const tally = tallyZonesVisited([
      { attendance: [{ status: 'went', zone: null }] },
      { attendance: [{ status: 'went', zone: '   ' }] },
    ])

    expect(tally).toEqual([])
  })

  it('treats different casing/typos as distinct zones — no catalog to normalize against', () => {
    const tally = tallyZonesVisited([
      { attendance: [{ status: 'went', zone: 'Campo' }] },
      { attendance: [{ status: 'went', zone: 'campo' }] },
    ])

    expect(tally).toHaveLength(2)
  })

  it('handles an event with no attendance row at all', () => {
    const tally = tallyZonesVisited([{ attendance: [] }])
    expect(tally).toEqual([])
  })

  it('returns an empty array for no events', () => {
    expect(tallyZonesVisited([])).toEqual([])
  })
})
