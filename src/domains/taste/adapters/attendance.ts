import type { TasteSignal, TasteSource } from '@/src/domains/taste/types'
import { wentWeight, GOING_WEIGHT, INTERESTED_WEIGHT, WENT_HALF_LIFE_DAYS } from '@/src/domains/taste/weights'

type AttendanceStatus = 'interested' | 'going' | 'went'

interface AttendanceRow {
    status: AttendanceStatus
    rating: number | null
    events: { date: string; lineups: Array<{ artist_id: string }> | null } | null
}

/**
 * The user's own attendance across all three statuses. Only "went" decays by
 * time (365-day half-life from the show date) — "going"/"interested" are
 * flat, permanent signals until the adapter itself stops returning them
 * (e.g. the status changes).
 */
export const attendanceSource: TasteSource = {
    id: 'attendance',
    async collect({ userId, supabase }) {
        const { data, error } = await supabase
            .from('attendance')
            .select('status, rating, events(date, lineups(artist_id))')
            .eq('user_id', userId)

        if (error || !data) return []

        const signals: TasteSignal[] = []
        for (const row of data as unknown as AttendanceRow[]) {
            const artistIds = row.events?.lineups?.map((l) => l.artist_id) ?? []
            for (const artistId of artistIds) signals.push(signalFor(row, artistId))
        }
        return signals
    },
}

function signalFor(row: AttendanceRow, artistId: string): TasteSignal {
    const base = { source: 'attendance' as const, kind: 'artist' as const, ref: artistId, prior: false }

    if (row.status === 'went') {
        return { ...base, weight: wentWeight(row.rating ?? 0), observedAt: row.events?.date ?? null, halfLifeDays: WENT_HALF_LIFE_DAYS }
    }
    if (row.status === 'going') {
        return { ...base, weight: GOING_WEIGHT, observedAt: null, halfLifeDays: null }
    }
    return { ...base, weight: INTERESTED_WEIGHT, observedAt: null, halfLifeDays: null }
}
