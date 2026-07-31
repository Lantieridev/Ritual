'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { inputClass } from './FormField'

export interface ComboboxOption {
    id: string
    label: string
    sublabel?: string
}

interface ComboboxProps {
    /** Para asociar con un <label htmlFor> externo (ej. de FormField). */
    id?: string
    options: ComboboxOption[]
    placeholder?: string
    /** Etiquetas ya elegidas en otro lado (ej. artistas ya en el lineup) — se excluyen de la lista. */
    excludeIds?: Set<string>
    onSelect: (option: ComboboxOption) => void
    /** Si se pasa, habilita "+ Crear '{query}'" cuando no hay ningún match exacto. */
    onCreate?: (query: string) => Promise<ComboboxOption | { error: string }>
    disabled?: boolean
}

const MAX_VISIBLE_OPTIONS = 8

/**
 * Buscar-y-elegir con creación inline. Sin esto, si un venue o artista no
 * existía, el único camino era abandonar el formulario de recital, crearlo
 * en otra pantalla, y volver a empezar.
 */
export function Combobox({ id, options, placeholder, excludeIds, onSelect, onCreate, disabled }: ComboboxProps) {
    const [query, setQuery] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(0)
    const [isCreating, setIsCreating] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)
    const rootRef = useRef<HTMLDivElement>(null)
    const listboxId = useId()

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const normalizedQuery = query.trim().toLowerCase()
    const filtered = options
        .filter((o) => !excludeIds?.has(o.id))
        .filter((o) => !normalizedQuery || o.label.toLowerCase().includes(normalizedQuery))
        .slice(0, MAX_VISIBLE_OPTIONS)

    const hasExactMatch = options.some((o) => o.label.toLowerCase() === normalizedQuery)
    const showCreateOption = Boolean(onCreate) && normalizedQuery.length > 0 && !hasExactMatch

    const rows: Array<{ kind: 'option'; option: ComboboxOption } | { kind: 'create' }> = [
        ...filtered.map((option) => ({ kind: 'option' as const, option })),
        ...(showCreateOption ? [{ kind: 'create' as const }] : []),
    ]

    function selectOption(option: ComboboxOption) {
        onSelect(option)
        setQuery('')
        setIsOpen(false)
        setCreateError(null)
    }

    async function handleCreate() {
        if (!onCreate || !query.trim()) return
        setIsCreating(true)
        setCreateError(null)
        try {
            const result = await onCreate(query.trim())
            if ('error' in result) {
                setCreateError(result.error)
                return
            }
            selectOption(result)
        } finally {
            setIsCreating(false)
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!isOpen) {
            if (e.key === 'ArrowDown') setIsOpen(true)
            return
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlightedIndex((i) => Math.min(i + 1, rows.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlightedIndex((i) => Math.max(i - 1, 0))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            const row = rows[highlightedIndex]
            if (!row) return
            if (row.kind === 'option') selectOption(row.option)
            else handleCreate()
        } else if (e.key === 'Escape') {
            setIsOpen(false)
        }
    }

    return (
        <div className="relative" ref={rootRef}>
            <input
                id={id}
                type="text"
                role="combobox"
                aria-expanded={isOpen}
                aria-controls={listboxId}
                autoComplete="off"
                className={inputClass}
                placeholder={placeholder}
                value={query}
                disabled={disabled}
                onChange={(e) => {
                    setQuery(e.target.value)
                    setIsOpen(true)
                    setHighlightedIndex(0)
                    setCreateError(null)
                }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleKeyDown}
            />

            {isOpen && rows.length > 0 && (
                <ul
                    id={listboxId}
                    role="listbox"
                    className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto border border-ritual-border bg-ritual-panel-2 shadow-xl py-1"
                >
                    {rows.map((row, i) => (
                        <li key={row.kind === 'option' ? row.option.id : '__create__'}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={i === highlightedIndex}
                                disabled={row.kind === 'create' && isCreating}
                                className={`w-full text-left px-3 py-2 font-body text-sm transition-colors ${i === highlightedIndex ? 'bg-ritual-surface-high text-ritual-bone' : 'text-ritual-gray-light-3'
                                    } ${row.kind === 'create' ? 'text-ritual-red' : ''}`}
                                onMouseEnter={() => setHighlightedIndex(i)}
                                onClick={() => (row.kind === 'option' ? selectOption(row.option) : handleCreate())}
                            >
                                {row.kind === 'option' ? (
                                    <>
                                        {row.option.label}
                                        {row.option.sublabel && (
                                            <span className="text-ritual-gray-mid"> · {row.option.sublabel}</span>
                                        )}
                                    </>
                                ) : (
                                    <>{isCreating ? 'Creando…' : `+ Crear "${query.trim()}"`}</>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {createError && (
                <p role="alert" className="mt-1 font-label text-xs text-ritual-red">
                    {createError}
                </p>
            )}
        </div>
    )
}
