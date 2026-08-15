import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()
const mockRedirect = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}))

vi.mock('@/src/domains/taste/service', () => ({
  listGenres: vi.fn(),
}))

import { login, signup, signout, requestPasswordReset, updatePassword } from '@/src/core/auth/actions'
import { listGenres } from '@/src/domains/taste/service'

function makeSupabase(opts: {
  signInError?: { message: string } | null
  signUpError?: { message: string } | null
  resetPasswordError?: { message: string } | null
  updateUserError?: { message: string } | null
}) {
  return {
    auth: {
      signInWithPassword: vi.fn(() => Promise.resolve({ error: opts.signInError ?? null })),
      signUp: vi.fn(() => Promise.resolve({ error: opts.signUpError ?? null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      resetPasswordForEmail: vi.fn(() => Promise.resolve({ error: opts.resetPasswordError ?? null })),
      updateUser: vi.fn(() => Promise.resolve({ error: opts.updateUserError ?? null })),
    },
  }
}

function makeFormData(fields: Record<string, string | string[]>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) {
      for (const item of v) fd.append(k, item)
    } else {
      fd.set(k, v)
    }
  }
  return fd
}

describe('login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects home on success', async () => {
    const supabase = makeSupabase({})
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    await login(null, makeFormData({ email: 'martin@example.com', password: 'secret123' }))

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'martin@example.com',
      password: 'secret123',
    })
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })

  it('returns a sanitized error and does not redirect on invalid credentials', async () => {
    const supabase = makeSupabase({ signInError: { message: 'Invalid login credentials' } })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await login(null, makeFormData({ email: 'martin@example.com', password: 'wrong' }))

    expect(result).toEqual({ error: 'Email o contraseña incorrectos.' })
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('never leaks a raw, unrecognized Supabase Auth error message to the client', async () => {
    const supabase = makeSupabase({ signInError: { message: 'relation "auth.users" does not exist' } })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await login(null, makeFormData({ email: 'martin@example.com', password: 'x' }))

    expect(result).toEqual({ error: 'Ocurrió un error inesperado. Intentá de nuevo.' })
  })
})

describe('signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listGenres).mockResolvedValue([
      { key: 'rock-nacional', label: 'Rock Nacional' },
      { key: 'indie', label: 'Indie' },
    ])
  })

  it('returns a success message on a genuinely new signup', async () => {
    const supabase = makeSupabase({})
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await signup(null, makeFormData({ email: 'new@example.com', password: 'secret123' }))

    expect(result).toEqual({ success: 'Revisá tu email para confirmar la cuenta.' })
  })

  it('signs up without any taste metadata when genres and birth year are both left blank', async () => {
    const supabase = makeSupabase({})
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    await signup(null, makeFormData({ email: 'new@example.com', password: 'secret123' }))

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'secret123',
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback',
      },
    })
  })

  it('stores the filtered genres, birth year, and location together in the signup metadata', async () => {
    const supabase = makeSupabase({})
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    await signup(
      null,
      makeFormData({
        email: 'new@example.com',
        password: 'secret123',
        location: 'Buenos Aires, Argentina',
        genres: ['rock-nacional', 'indie'],
        birthYear: '1995',
      })
    )

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'secret123',
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback',
        data: {
          location: 'Buenos Aires, Argentina',
          genres: ['rock-nacional', 'indie'],
          birth_year: 1995,
        },
      },
    })
  })

  it('drops genre keys that are not part of the canonical vocabulary', async () => {
    const supabase = makeSupabase({})
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    await signup(
      null,
      makeFormData({
        email: 'new@example.com',
        password: 'secret123',
        genres: ['rock-nacional', 'not-a-real-genre'],
      })
    )

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'secret123',
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback',
        data: { genres: ['rock-nacional'] },
      },
    })
  })

  it('returns the bad-year error and never calls signUp, so an implausible year cannot reach the trigger', async () => {
    const supabase = makeSupabase({})
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await signup(
      null,
      makeFormData({ email: 'new@example.com', password: 'secret123', birthYear: '1850' })
    )

    expect(result).toEqual({ error: 'Revisá el año de nacimiento.' })
    expect(supabase.auth.signUp).not.toHaveBeenCalled()
  })

  it(
    'returns the exact same success response when the email is already registered ' +
      '(prevents account enumeration — a caller must not be able to tell existing emails ' +
      'apart from new ones by response shape or content)',
    async () => {
      const supabase = makeSupabase({ signUpError: { message: 'User already registered' } })
      mockCreateClient.mockReturnValue(Promise.resolve(supabase))

      const result = await signup(null, makeFormData({ email: 'existing@example.com', password: 'secret123' }))

      expect(result).toEqual({ success: 'Revisá tu email para confirmar la cuenta.' })
    }
  )

  it('returns a sanitized error for a genuine validation failure (weak password)', async () => {
    const supabase = makeSupabase({
      signUpError: { message: 'Password should be at least 6 characters' },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await signup(null, makeFormData({ email: 'new@example.com', password: '123' }))

    expect(result).toEqual({ error: 'La contraseña debe tener al menos 6 caracteres.' })
  })
})

