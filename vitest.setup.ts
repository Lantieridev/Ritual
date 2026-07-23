import '@testing-library/jest-dom/vitest'
import React from 'react'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

// Bajo Vitest no hay bundler real que distinga bundles de cliente/servidor
// (eso solo lo hace webpack en un build real de Next.js), así que el guard
// de 'server-only' no tiene nada que vigilar acá — solo rompe cualquier
// import que toque, transitivamente, un módulo que lo declare. Global en
// vez de repetir `vi.mock('server-only', () => ({}))` en cada test file.
vi.mock('server-only', () => ({}))

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripped so they don't land on the DOM <img>
    const { fill, priority, ...rest } = props
    return React.createElement('img', rest)
  },
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...rest }, children),
}))
