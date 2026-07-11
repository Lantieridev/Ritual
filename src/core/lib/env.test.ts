import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getSupabaseUrl,
  getSupabaseAnonKey,
  getTicketmasterApiKey,
  getSetlistFmApiKey,
  getLastFmApiKey,
  getSpotifyClientId,
  getSpotifyClientSecret,
  validateEnv,
} from '@/src/core/lib/env'

const REQUIRED_KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
const OPTIONAL_KEYS = [
  'TICKETMASTER_API_KEY',
  'SETLISTFM_API_KEY',
  'LASTFM_API_KEY',
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
]

describe('required env accessors', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns the trimmed value when set', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '  https://example.supabase.co  ')
    expect(getSupabaseUrl()).toBe('https://example.supabase.co')
  })

  it('throws a descriptive error when missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    expect(() => getSupabaseUrl()).toThrow('NEXT_PUBLIC_SUPABASE_URL')
  })

  it('throws when the anon key is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
    expect(() => getSupabaseAnonKey()).toThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  })
})

describe('optional env accessors', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns the trimmed value when set', () => {
    vi.stubEnv('TICKETMASTER_API_KEY', '  abc123  ')
    expect(getTicketmasterApiKey()).toBe('abc123')
  })

  it('returns undefined when unset for every optional key', () => {
    vi.stubEnv('TICKETMASTER_API_KEY', '')
    vi.stubEnv('SETLISTFM_API_KEY', '')
    vi.stubEnv('LASTFM_API_KEY', '')
    vi.stubEnv('SPOTIFY_CLIENT_ID', '')
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', '')

    expect(getTicketmasterApiKey()).toBeUndefined()
    expect(getSetlistFmApiKey()).toBeUndefined()
    expect(getLastFmApiKey()).toBeUndefined()
    expect(getSpotifyClientId()).toBeUndefined()
    expect(getSpotifyClientSecret()).toBeUndefined()
  })
})

describe('validateEnv', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
    for (const key of OPTIONAL_KEYS) vi.stubEnv(key, 'set')
    vi.stubEnv('NODE_ENV', 'production')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('does not throw when all required vars are set', () => {
    expect(() => validateEnv()).not.toThrow()
  })

  it('throws listing every missing required var', () => {
    for (const key of REQUIRED_KEYS) vi.stubEnv(key, '')

    expect(() => validateEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
    expect(() => validateEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/)
  })

  it('warns (does not throw) about missing optional vars outside of test env', () => {
    for (const key of OPTIONAL_KEYS) vi.stubEnv(key, '')

    expect(() => validateEnv()).not.toThrow()
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('TICKETMASTER_API_KEY'))
  })

  it('suppresses the optional-vars warning when NODE_ENV is test', () => {
    vi.stubEnv('NODE_ENV', 'test')
    for (const key of OPTIONAL_KEYS) vi.stubEnv(key, '')

    validateEnv()

    expect(console.warn).not.toHaveBeenCalled()
  })
})
