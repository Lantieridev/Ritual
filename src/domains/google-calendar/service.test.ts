import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    getGoogleCalendarStatus,
    connectGoogleCalendar,
    disconnectGoogleCalendar,
    syncEventToGoogleCalendar,
    encryptToken,
    decryptToken,
} from './service'
import { getCurrentUserId } from '@/src/core/auth/session'
import { getEventById } from '@/src/domains/events/data'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

vi.mock('./client', () => ({
    googleCalendarClient: {
        exchangeCodeForTokens: vi.fn(),
        revokeToken: vi.fn(),
        refreshAccessToken: vi.fn(),
        insertEvent: vi.fn(),
        updateEvent: vi.fn(),
    }
}))

import { googleCalendarClient as fakeGoogleClient } from './client'

vi.mock('@/src/core/auth/session', () => ({
    getCurrentUserId: vi.fn(),
}))

vi.mock('@/src/domains/events/data', () => ({
    getEventById: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(),
}))

// Env setup
process.env.GOOGLE_CALENDAR_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'

describe('Google Calendar Service', () => {
    let mockSupabase: any
    let mockFrom: any
    let mockSelect: any
    let mockEq: any
    let mockSingle: any
    let mockDelete: any
    let mockUpsert: any
    let mockInsert: any

    beforeEach(() => {
        vi.clearAllMocks()

        mockSingle = vi.fn()
        mockEq = vi.fn().mockReturnValue({ single: mockSingle, eq: vi.fn().mockReturnThis() })
        mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
        mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
        mockUpsert = vi.fn().mockResolvedValue({ error: null })
        mockInsert = vi.fn().mockResolvedValue({ error: null })
        
        mockFrom = vi.fn().mockReturnValue({
            select: mockSelect,
            delete: mockDelete,
            upsert: mockUpsert,
            insert: mockInsert,
            eq: mockEq,
        })
        
        mockSupabase = {
            from: mockFrom,
        }
        
        vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase)
    })

    it('encrypts and decrypts tokens correctly', () => {
        const token = '1/abcdefg123456'
        const encrypted = encryptToken(token)
        expect(encrypted).not.toBe(token)
        expect(decryptToken(encrypted)).toBe(token)
    })

    describe('connectGoogleCalendar', () => {
        it('saves the refresh token securely after exchanging code', async () => {
            vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
            fakeGoogleClient.exchangeCodeForTokens.mockResolvedValue({ refresh_token: 'refresh-123', access_token: 'access-123' })
            
            const result = await connectGoogleCalendar('auth-code', 'http://localhost/callback')
            
            expect(result.error).toBeUndefined()
            expect(fakeGoogleClient.exchangeCodeForTokens).toHaveBeenCalledWith('auth-code', 'http://localhost/callback')
            
            const upsertArg = mockUpsert.mock.calls[0][0]
            expect(upsertArg.user_id).toBe('user-1')
            expect(decryptToken(upsertArg.refresh_token)).toBe('refresh-123')
        })
    })

    describe('disconnectGoogleCalendar', () => {
        it('revokes the token and removes local mapping', async () => {
            vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
            const encToken = encryptToken('refresh-123')
            mockSingle.mockResolvedValue({ data: { refresh_token: encToken }, error: null })
            
            const result = await disconnectGoogleCalendar()
            
            expect(result.error).toBeUndefined()
            expect(fakeGoogleClient.revokeToken).toHaveBeenCalledWith('refresh-123')
            expect(mockDelete).toHaveBeenCalled()
        })
        
        it('removes local mapping even if revoke fails', async () => {
            vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
            const encToken = encryptToken('refresh-123')
            mockSingle.mockResolvedValue({ data: { refresh_token: encToken }, error: null })
            fakeGoogleClient.revokeToken.mockRejectedValue(new Error('Revoke failed'))
            
            const result = await disconnectGoogleCalendar()
            
            expect(result.error).toBeUndefined()
            expect(mockDelete).toHaveBeenCalled()
        })
    })

    describe('syncEventToGoogleCalendar', () => {
        it('inserts event if not created yet (happy path)', async () => {
            vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
            const encToken = encryptToken('refresh-123')
            // return link
            mockSingle.mockResolvedValueOnce({ data: { refresh_token: encToken }, error: null })
            // return event mapping missing
            mockSingle.mockResolvedValueOnce({ data: null, error: null })
            
            vi.mocked(getEventById).mockResolvedValue({
                id: 'event-1',
                name: 'Rock Show',
                date: '2026-10-10T20:00:00Z',
                venue: { name: 'The Arena' },
            } as any)
            
            fakeGoogleClient.refreshAccessToken.mockResolvedValue('new-access-token')
            fakeGoogleClient.insertEvent.mockResolvedValue('google-event-id-1')
            
            const result = await syncEventToGoogleCalendar('event-1')
            
            expect(result.error).toBeUndefined()
            expect(fakeGoogleClient.refreshAccessToken).toHaveBeenCalledWith('refresh-123')
            expect(fakeGoogleClient.insertEvent).toHaveBeenCalled()
            
            const insertArg = fakeGoogleClient.insertEvent.mock.calls[0][1]
            expect(insertArg.summary).toBe('Rock Show')
            expect(insertArg.description).toContain('The Arena')
            
            expect(mockInsert).toHaveBeenCalledWith({
                user_id: 'user-1',
                event_id: 'event-1',
                google_event_id: 'google-event-id-1',
            })
        })

        it('updates event if date changes', async () => {
            vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
            const encToken = encryptToken('refresh-123')
            mockSingle.mockResolvedValueOnce({ data: { refresh_token: encToken }, error: null })
            // return existing mapping
            mockSingle.mockResolvedValueOnce({ data: { google_event_id: 'existing-g-event' }, error: null })
            
            vi.mocked(getEventById).mockResolvedValue({
                id: 'event-1',
                name: 'Rock Show Rescheduled',
                date: '2026-11-10T20:00:00Z',
                venue: { name: 'The Arena' },
            } as any)
            
            fakeGoogleClient.refreshAccessToken.mockResolvedValue('new-access-token')
            
            const result = await syncEventToGoogleCalendar('event-1')
            
            expect(result.error).toBeUndefined()
            expect(fakeGoogleClient.updateEvent).toHaveBeenCalledWith(
                'new-access-token',
                'existing-g-event',
                expect.objectContaining({ summary: 'Rock Show Rescheduled' })
            )
            expect(mockInsert).not.toHaveBeenCalled()
        })

        it('handles refresh failure by deleting token', async () => {
            vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
            const encToken = encryptToken('refresh-123')
            mockSingle.mockResolvedValueOnce({ data: { refresh_token: encToken }, error: null })
            
            vi.mocked(getEventById).mockResolvedValue({
                id: 'event-1',
                name: 'Rock Show',
                date: '2026-10-10T20:00:00Z',
            } as any)
            
            fakeGoogleClient.refreshAccessToken.mockRejectedValue(new Error('Invalid token'))
            
            const result = await syncEventToGoogleCalendar('event-1')
            
            expect(result.error).toContain('La conexión expiró')
            expect(mockDelete).toHaveBeenCalled()
        })
    })
})
