'use client'

import { useEffect } from 'react'
import { setOutboxOwner } from '@/src/domains/expenses/offline/outbox-owner'
import { useOutboxFlush } from '@/src/domains/expenses/offline/use-outbox'
import { warmOfflineRoutes } from '@/src/domains/expenses/offline/warm-cache'

interface OutboxSyncProps {
  /** The server-verified signed-in user (from the root layout). */
  userId: string
}

/**
 * Mounted once for signed-in users. Registers who the outbox belongs to, then
 * drains it whenever there is a reason to think the network is back: app open,
 * the `online` event, or the tab becoming visible again. This is the sync path
 * for iOS too, which has no Background Sync.
 */
export function OutboxSync({ userId }: OutboxSyncProps) {
  const flush = useOutboxFlush()

  // Declared first so the owner is set before the flush effect below runs.
  useEffect(() => {
    setOutboxOwner(userId)
    return () => setOutboxOwner(null)
  }, [userId])

  useEffect(() => {
    const tryFlush = () => {
      if (navigator.onLine !== false) void flush().catch(() => {})
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') tryFlush()
    }

    tryFlush()
    void warmOfflineRoutes()
    // Ask the browser not to evict the outbox under storage pressure.
    void navigator.storage?.persist?.()

    window.addEventListener('online', tryFlush)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', tryFlush)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [flush])

  return null
}
