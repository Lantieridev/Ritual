import { describe, it, expect } from 'vitest';
import fs from 'fs'
import path from 'path'
import { parseEntrasteHTML } from './entraste'

describe('Entraste Adapter', () => {
  it('should parse events from HTML fixture', () => {
    const html = fs.readFileSync(path.join(__dirname, '__fixtures__', 'entraste.html'), 'utf8')
    const events = parseEntrasteHTML(html, {})
    
    expect(events.length).toBeGreaterThan(0)
    
    const firstEvent = events[0]
    expect(firstEvent.title).toBeTruthy()
    expect(firstEvent.url).toContain('entraste.com')
  })

  it('should filter events by keyword', () => {
    const html = fs.readFileSync(path.join(__dirname, '__fixtures__', 'entraste.html'), 'utf8')
    const events = parseEntrasteHTML(html, { keyword: 'Conference' }) // Example from our dump
    
    expect(events.length).toBeGreaterThan(0)
    expect(events.every(e => e.title.toUpperCase().includes('CONFERENCE'))).toBe(true)
  })

  it('should return empty array for invalid HTML', () => {
    const events = parseEntrasteHTML('<html><body></body></html>', {})
    expect(events).toEqual([])
  })
})
