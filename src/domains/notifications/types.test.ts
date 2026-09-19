import { describe, it, expect } from 'vitest'
import {
    NOTIFICATION_TYPES,
    NOTIFICATION_TYPE_LABELS,
    DEFAULT_CHANNELS,
    isNotificationType,
    resolveChannels,
} from './types'

describe('notification types', () => {
    it('has a label and description for every type', () => {
        for (const type of NOTIFICATION_TYPES) {
            expect(NOTIFICATION_TYPE_LABELS[type].label.length).toBeGreaterThan(0)
            expect(NOTIFICATION_TYPE_LABELS[type].description.length).toBeGreaterThan(0)
        }
    })

    it('recognises valid types and rejects anything else', () => {
        expect(isNotificationType('admin_message')).toBe(true)
        expect(isNotificationType('nope')).toBe(false)
    })
})

describe('resolveChannels', () => {
    it('falls back to both channels on when there is no preference row', () => {
        expect(resolveChannels(null)).toEqual(DEFAULT_CHANNELS)
        expect(resolveChannels(undefined)).toEqual(DEFAULT_CHANNELS)
    })

    it('maps the stored row to the channel preference', () => {
        expect(resolveChannels({ in_app: true, email: false })).toEqual({ inApp: true, email: false })
        expect(resolveChannels({ in_app: false, email: true })).toEqual({ inApp: false, email: true })
    })
})
