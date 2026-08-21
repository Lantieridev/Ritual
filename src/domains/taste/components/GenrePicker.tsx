'use client'

import { useState } from 'react'
import { MAX_GENRES } from '@/src/domains/taste/parseSignupTaste'
import type { GenreOption } from '@/src/domains/taste/data'

/*
 * Mismo troquel de chip que `FirstTimeHero` (src/domains/events/components/
 * HomeHeroStates.tsx) — el diseño no define un control propio para géneros,
 * así que reutiliza el existente en vez de inventar uno nuevo. Seleccionado
 * pisa el borde/texto por los tokens que pide el diseño (border-ritual-red +
 * text-ritual-bone); todo lo demás es el mismo valor que ya está en pantalla.
 */
const CHIP_BASE =
  'min-h-[48px] flex items-center gap-2 px-[14px] border font-figure text-[17px] tracking-[0.08em] uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ritual-red disabled:opacity-50 disabled:cursor-not-allowed'
const CHIP_UNSELECTED = 'border-ritual-mobile-line text-ritual-gray-light-3'
const CHIP_SELECTED = 'border-ritual-red text-ritual-bone'

export interface GenrePickerProps {
  genres: readonly GenreOption[]
  /** Nombre de los inputs ocultos que arma el picker — el mismo que lee la Server Action con `formData.getAll(...)`. */
  name?: string
  defaultSelected?: readonly string[]
  /** Id del texto visible que titula el grupo; sin él, el grupo se nombra con un aria-label genérico. */
  labelledBy?: string
}

/**
 * Selector de hasta `MAX_GENRES` géneros favoritos (signup y perfil). No es un
 * `<select multiple>`: cada chip es un botón que alterna estado local y
 * refleja la selección en inputs ocultos, para que un `<form action={...}>`
 * de Server Action reciba los valores con `formData.getAll(name)` sin JS
 * adicional en el submit.
 */
export function GenrePicker({ genres, name = 'genres', defaultSelected = [], labelledBy }: GenrePickerProps) {
  const [selected, setSelected] = useState<string[]>(() => [...defaultSelected])

  function toggle(key: string) {
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key)
      if (prev.length >= MAX_GENRES) return prev
      return [...prev, key]
    })
  }

  return (
    <div className="space-y-1.5">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        {...(labelledBy ? { 'aria-labelledby': labelledBy } : { 'aria-label': 'Géneros favoritos' })}
      >
        {genres.map((genre) => {
          const isSelected = selected.includes(genre.key)
          const disabled = !isSelected && selected.length >= MAX_GENRES
          return (
            <button
              key={genre.key}
              type="button"
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => toggle(genre.key)}
              className={`${CHIP_BASE} ${isSelected ? CHIP_SELECTED : CHIP_UNSELECTED}`}
            >
              {genre.label}
            </button>
          )
        })}
      </div>
      {selected.map((key) => (
        <input key={key} type="hidden" name={name} value={key} />
      ))}
    </div>
  )
}
