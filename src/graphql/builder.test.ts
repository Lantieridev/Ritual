import { describe, it, expect } from 'vitest'
import { schema } from './schema'

describe('JSON scalar', () => {
  it('serializes and parses values as an identity passthrough', () => {
    // Sin `instanceof GraphQLScalarType`: importar la clase del paquete
    // "graphql" acá y compararla contra el tipo que devuelve el schema de
    // Pothos dispara el mismo problema de módulos duplicados de graphql-js
    // bajo Vitest que ya se vio en route.test.ts — duck-typing lo evita.
    const jsonType = schema.getType('JSON') as {
      serialize?: (v: unknown) => unknown
      parseValue?: (v: unknown) => unknown
    }
    expect(typeof jsonType.serialize).toBe('function')
    expect(typeof jsonType.parseValue).toBe('function')

    const value = { Entrada: 10000, Comida: 5000 }
    expect(jsonType.serialize?.(value)).toEqual(value)
    expect(jsonType.parseValue?.(value)).toEqual(value)
  })
})
