/**
 * Centralized, typed env var accessors with startup validation.
 * Import this instead of process.env directly in server-side code.
 *
 * Call `validateEnv()` in next.config.ts to fail fast at build/start time.
 */

// ─── Required ────────────────────────────────────────────────────────────────

export function getSupabaseUrl(): string {
    const v = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!v?.trim()) throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_URL')
    return v.trim()
}

export function getSupabaseAnonKey(): string {
    const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!v?.trim()) throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY')
    return v.trim()
}

// ─── Optional (external APIs) ─────────────────────────────────────────────────

export function getTicketmasterApiKey(): string | undefined {
    return process.env.TICKETMASTER_API_KEY?.trim() || undefined
}

export function getSetlistFmApiKey(): string | undefined {
    return process.env.SETLISTFM_API_KEY?.trim() || undefined
}

export function getLastFmApiKey(): string | undefined {
    return process.env.LASTFM_API_KEY?.trim() || undefined
}

export function getSpotifyClientId(): string | undefined {
    return process.env.SPOTIFY_CLIENT_ID?.trim() || undefined
}

export function getSpotifyClientSecret(): string | undefined {
    return process.env.SPOTIFY_CLIENT_SECRET?.trim() || undefined
}

export function getBandsintownAppId(): string | undefined {
    return process.env.BANDSINTOWN_APP_ID?.trim() || undefined
}

// ─── Dev helpers ─────────────────────────────────────────────────────────────

export function getDevUserId(): string {
    // Hardcoded single-player UUID — replace with auth.uid() when auth is added.
    return '00000000-0000-0000-0000-000000000001'
}

// ─── Startup validation ───────────────────────────────────────────────────────

/**
 * Call this at build/startup time to fail fast if required env vars are missing.
 * Optional vars are logged as warnings, not errors.
 */
export function validateEnv(): void {
    const errors: string[] = []
    const warnings: string[] = []

    // Required
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim())
        errors.push('NEXT_PUBLIC_SUPABASE_URL')
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim())
        errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')

    // Optional — warn if missing
    const optionals = [
        'TICKETMASTER_API_KEY',
        'SETLISTFM_API_KEY',
        'LASTFM_API_KEY',
        'SPOTIFY_CLIENT_ID',
        'SPOTIFY_CLIENT_SECRET',
    ]
    for (const key of optionals) {
        if (!process.env[key]?.trim()) warnings.push(key)
    }

    if (errors.length > 0) {
        throw new Error(
            `[RITUAL] Missing required environment variables:\n  ${errors.join('\n  ')}\n` +
            `Check your .env.local file.`
        )
    }

    if (warnings.length > 0 && process.env.NODE_ENV !== 'test') {
        console.warn(
            `[RITUAL] Optional env vars not set (some features will be disabled):\n  ${warnings.join(', ')}`
        )
    }
}
