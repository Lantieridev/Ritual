import { createYoga } from 'graphql-yoga'
import { schema } from '@/src/graphql/schema'
import { createGraphQLContext } from '@/src/graphql/context'

export const yoga = createYoga({
    schema,
    context: createGraphQLContext,
    graphqlEndpoint: '/api/graphql',
    fetchAPI: { Response },
})
