import { NextResponse } from 'next/server'
import { createClient } from '@/src/core/lib/supabase/server'
import { sanitizeAuthError } from '@/src/core/lib/validation'

// Solo permite rutas internas relativas (un solo "/" inicial, sin "//" ni
// esquema) para evitar que "next" se use como open-redirect.
function safeNextPath(raw: string | null): string {
    if (!raw) return '/'
    if (!raw.startsWith('/') || raw.startsWith('//')) return '/'
    if (raw.includes('://')) return '/'
    return raw
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = safeNextPath(searchParams.get('next'))

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            return NextResponse.redirect(`${origin}${next}`)
        }
        console.error('Auth Code Exchange Error:', error)
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(sanitizeAuthError(error))}`)
    }

    return NextResponse.redirect(`${origin}/login?error=No+code+verifier`)
}
