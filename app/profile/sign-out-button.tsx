'use client'

import { signout } from '@/src/core/auth/actions'

export function SignOutButton() {
    return (
        <button
            onClick={() => signout()}
            className="text-sm text-red-400 hover:text-red-300 transition-colors"
        >
            Cerrar Sesión
        </button>
    )
}
