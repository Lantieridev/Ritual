'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Button, inputClass } from '@/src/core/components/ui'
import { routes } from '@/src/core/lib/routes'
import { checklistProgress } from '@/src/domains/showmode/checklist'
import type { ResolvedChecklistItem } from '@/src/domains/showmode/checklist'
import type { ActionResult } from '@/src/core/types'

interface PreShowChecklistProps {
  eventId: string
  initialItems: ResolvedChecklistItem[]
  setChecked: (
    eventId: string,
    itemId: string,
    source: 'template' | 'adhoc',
    checked: boolean
  ) => Promise<ActionResult>
  addItem: (
    eventId: string,
    label: string
  ) => Promise<ActionResult<{ id?: string; label?: string; position?: number }>>
  removeItem: (eventId: string, id: string) => Promise<ActionResult>
}

/**
 * Checklist pre-show del issue #9: la plantilla base del usuario más los
 * ítems puntuales de este show, en una sola lista.
 *
 * Estado local igual que EventExpensesPanel y PhotoGallery — tildar algo no
 * puede costar un reload de la página entera. El tilde es optimista y se
 * revierte si la action falla: es la interacción más repetida de la pantalla
 * y esperar el round-trip por cada tick la haría sentir rota.
 *
 * Los ítems de la plantilla no se borran desde acá a propósito: son la
 * plantilla base "configurada una vez" del issue, así que borrarlos desde un
 * show sería borrarlos de todos. Se editan en los ajustes, y el link está
 * abajo de la lista.
 */
export function PreShowChecklist({
  eventId,
  initialItems,
  setChecked,
  addItem,
  removeItem,
}: PreShowChecklistProps) {
  const [items, setItems] = useState<ResolvedChecklistItem[]>(initialItems)
  const [showAdd, setShowAdd] = useState(false)
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const progress = checklistProgress(items)

  function applyChecked(itemId: string, source: string, checked: boolean) {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId && i.source === source ? { ...i, checked } : i))
    )
  }

  function handleToggle(item: ResolvedChecklistItem) {
    const next = !item.checked
    applyChecked(item.id, item.source, next)
    setError(null)
    startTransition(async () => {
      const result = await setChecked(eventId, item.id, item.source, next)
      if (result.error) {
        applyChecked(item.id, item.source, item.checked)
        setError(result.error)
      }
    })
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const clean = label.trim()
    if (!clean) return
    setError(null)
    startTransition(async () => {
      const result = await addItem(eventId, clean)
      if (result.error || !result.id) {
        setError(result.error ?? 'No se pudo agregar el ítem.')
        return
      }
      setItems((prev) => [
        ...prev,
        { id: result.id!, label: result.label ?? clean, checked: false, source: 'adhoc' },
      ])
      setLabel('')
      setShowAdd(false)
    })
  }

  function handleRemove(item: ResolvedChecklistItem) {
    setError(null)
    startTransition(async () => {
      const result = await removeItem(eventId, item.id)
      if (result.error) {
        setError(result.error)
        return
      }
      setItems((prev) => prev.filter((i) => !(i.id === item.id && i.source === 'adhoc')))
    })
  }

  return (
    <div className="space-y-4" data-testid="pre-show-checklist">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-label text-xs tracking-[0.1em] uppercase text-ritual-gray-text">
          {progress.total === 0
            ? 'Sin ítems todavía'
            : `${progress.done} de ${progress.total} listo${progress.done === 1 ? '' : 's'}`}
        </p>
        {!showAdd && (
          <Button type="button" variant="secondary" className="px-4 py-2" onClick={() => setShowAdd(true)}>
            + Ítem para este show
          </Button>
        )}
      </div>

      {progress.total > 0 && (
        <div
          className="h-[3px] bg-ritual-border"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          aria-label="Progreso del checklist"
        >
          <div
            className={progress.isComplete ? 'h-full bg-ritual-bone' : 'h-full bg-ritual-red'}
            style={{ width: `${Math.round(progress.ratio * 100)}%` }}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="font-body text-sm text-ritual-red-hover">
          {error}
        </p>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} className="flex flex-wrap gap-2 border border-ritual-border bg-ritual-surface p-4">
          <label htmlFor="checklist-new-item" className="sr-only">
            Ítem para este show
          </label>
          <input
            id="checklist-new-item"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej. Cargar la SUBE"
            maxLength={120}
            className={`${inputClass} flex-1 min-w-[180px]`}
          />
          <Button type="submit" variant="primary" disabled={isPending} className="px-4 py-2">
            {isPending ? 'Guardando...' : 'Agregar'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="px-4 py-2"
            onClick={() => {
              setShowAdd(false)
              setLabel('')
            }}
          >
            Cancelar
          </Button>
        </form>
      )}

      {items.length === 0 ? (
        <p className="font-body text-sm text-ritual-gray-text">
          Todavía no armaste tu plantilla base.{' '}
          <Link
            href={routes.showMode}
            className="text-ritual-red-hover underline underline-offset-4"
          >
            Configurala una vez
          </Link>{' '}
          y aparece sola en todos tus shows.
        </p>
      ) : (
        <ul className="divide-y divide-ritual-border-subtle">
          {items.map((item) => (
            <li key={`${item.source}-${item.id}`} className="flex items-center gap-3 py-2.5">
              <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => handleToggle(item)}
                  className="w-4 h-4 shrink-0 accent-ritual-red"
                />
                <span
                  className={
                    item.checked
                      ? 'font-body text-sm text-ritual-gray-text line-through'
                      : 'font-body text-sm text-ritual-bone'
                  }
                >
                  {item.label}
                </span>
              </label>
              {item.source === 'adhoc' ? (
                <button
                  type="button"
                  onClick={() => handleRemove(item)}
                  className="font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-text hover:text-ritual-red-hover transition-colors shrink-0"
                >
                  Quitar
                </button>
              ) : (
                <span
                  className="font-label text-[9px] tracking-[0.1em] uppercase text-ritual-gray-muted-2 shrink-0"
                  title="Viene de tu plantilla base"
                >
                  Plantilla
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
