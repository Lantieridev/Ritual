import type { TasteSignal, TasteSource } from '@/src/domains/taste/types'
import { lastfmWeight } from '@/src/domains/taste/weights'

/**
 * The user's imported Last.fm top artists (`lastfm_imports`), already matched
 * to the catalog by `importLastfmForUser`. Rows still unmatched (`artist_id
 * is null`) can't contribute an artist-affinity signal, so they're excluded
 * here — not an error, just nothing to blend for that row yet.
 */
export const lastfmSource: TasteSource = {
    id: 'lastfm',
    async collect({ userId, supabase }) {
        const { data, error } = await supabase
            .from('lastfm_imports')
            .select('artist_id, rank')
            .eq('user_id', userId)
            .not('artist_id', 'is', null)

        if (error || !data) return []

        return data.map(
            (row): TasteSignal => ({
                source: 'lastfm',
                kind: 'artist',
                ref: row.artist_id as string,
                weight: lastfmWeight(row.rank),
                observedAt: null,
                halfLifeDays: null,
                prior: false,
            })
        )
    },
}
