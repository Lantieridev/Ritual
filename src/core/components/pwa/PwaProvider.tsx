'use client'

import { SerwistProvider } from '@serwist/turbopack/react'

/**
 * Registers the service worker in production only: in `next dev` a worker
 * serving cached pages hides the changes you're trying to see.
 *
 * `reloadOnOnline` is off on purpose. Its default reloads the page when signal
 * returns, which would wipe a half-filled expense form; the outbox flusher
 * (OutboxSync) reacts to `online` without needing a reload.
 */
export function PwaProvider({ children }: { children: React.ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={process.env.NODE_ENV !== 'production'}
      reloadOnOnline={false}
    >
      {children}
    </SerwistProvider>
  )
}