describe('signout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('signs out and redirects to /login', async () => {
    const supabase = makeSupabase({})
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    await signout()

    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })
})

describe('requestPasswordReset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error if email is missing', async () => {
    const result = await requestPasswordReset(null, makeFormData({ email: '' }))
    expect(result).toEqual({ error: 'El email es obligatorio.' })
  })

  it('calls resetPasswordForEmail with correct redirect URL and returns success', async () => {
    const supabase = makeSupabase({})
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await requestPasswordReset(null, makeFormData({ email: 'user@example.com' }))

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'http://localhost:3000/auth/callback?next=/reset-password',
    })
    expect(result).toEqual({
      success: 'Si el email está registrado, te enviamos las instrucciones para restablecer tu contraseña.',
    })
  })

  it('returns sanitized error when resetPasswordForEmail fails', async () => {
    const supabase = makeSupabase({
      resetPasswordError: { message: 'Rate limit exceeded' },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await requestPasswordReset(null, makeFormData({ email: 'user@example.com' }))

    expect(result).toEqual({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' })
  })
})

describe('updatePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error if password fields are missing', async () => {
    const result = await updatePassword(null, makeFormData({ password: '', confirmPassword: '' }))
    expect(result).toEqual({ error: 'Completá todos los campos.' })
  })

  it('returns error if passwords do not match', async () => {
    const result = await updatePassword(
      null,
      makeFormData({ password: 'newpassword123', confirmPassword: 'differentpassword' })
    )
    expect(result).toEqual({ error: 'Las contraseñas no coinciden.' })
  })

  it('returns error if password is shorter than 6 characters', async () => {
    const result = await updatePassword(
      null,
      makeFormData({ password: '12345', confirmPassword: '12345' })
    )
    expect(result).toEqual({ error: 'La contraseña debe tener al menos 6 caracteres.' })
  })

  it('calls updateUser and returns success when passwords match and are valid', async () => {
    const supabase = makeSupabase({})
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await updatePassword(
      null,
      makeFormData({ password: 'newpassword123', confirmPassword: 'newpassword123' })
    )

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newpassword123' })
    expect(result).toEqual({
      success: 'Tu contraseña fue actualizada correctamente. Ya podés ingresar.',
    })
  })

  it('returns sanitized error when updateUser fails', async () => {
    const supabase = makeSupabase({
      updateUserError: { message: 'Auth session missing' },
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await updatePassword(
      null,
      makeFormData({ password: 'newpassword123', confirmPassword: 'newpassword123' })
    )

    expect(result).toEqual({ error: 'El enlace de recuperación es inválido o venció. Solicitá uno nuevo.' })
  })
})
