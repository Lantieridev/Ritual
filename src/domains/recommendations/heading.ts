/**
 * The strip's title + note — pure, and true for every basis/data state
 * (JD-001/003/008). Every branch below traces to one row of the design's
 * truth table; "sin personalizar" depends only on `basis === 'none'`, and
 * the missing-city copy depends only on the city TEXT being null, never on
 * whether coordinates resolved.
 */
import type { StripHeadingInput, StripMode } from './types'

export interface StripHeading {
    mode: StripMode
    title: string
    note: string
}

const GUEST_TITLE = 'Los más escuchados y vistos del país'

export function stripHeading(input: StripHeadingInput): StripHeading {
    const { basis, hasCoords, city, sources, declaredGenreLabels } = input

    if (basis === 'none') {
        return {
            mode: 'general',
            title: GUEST_TITLE,
            note: city === null ? 'Sin personalizar · falta tu ciudad' : 'Sin personalizar · cargá shows o elegí géneros',
        }
    }

    const prefix = hasCoords ? 'Cerca tuyo' : 'Para vos'
    const tail = hasCoords && city !== null ? ` · ${city}` : ''

    if (basis === 'declared-genres') {
        const labels = declaredGenreLabels.length > 0 ? declaredGenreLabels.join(', ') : 'tus géneros'
        return {
            mode: 'personal',
            title: `${prefix}, de tus géneros`,
            note: `Ordenado por artista + ${labels} + fecha${tail}`,
        }
    }

    return behaviorHeading(prefix, tail, sources)
}

function behaviorHeading(prefix: string, tail: string, sources: StripHeadingInput['sources']): StripHeading {
    const hasLastfm = sources.includes('lastfm')
    const hasAttendance = sources.includes('attendance')
    const hasWishlist = sources.includes('wishlist')

    // The title joins multiple contributing sources with "y"; the note lists
    // them as separate "+" terms alongside "fecha" — same content, different grammar.
    let titleSubject: string
    let noteTerms: string
    if (hasLastfm) {
        titleSubject = 'lo que escuchás'
        noteTerms = 'lo que escuchás'
    } else if (hasAttendance && hasWishlist) {
        titleSubject = 'tus shows y tu wishlist'
        noteTerms = 'tus shows + tu wishlist'
    } else if (hasAttendance) {
        titleSubject = 'tus shows'
        noteTerms = 'tus shows'
    } else if (hasWishlist) {
        titleSubject = 'tu wishlist'
        noteTerms = 'tu wishlist'
    } else {
        titleSubject = 'lo que cargaste'
        noteTerms = 'lo que cargaste'
    }

    return {
        mode: 'personal',
        title: `${prefix}, de ${titleSubject}`,
        note: `Ordenado por artista + ${noteTerms} + fecha${tail}`,
    }
}
