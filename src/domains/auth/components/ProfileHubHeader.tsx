'use client'

import { useState } from 'react'
import Image from 'next/image'
import { routes } from '@/src/core/lib/routes'
import { signout } from '@/src/core/auth/actions'
import { BottomSheet, BottomSheetItem } from '@/src/core/components/ui'

interface ProfileHubHeaderProps {
    eyebrow: string
    displayName: string
    monogram: string
    avatarUrl: string | null
    statsLine: string
}

/**
 * Header del hub "Vos" (`app/profile`, mobile) + su sheet de cuenta.
 *
 * Único cliente de este WU (D-3, design perfil-mobile): sólo el sheet
 * necesita estado (`open`), `ProfileHubGrid`/`ShortcutCell` quedan server.
 * `BottomSheet` es controlado (D-3) — este componente es su primer
 * consumidor real en el repo.
 */
export function ProfileHubHeader({ eyebrow, displayName, monogram, avatarUrl, statsLine }: ProfileHubHeaderProps) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <div className="px-5 pt-14 pb-[22px] border-b border-ritual-surface-high">
                <div className="flex items-center justify-between">
                    <p className="font-label text-[9px] tracking-[0.24em] uppercase text-ritual-red">{eyebrow}</p>
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        aria-label="Ajustes de la cuenta"
                        className="min-w-[48px] min-h-[44px] flex items-center justify-end font-label text-[17px] text-ritual-gray-text"
                    >
                        ···
                    </button>
                </div>
                <div className="flex items-end gap-3.5 mt-3.5">
                    {avatarUrl ? (
                        <div className="relative h-[104px] w-[82px] shrink-0 ritual-photo">
                            <Image src={avatarUrl} alt="" fill sizes="82px" className="object-cover object-[50%_30%]" />
                        </div>
                    ) : (
                        <div className="flex h-[104px] w-[82px] shrink-0 items-center justify-center border-2 border-ritual-red bg-ritual-surface">
                            <span className="font-display text-4xl text-ritual-red-hover">{monogram}</span>
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="font-display text-[38px] leading-[0.92] uppercase text-ritual-bone">{displayName}</p>
                        <p className="mt-1.5 font-label text-[9px] tracking-[0.14em] uppercase text-ritual-gray-mid-2">{statsLine}</p>
                    </div>
                </div>
            </div>

            <BottomSheet open={open} onClose={() => setOpen(false)} title="Tu cuenta" subtitle="Ajustes y datos">
                <BottomSheetItem to={`${routes.profile}/edit`} label="Editar perfil" hint="Nombre, foto, bio" />
                <BottomSheetItem to={routes.stats} label="Números" hint="Tu año en datos" />
                <BottomSheetItem to={routes.expenses.list} label="Gastos" hint="Lo que llevás gastado" />
                <BottomSheetItem to={routes.wrapped} label="Wrapped" hint="Para compartir" tone="acento" />
                <BottomSheetItem onClick={() => signout()} label="Cerrar sesión" hint="Volvés al talón de acceso" tone="apagado" />
            </BottomSheet>
        </>
    )
}
