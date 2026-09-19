import { OUTBOX_CHANGED_EVENT } from './outbox'

/**
 * Who the outbox is currently working for. Set once by <OutboxSync/> from the
 * server-verified user id in the root layout; read by the create hook, the
 * flusher and the pending list. Module state (not React state) because those
 * are used from unrelated component trees.
 *
 * `null` means "no known user": nothing is queued, listed or flushed.
 */
let currentOwner: string | null = null

export function setOutboxOwner(ownerId: string | null): void {
  if (ownerId === currentOwner) return
  currentOwner = ownerId
  // Mounted lists were showing the previous owner's entries.
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OUTBOX_CHANGED_EVENT))
}

export function getOutboxOwner(): string | null {
  return currentOwner
}
