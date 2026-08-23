'use client'

import { useState, useTransition } from 'react'
import { Button, FormField, inputClass } from '@/src/core/components/ui'
import { SHOW_MODE_LIMITS } from '@/src/domains/showmode/preferences'
import type { ShowModePreferences } from '@/src/domains/showmode/preferences'
import type { ChecklistTemplateItem } from '@/src/domains/showmode/checklist'
import type { ActionResult } from '@/src/core/types'

interface ShowModeSettingsFormProps {
  initialPreferences: ShowModePreferences
  initialTemplateItems: ChecklistTemplateItem[]
  savePreferences: (input: ShowModePreferences) => Promise<ActionResult>
  addTemplateItem: (
    label: string
  ) => Promise<ActionResult<{ id?: string; label?: string; position?: number }>>
  removeTemplateItem: (id: string) => Promise<ActionResult>
}

/**
 * Ajustes del modo recital (issue #9): las dos cosas que el issue pide
 * configurar una sola vez — el largo de la ventana y la plantilla base del
 * checklist — en una sola pantalla, porque son la misma decisión ("cómo
 * quiero que la app me acompañe en un show") vista desde dos ángulos.
 *
 * Estado local y actions sin redirect, igual que el resto de los formularios
 * del proyecto: guardar la ventana no debería sacarte de la pantalla donde
 * estás armando la lista.
 */
export function ShowModeSettingsForm({
  initialPreferences,
  initialTemplateItems,
  savePreferences,
  addTemplateItem,
  removeTemplateItem,
}: ShowModeSettingsFormProps) {
  const [daysBefore, setDaysBefore] = useState(String(initialPreferences.daysBefore))
  const [daysAfter, setDaysAfter] = useState(String(initialPreferences.daysAfter))
  const [savedAt, setSavedAt] = useState(false)
  const [prefsError, setPrefsError] = useState<string | null>(null)

  const [items, setItems] = useState<ChecklistTemplateItem[]>(initialTemplateItems)
  const [label, setLabel] = useState('')
  const [itemsError, setItemsError] = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()

  function handleSavePreferences(e: React.FormEvent) {
    e.preventDefault()
    setPrefsError(null)
    setSavedAt(false)
    startTransition(async () => {
      const result = await savePreferences({
        daysBefore: Number(daysBefore),
        daysAfter: Number(daysAfter),
      })
      if (result.error) {
        setPrefsError(result.error)
        return
      }
      setSavedAt(true)
    })
  }

  function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    const clean = label.trim()
    if (!clean) return
    setItemsError(null)
    startTransition(async () => {
      const result = await addTemplateItem(clean)
      if (result.error || !result.id) {
        setItemsError(result.error ?? 'No se pudo agregar el ítem.')
        return
      }
      setItems((prev) => [
        ...prev,
        { id: result.id!, label: result.label ?? clean, position: result.position ?? prev.length },
      ])
      setLabel('')
    })
  }

  function handleRemoveItem(id: string) {
    setItemsError(null)
    startTransition(async () => {
      const result = await removeTemplateItem(id)
      if (result.error) {
        setItemsError(result.error)
        return
      }
      setItems((prev) => prev.filter((i) => i.id !== id))
    })
  }

  return (
    <div className="max-w-2xl space-y-12">
      {/* Ventana */}
      <section>
        <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">
          La ventana
        </h2>
        <p className="font-body text-sm text-ritual-gray-text mb-6">
          Cuántos días antes de un show la app entra en modo recital, y cuántos sigue activa después
          para que puedas cargar lo que quedó pendiente. En festivales la ventana arranca el primer
          día y termina después del último.
        </p>

        <form onSubmit={handleSavePreferences} className="space-y-5">
          {prefsError && (
            <p role="alert" className="font-body text-sm text-ritual-red-hover">
              {prefsError}
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-5">
            <FormField label="Días antes" id="show-mode-days-before">
              <input
                id="show-mode-days-before"
                type="number"
                min={SHOW_MODE_LIMITS.minDaysBefore}
                max={SHOW_MODE_LIMITS.maxDaysBefore}
                value={daysBefore}
                onChange={(e) => setDaysBefore(e.target.value)}
                className={inputClass}
              />
            </FormField>
            <FormField label="Días después" id="show-mode-days-after">
              <input
                id="show-mode-days-after"
                type="number"
                min={SHOW_MODE_LIMITS.minDaysAfter}
                max={SHOW_MODE_LIMITS.maxDaysAfter}
                value={daysAfter}
                onChange={(e) => setDaysAfter(e.target.value)}
                className={inputClass}
              />
            </FormField>
          </div>
          <div className="flex items-center gap-4">
            <Button type="submit" variant="primary" disabled={isPending} className="px-5 py-2.5">
              {isPending ? 'Guardando...' : 'Guardar ventana'}
            </Button>
            {savedAt && (
              <p role="status" className="font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-light-3">
                Guardado
              </p>
            )}
          </div>
        </form>
      </section>

      {/* Plantilla base */}
      <section className="border-t border-ritual-border-subtle pt-10">
        <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">
          Tu plantilla base
        </h2>
        <p className="font-body text-sm text-ritual-gray-text mb-6">
          Se configura una sola vez y aparece en el checklist de todos tus shows. Lo puntual de cada
          show lo agregás desde la ficha del evento, sin tocar esta lista.
        </p>

        {itemsError && (
          <p role="alert" className="font-body text-sm text-ritual-red-hover mb-4">
            {itemsError}
          </p>
        )}

        <form onSubmit={handleAddItem} className="flex flex-wrap gap-2 mb-6">
          <label htmlFor="template-new-item" className="sr-only">
            Nuevo ítem de la plantilla
          </label>
          <input
            id="template-new-item"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej. Entrada en el celular"
            maxLength={120}
            className={`${inputClass} flex-1 min-w-[200px]`}
          />
          <Button type="submit" variant="secondary" disabled={isPending} className="px-5 py-2.5">
            Agregar
          </Button>
        </form>

        {items.length === 0 ? (
          <p className="font-body text-sm text-ritual-gray-text">
            La plantilla está vacía. Cargá lo que siempre llevás: entrada, efectivo, batería, SUBE.
          </p>
        ) : (
          <ul className="divide-y divide-ritual-border-subtle border-y border-ritual-border-subtle">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                <span className="font-body text-sm text-ritual-bone">{item.label}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  className="font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-text hover:text-ritual-red-hover transition-colors shrink-0"
                >
                  Borrar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
