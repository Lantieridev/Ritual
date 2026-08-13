/**
 * Blends Last.fm's `geo.getTopArtists` rank with in-app "went" attendance
 * into a single normalized `peso` in [0, 1]. Pure: the refresh cron (unit 10)
 * supplies the inputs, this only does the math.
 *
 * `wentCount` below 3 is treated as 0 in the formula, not just at storage
 * time — see spec "Attendance counts never identify individuals" (JD-008):
 * a 1-2 attendee count would otherwise leak who went to a niche show.
 */

const WENT_PRIVACY_THRESHOLD = 3
const BASELINE = 0.1
const SPREAD = 0.9
const GEO_SHARE = 0.6
const ATTENDANCE_SHARE = 0.4

export interface ArtistImportanceInput {
    /** 1-based rank in `geo.getTopArtists`, or null when the artist has no geo data. */
    geoRank: number | null
    /** Size of the geo ranking geoRank came from (e.g. 200 for 4 pages of 50). */
    geoTotal: number
    wentCount: number
    /** Highest counted (>= 3, or 0) went count across the catalog, for normalization. */
    maxWent: number
}

export function computeArtistImportance(input: ArtistImportanceInput): number {
    const countedWent = input.wentCount >= WENT_PRIVACY_THRESHOLD ? input.wentCount : 0
    const countedMaxWent = Math.max(input.maxWent, 1)

    const geo =
        input.geoRank !== null && input.geoTotal > 0
            ? 1 - (input.geoRank - 1) / input.geoTotal
            : 0
    const attendance = Math.log(1 + countedWent) / Math.log(1 + countedMaxWent)

    return BASELINE + SPREAD * (GEO_SHARE * geo + ATTENDANCE_SHARE * attendance)
}
