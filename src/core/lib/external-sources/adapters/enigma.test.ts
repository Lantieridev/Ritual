import { describe, it, expect } from 'vitest';
import fs from 'fs'
import path from 'path'
import { parseEnigmaHTML } from './enigma'

describe('Enigma Adapter', () => {
  it('should parse events from HTML fixture', () => {
    const html = fs.readFileSync(path.join(__dirname, '__fixtures__', 'enigma.html'), 'utf8')
    const events = parseEnigmaHTML(html, {})
    
    expect(events.length).toBeGreaterThan(0)
    
    const firstEvent = events[0]
    expect(firstEvent.title).toBeTruthy()
    expect(firstEvent.url).toContain('enigmatickets.com')
  })

  it('should filter events by keyword', () => {
    const html = fs.readFileSync(path.join(__dirname, '__fixtures__', 'enigma.html'), 'utf8')
    const events = parseEnigmaHTML(html, { keyword: 'Primavera' })
    
    expect(events.length).toBeGreaterThan(0)
    expect(events.every(e => e.title.toUpperCase().includes('PRIMAVERA'))).toBe(true)
  })

  it('should return empty array for invalid HTML', () => {
    const events = parseEnigmaHTML('<html><body></body></html>', {})
    expect(events).toEqual([])
  })
})
