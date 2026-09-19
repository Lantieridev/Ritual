// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { getOutboxOwner, setOutboxOwner } from '@/src/domains/expenses/offline/outbox-owner'

const flush = vi.fn().mockResolvedValue({ synced: 0, failed: 0, remaining: 0, skipped: false })
vi.mock('@/src/domains/expenses/offline/use-outbox', () => ({
  useOutboxFlush: () => flush,
}))
const warm = vi.fn().mockResolvedValue(undefined)
vi.mock('@/src/domains/expenses/offline/warm-cache', () => ({
  warmOfflineRoutes: () => warm(),
}))

import { OutboxSync } from './OutboxSync'

beforeEach(() => {
  vi.clearAllMocks()
  setOutboxOwner(null)
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

describe('OutboxSync', () => {
  it('registers the signed-in user as the outbox owner, and clears it on unmount', () => {
    const { unmount } = render(<OutboxSync userId="user-1" />)
    expect(getOutboxOwner()).toBe('user-1')

    unmount()
    expect(getOutboxOwner()).toBeNull()
  })

  it('flushes and warms the offline routes on mount', () => {
    render(<OutboxSync userId="user-1" />)

    expect(flush).toHaveBeenCalledTimes(1)
    expect(warm).toHaveBeenCalledTimes(1)
  })

  it('flushes when the browser comes back online', () => {
    render(<OutboxSync userId="user-1" />)
    flush.mockClear()

    window.dispatchEvent(new Event('online'))

    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('flushes when the tab becomes visible again', () => {
    render(<OutboxSync userId="user-1" />)
    flush.mockClear()

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('does not flush while offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    render(<OutboxSync userId="user-1" />)

    expect(flush).not.toHaveBeenCalled()
  })

  it('stops listening after unmount', () => {
    const { unmount } = render(<OutboxSync userId="user-1" />)
    unmount()
    flush.mockClear()

    window.dispatchEvent(new Event('online'))

    expect(flush).not.toHaveBeenCalled()
  })
})
