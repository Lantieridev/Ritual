import SchemaBuilder from '@pothos/core'
import RelayPlugin from '@pothos/plugin-relay'
import type { GraphQLContext } from './context'

export const builder = new SchemaBuilder<{
    Context: GraphQLContext
    Scalars: {
        JSON: { Input: unknown; Output: unknown }
    }
}>({
    plugins: [RelayPlugin],
    // En Pothos v4 la clave es `relay`; `relayOptions` era la forma de v3 y
    // quedó tipada como `never`, así que la config anterior no se aplicaba y
    // el proyecto no compilaba con `tsc --noEmit`.
    relay: {
        clientMutationId: 'omit',
        cursorType: 'String',
    },
})

builder.scalarType('JSON', {
    serialize: (value) => value,
    parseValue: (value) => value,
})

builder.queryType({})
builder.mutationType({})
