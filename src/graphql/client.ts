import { registerUrql } from '@urql/next/rsc'
import { createClient, cacheExchange, fetchExchange } from 'urql'
import { yoga } from './yoga'

const makeClient = () => {
  return createClient({
    url: 'http://localhost/graphql', // Dummy URL for in-process routing
    fetch: yoga.fetch as typeof fetch,
    exchanges: [cacheExchange, fetchExchange],
  })
}

export const { getClient } = registerUrql(makeClient)
