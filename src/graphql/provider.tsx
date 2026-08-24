'use client'
import { UrqlProvider, createClient, cacheExchange, fetchExchange, ssrExchange } from '@urql/next'
import { useMemo } from 'react'

export function GraphQLProvider({ children }: { children: React.ReactNode }) {
  const [client, ssr] = useMemo(() => {
    const ssr = ssrExchange({ isClient: typeof window !== 'undefined' })
    const client = createClient({
      url: '/api/graphql',
      suspense: true,
      exchanges: [cacheExchange, ssr, fetchExchange],
    })
    return [client, ssr]
  }, [])
  return <UrqlProvider client={client} ssr={ssr}>{children}</UrqlProvider>
}
