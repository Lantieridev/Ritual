import { createServerClient } from '@supabase/ssr'
import { isAuthSessionMissingError } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    response = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const { data: { user }, error: getUserError } = await supabase.auth.getUser()
    if (getUserError && !isAuthSessionMissingError(getUserError)) {
        console.error('supabase.auth.getUser() failed in middleware:', getUserError)
    }

    // ─── Route Protection ────────────────────────────────────────────────────────
    const url = request.nextUrl.clone()
    const protectedPaths = ['/profile', '/wishlist', '/stats', '/expenses']
    const isProtected = protectedPaths.some((path) => url.pathname.startsWith(path))

    if (isProtected && !user) {
        url.pathname = '/login'
        url.searchParams.set('next', request.nextUrl.pathname)
        return NextResponse.redirect(url)
    }

    return response
}
