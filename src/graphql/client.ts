import { registerUrql } from '@urql/next/rsc'
import { createClient, cacheExchange, fetchExchange } from 'urql'
import { yoga } from './yoga'

const makeClient = () => {
  return createClient({
    // Never dialed: `fetch` below short-circuits to yoga in-process. The path
    // must still match yoga's own `graphqlEndpoint`, though — yoga routes on it
    // and 404s anything else, which would silently break every server-side read.
    url: 'http://localhost/api/graphql',
    fetch: yoga.fetch as typeof fetch,
    exchanges: [cacheExchange, fetchExchange],
  })
}

export const { getClient } = registerUrql(makeClient)
