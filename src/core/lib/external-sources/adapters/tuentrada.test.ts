import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parseTuentradaHTML } from './tuentrada'

describe('TuEntrada Adapter', () => {
  it('should parse events from HTML fixture correctly', () => {
    const html = fs.readFileSync(path.join(__dirname, '__fixtures__', 'tuentrada.html'), 'utf-8')
    const events = parseTuentradaHTML(html, {})

    expect(events.length).toBeGreaterThan(0)
    expect(events[0]).toMatchObject({
      title: 'Flor Bertotti',
      venue: { name: 'Teatro Gran Rex', city: null },
      datetime: 'Domingo 06 de Septiembre',
      url: 'https://tuentrada.com/flor-bertotti-tgr',
      image: 'https://example.com/flor.jpg'
    })
    
    // Check deterministic ID
    expect(events[0].id).toMatch(/^tuentrada-[a-f0-9]{10}$/)
  })

  it('should filter by keyword', () => {
    const html = fs.readFileSync(path.join(__dirname, '__fixtures__', 'tuentrada.html'), 'utf-8')
    const events = parseTuentradaHTML(html, { keyword: 'bertotti' })
    expect(events.length).toBe(1)
    
    const eventsEmpty = parseTuentradaHTML(html, { keyword: 'no match' })
    expect(eventsEmpty.length).toBe(0)
  })
})
