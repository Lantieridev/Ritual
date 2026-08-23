'use client'
import { UrqlProvider, createClient, cacheExchange, fetchExchange } from '@urql/next'
import { useMemo } from 'react'

export function GraphQLProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => createClient({
    url: '/api/graphql',
    exchanges: [cacheExchange, fetchExchange],
  }), [])
  return <UrqlProvider client={client} ssr={null as any}>{children}</UrqlProvider>
}
