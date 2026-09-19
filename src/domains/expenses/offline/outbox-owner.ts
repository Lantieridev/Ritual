/**
 * Who the outbox is currently working for. Set once by <OutboxSync/> from the
 * server-verified user id in the root layout; read by the create hook and the
 * flusher. Module state (not React state) because the create hook and the
 * flusher are used from unrelated component trees.
 *
 * `null` means "no known user": nothing is queued and nothing is flushed.
 */
let currentOwner: string | null = null

export function setOutboxOwner(ownerId: string | null): void {
  currentOwner = ownerId
}

export function getOutboxOwner(): string | null {
  return currentOwner
}
