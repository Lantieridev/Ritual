// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getOutboxOwner, setOutboxOwner } from './outbox-owner'
import { OUTBOX_CHANGED_EVENT } from './outbox'

afterEach(() => setOutboxOwner(null))

describe('outbox owner', () => {
  it('starts with no owner and remembers the one it is given', () => {
    expect(getOutboxOwner()).toBeNull()
    setOutboxOwner('user-1')
    expect(getOutboxOwner()).toBe('user-1')
  })

  it('tells mounted lists to refresh when the owner changes', () => {
    const onChanged = vi.fn()
    window.addEventListener(OUTBOX_CHANGED_EVENT, onChanged)

    setOutboxOwner('user-1')
    setOutboxOwner('user-1')
    setOutboxOwner('user-2')

    window.removeEventListener(OUTBOX_CHANGED_EVENT, onChanged)
    expect(onChanged).toHaveBeenCalledTimes(2)
  })
})
