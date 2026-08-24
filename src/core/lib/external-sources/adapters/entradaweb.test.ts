import { describe, it, expect } from 'vitest';
import fs from 'fs'
import path from 'path'
import { parseEntradaWebJSON } from './entradaweb'

describe('EntradaWeb Adapter', () => {
  it('should parse events from JSON fixture', () => {
    const json = JSON.parse(fs.readFileSync(path.join(__dirname, '__fixtures__', 'entradaweb.json'), 'utf8'))
    const events = parseEntradaWebJSON(json, {})
    
    expect(events.length).toBeGreaterThan(0)
    
    const firstEvent = events[0]
    expect(firstEvent.title).toBe('MARTIN BOSSI, GUSTAVO BERMUDEZ y LAURITA FERNANDEZ presentan LA CENA DE LOS TONTOS | SAN JUAN')
    expect(firstEvent.url).toContain('entradaweb.com.ar')
    expect(firstEvent.datetime).toBe('Jueves 10 de Septiembre, 2026')
    expect(firstEvent.id).toMatch(/^entradaweb-[a-f0-9]{8}$/)
  })

  it('should filter events by keyword', () => {
    const json = JSON.parse(fs.readFileSync(path.join(__dirname, '__fixtures__', 'entradaweb.json'), 'utf8'))
    const events = parseEntradaWebJSON(json, { keyword: 'BOSSI' })
    
    expect(events.length).toBe(1)
    
    const eventsEmpty = parseEntradaWebJSON(json, { keyword: 'Metallica' })
    expect(eventsEmpty.length).toBe(0)
  })

  it('should return empty array for invalid data', () => {
    const events = parseEntradaWebJSON({}, {})
    expect(events).toEqual([])
  })
})
