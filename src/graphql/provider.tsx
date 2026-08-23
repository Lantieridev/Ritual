'use client'
import { UrqlProvider, createClient, cacheExchange, fetchExchange, ssrExchange } from '@urql/next'
import { useMemo } from 'react'

export function GraphQLProvider({ children }: { children: React.ReactNode }) {
  const [client, ssr] = useMemo(() => {
    const ssr = ssrExchange()
    const client = createClient({
      url: '/api/graphql',
      exchanges: [cacheExchange, ssr, fetchExchange],
    })
    return [client, ssr]
  }, [])
  return <UrqlProvider client={client} ssr={ssr}>{children}</UrqlProvider>
}
