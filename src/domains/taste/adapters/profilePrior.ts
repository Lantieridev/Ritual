import type { TasteSignal, TasteSource } from '@/src/domains/taste/types'

/** Weight of a single declared genre before `priorFade` decays it by real signal count. */
const PRIOR_GENRE_WEIGHT = 1

/** Declared signup/profile genres — the only prior source (JD-003: honest personalization). */
export const profilePriorSource: TasteSource = {
    id: 'profile-prior',
    async collect({ userId, supabase }) {
        const { data, error } = await supabase
            .from('taste_profiles')
            .select('favorite_genre_keys')
            .eq('user_id', userId)
            .maybeSingle()

        if (error || !data) return []

        return data.favorite_genre_keys.map(
            (key: string): TasteSignal => ({
                source: 'profile-prior',
                kind: 'genre',
                ref: key,
                weight: PRIOR_GENRE_WEIGHT,
                observedAt: null,
                halfLifeDays: null,
                prior: true,
            })
        )
    },
}
