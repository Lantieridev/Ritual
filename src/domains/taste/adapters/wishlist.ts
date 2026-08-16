import type { TasteSignal, TasteSource } from '@/src/domains/taste/types'
import { WISHLIST_WEIGHT } from '@/src/domains/taste/weights'

/** Artists the user follows (issue #22's wishlist table) — a flat signal, no time decay. */
export const wishlistSource: TasteSource = {
    id: 'wishlist',
    async collect({ userId, supabase }) {
        const { data, error } = await supabase.from('wishlist').select('artist_id').eq('user_id', userId)

        if (error || !data) return []

        return data.map(
            (row): TasteSignal => ({
                source: 'wishlist',
                kind: 'artist',
                ref: row.artist_id,
                weight: WISHLIST_WEIGHT,
                observedAt: null,
                halfLifeDays: null,
                prior: false,
            })
        )
    },
}
