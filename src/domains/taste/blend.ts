/**
 * Blends every source's signals into one read model. Pure and
 * source-agnostic: it only reads `TasteSignal` fields, so a brand-new
 * `TasteSource` needs no change here — see spec "New source requires no
 * consumer change".
 *
 * Declared genres ARE honest personalization (JD-003): `basis` is
 * 'declared-genres', not 'none', when only priors exist. `realSignalCount`
 * is used only to fade the priors as real behavior accumulates, never to
 * gate the basis/hasAnySignal labels.
 */
import type { TasteBasis, TasteProfile, TasteSignal, TasteSourceId } from '@/src/domains/taste/types'
import { priorFade } from '@/src/domains/taste/weights'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface BlendContext {
    now: Date
    artistGenres: ReadonlyMap<string, readonly string[]>
}

export function blendTasteProfile(signals: readonly TasteSignal[], ctx: BlendContext): TasteProfile {
    const realSignalCount = signals.filter((s) => !s.prior).length

    const artistAffinity = new Map<string, number>()
    const genreAffinity = new Map<string, number>()
    const sources: TasteSourceId[] = []
    const seenSources = new Set<TasteSourceId>()

    for (const signal of signals) {
        if (!seenSources.has(signal.source)) {
            seenSources.add(signal.source)
            sources.push(signal.source)
        }

        const decay = signal.prior
            ? priorFade(realSignalCount)
            : timeDecay(ctx.now, signal.observedAt, signal.halfLifeDays)
        const contribution = signal.weight * decay

        if (signal.kind === 'genre') {
            addTo(genreAffinity, signal.ref, contribution)
            continue
        }

        addTo(artistAffinity, signal.ref, contribution)
        const genres = ctx.artistGenres.get(signal.ref) ?? []
        if (genres.length > 0) {
            const perGenre = contribution / genres.length
            for (const genre of genres) addTo(genreAffinity, genre, perGenre)
        }
    }

    const hasPrior = signals.some((s) => s.prior)
    const basis: TasteBasis = realSignalCount > 0 ? 'behavior' : hasPrior ? 'declared-genres' : 'none'

    return {
        artistAffinity,
        genreAffinity,
        realSignalCount,
        hasAnySignal: basis !== 'none',
        basis,
        sources,
    }
}

function addTo(map: Map<string, number>, key: string, amount: number): void {
    map.set(key, (map.get(key) ?? 0) + amount)
}

/**
 * Exponential half-life decay. Priors (`halfLifeDays: null`) and signals
 * without an observed date never decay by time — priors decay by
 * `realSignalCount` instead (see `priorFade`).
 */
function timeDecay(now: Date, observedAt: string | null, halfLifeDays: number | null): number {
    if (halfLifeDays === null || observedAt === null) return 1
    const daysSince = (now.getTime() - new Date(observedAt).getTime()) / MS_PER_DAY
    if (daysSince <= 0) return 1
    return Math.pow(0.5, daysSince / halfLifeDays)
}
