import SchemaBuilder from '@pothos/core'
import type { GraphQLContext } from './context'

export const builder = new SchemaBuilder<{
    Context: GraphQLContext
    Scalars: {
        JSON: { Input: unknown; Output: unknown }
    }
}>({})

builder.scalarType('JSON', {
    serialize: (value) => value,
    parseValue: (value) => value,
})

builder.queryType({})
builder.mutationType({})
