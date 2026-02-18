import type { NextConfig } from 'next'
import { validateEnv } from './src/core/lib/env'

// Fail fast at build/start time if required env vars are missing
validateEnv()

// ─── Security Headers ─────────────────────────────────────────────────────────
// Applied to every response. Adjust CSP as new external resources are added.
const securityHeaders = [
  // Prevent clickjacking
  { key: 'X-Frame-Options', value: 'DENY' },
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Control referrer info sent to third parties
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable unused browser features
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  // Force HTTPS (1 year, include subdomains)
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  // Content Security Policy
  // - default-src 'self': only load resources from same origin by default
  // - script-src: allow Next.js inline scripts (nonces would be better but require middleware)
  // - img-src: allow Spotify and Last.fm image CDNs
  // - connect-src: allow Supabase API calls from the browser
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js requires 'unsafe-inline' and 'unsafe-eval' in dev; in prod only 'unsafe-inline' for hydration
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://i.scdn.co https://lastfm.freetls.fastly.net https://s1.ticketm.net https://images.sk-static.com https://upload.wikimedia.org https://*.supabase.co",
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} https://accounts.spotify.com https://api.spotify.com`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

// Pages with personal data that should not be indexed
const noIndexHeaders = [
  ...securityHeaders,
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
]

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Spotify artist images
      { protocol: 'https', hostname: 'i.scdn.co' },
      // Last.fm artist images
      { protocol: 'https', hostname: 'lastfm.freetls.fastly.net' },
      // Ticketmaster event images
      { protocol: 'https', hostname: 's1.ticketm.net' },
      // Songkick / Setlist.fm static images
      { protocol: 'https', hostname: 'images.sk-static.com' },
      // Wikipedia / Wikimedia placeholders
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      // Supabase Storage (artist photos uploaded manually)
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },

  async headers() {
    return [
      // Apply security headers to all routes
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // No-index for personal/private pages
      {
        source: '/stats',
        headers: noIndexHeaders,
      },
      {
        source: '/events/:path*',
        headers: noIndexHeaders,
      },
      {
        source: '/expenses/:path*',
        headers: noIndexHeaders,
      },
    ]
  },
}

export default nextConfig
