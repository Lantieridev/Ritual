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
// mutationType se declara recién en la Fase 7.3, cuando exista al menos un
// campo de mutation — GraphQL no permite un tipo sin ningún campo.
