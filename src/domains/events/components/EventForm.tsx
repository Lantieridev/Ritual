'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'
import { Button, FormField, inputClass, Combobox, StarRating, type ComboboxOption } from '@/src/core/components/ui'
import { routes } from '@/src/core/lib/routes'
import { combineDateAndTime, eventTimeOfDay } from '@/src/core/lib/dates'
import { EXPENSE_CATEGORIES } from '@/src/domains/expenses/categories'
import type { Venue, EventWithRelations, Artist } from '@/src/core/types'

// Todo lo que el form escribe pasa por GraphQL: ya no llegan Server Actions
// inyectadas por prop, dispara las mutations directo.
const FindOrCreateVenueMutation = gql`
  mutation FindOrCreateVenue($name: String!) {
    findOrCreateVenue(name: $name) { id error }
  }
`
const FindOrCreateArtistMutation = gql`
  mutation FindOrCreateArtist($name: String!) {
    findOrCreateArtist(name: $name) { id error }
  }
`
const CreateEventMutation = gql`
  mutation CreateEvent($input: EventCreateInput!) {
    createEvent(input: $input) { id error }
  }
`
const UpdateEventMutation = gql`
  mutation UpdateEvent($id: ID!, $input: EventUpdateInput!) {
    updateEvent(id: $id, input: $input) { error }
  }
`
const SetAttendanceStatusMutation = gql`
  mutation SetAttendanceStatus($eventId: ID!, $status: AttendanceStatus!) {
    setAttendanceStatus(eventId: $eventId, status: $status) { error }
  }
`
const SaveMemoryMutation = gql`
  mutation SaveMemory($eventId: ID!, $rating: Int, $review: String) {
    saveMemory(eventId: $eventId, rating: $rating, review: $review) { error }
  }
`
const CreateExpenseMutation = gql`
  mutation CreateExpense($input: ExpenseCreateInput!) {
    createExpense(input: $input) { id error }
  }
`

interface EventFormProps {
  venues: Venue[]
  artists: Artist[]
  /** Presente sólo al editar; sin él el form está en modo alta. */
  event?: EventWithRelations
}

function toOption(v: { id: string; name: string; city?: string | null }): ComboboxOption {
  return { id: v.id, label: v.name, sublabel: v.city ?? undefined }
}

export function EventForm({ venues, artists, event }: EventFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [, findOrCreateVenue] = useMutation(FindOrCreateVenueMutation)
  const [, findOrCreateArtist] = useMutation(FindOrCreateArtistMutation)
  const [, createEvent] = useMutation(CreateEventMutation)
  const [, updateEvent] = useMutation(UpdateEventMutation)
  const [, setAttendanceStatus] = useMutation(SetAttendanceStatusMutation)
  const [, saveMemory] = useMutation(SaveMemoryMutation)
  const [, createExpense] = useMutation(CreateExpenseMutation)

  const [venueOptions, setVenueOptions] = useState<ComboboxOption[]>(() => venues.map(toOption))
  const [selectedVenue, setSelectedVenue] = useState<ComboboxOption | null>(() => {
    if (!event?.venue_id) return null
    const v = venues.find((x) => x.id === event.venue_id)
    return v ? toOption(v) : null
  })

  const [artistOptions, setArtistOptions] = useState<ComboboxOption[]>(() =>
    artists.map((a) => ({ id: a.id, label: a.name, sublabel: a.genre ?? undefined }))
  )
  const [selectedArtists, setSelectedArtists] = useState<ComboboxOption[]>(() => {
    if (!event?.lineups?.length) return []
    return event.lineups.map((row) => ({ id: row.artists.id, label: row.artists.name, sublabel: row.artists.genre ?? undefined }))
  })

  const isEdit = Boolean(event?.id)

  // Campos de "ya fui" — solo tienen sentido al cargar un show, no al editarlo.
  const [rating, setRating] = useState(0)
  const [review, setReview] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState(EXPENSE_CATEGORIES[0].name)

  function addArtist(option: ComboboxOption) {
    setSelectedArtists((prev) => (prev.some((a) => a.id === option.id) ? prev : [...prev, option]))
  }

  function removeArtist(id: string) {
    setSelectedArtists((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleCreateVenue(name: string) {
    const result = unwrapMutation<{ id?: string; error?: string }>(
      await findOrCreateVenue({ name }),
      'findOrCreateVenue',
      'No se pudo crear la sede.'
    )
    if (result.error || !result.id) return { error: result.error ?? 'No se pudo crear la sede.' }
    const option: ComboboxOption = { id: result.id, label: name }
    setVenueOptions((prev) => (prev.some((v) => v.id === option.id) ? prev : [...prev, option]))
    return option
  }

  async function handleCreateArtist(name: string) {
    const result = unwrapMutation<{ id?: string; error?: string }>(
      await findOrCreateArtist({ name }),
      'findOrCreateArtist',
      'No se pudo crear el artista.'
    )
    if (result.error || !result.id) return { error: result.error ?? 'No se pudo crear el artista.' }
    const option: ComboboxOption = { id: result.id, label: name }
    setArtistOptions((prev) => (prev.some((a) => a.id === option.id) ? prev : [...prev, option]))
    return option
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!selectedVenue) {
      setError('Debes elegir una sede.')
      return
    }

    setIsSubmitting(true)
    const form = e.currentTarget
    const name = (form.elements.namedItem('name') as HTMLInputElement).value
    const dateValue = (form.elements.namedItem('date') as HTMLInputElement).value
    const timeValue = (form.elements.namedItem('time') as HTMLInputElement).value
    const ticket_url = (form.elements.namedItem('ticket_url') as HTMLInputElement).value
    const venue_id = selectedVenue.id
    const artist_ids = selectedArtists.map((a) => a.id)
    // Combina fecha + hora en un solo timestamp — issue #8 (clima exacto por
    // hora): antes solo se guardaba la fecha (medianoche UTC), lo que hacía
    // imposible pedirle a Open-Meteo el clima de la hora real del show.
    const date = combineDateAndTime(dateValue, timeValue)

    if (isEdit && event) {
      const updated = unwrapMutation(
        await updateEvent({
          id: event.id,
          input: { name, date, venueId: venue_id, artistIds: artist_ids, ticketUrl: ticket_url },
        }),
        'updateEvent',
        'No se pudo guardar el recital.'
      )
      if (updated.error) {
        setError(updated.error)
        setIsSubmitting(false)
        return
      }
      router.push(routes.events.detail(event.id))
      return
    }

    const created = unwrapMutation<{ id?: string; error?: string }>(
      await createEvent({
        input: { name, date, venueId: venue_id, artistIds: artist_ids, ticketUrl: ticket_url },
      }),
      'createEvent',
      'No se pudo crear el recital.'
    )
    if (created.error || !created.id) {
      setError(created.error ?? 'No se pudo crear el recital.')
      setIsSubmitting(false)
      return
    }
    const eventId = created.id

    // Puntaje/reseña y gasto son opcionales — si el usuario los cargó (ya fue
    // al show), se encadenan acá para que sea una sola acción de principio a
    // fin. Errores acá no bloquean: el recital ya se creó, y volver al form
    // sería invitarlo a crearlo de nuevo; se completa desde su ficha. Pasan
    // igual por unwrapMutation para que una falla de transporte no se lea
    // como éxito y quede registrada en desarrollo.
    if (rating > 0 || review.trim()) {
      unwrapMutation(await setAttendanceStatus({ eventId, status: 'went' }), 'setAttendanceStatus')
      unwrapMutation(
        await saveMemory({
          eventId,
          rating: rating > 0 ? rating : undefined,
          review: review.trim() || undefined,
        }),
        'saveMemory'
      )
    }
    if (expenseAmount && Number(expenseAmount) > 0) {
      // El gasto es un dato de nivel "día", no de hora exacta — usa la fecha
      // sola (dateValue), no el timestamp combinado con hora.
      unwrapMutation(
        await createExpense({
          input: {
            amount: Number(expenseAmount),
            category: expenseCategory,
            eventId,
            date: dateValue,
          },
        }),
        'createExpense'
      )
    }

    router.push(routes.events.detail(eventId))
  }

  const cancelHref = isEdit && event ? routes.events.detail(event.id) : routes.home

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      {error && (
        <div role="alert" className="bg-ritual-red/10 border border-ritual-red/30 text-ritual-red-hover px-4 py-3 font-body text-sm">
          {error}
        </div>
      )}
      <FormField label="Nombre del recital" id="name" required>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={event?.name ?? ''}
          placeholder="Ej: Coldplay en Movistar Arena"
          className={inputClass}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Fecha" id="date" required>
          <input id="date" name="date" type="date" required defaultValue={event?.date ? event.date.slice(0, 10) : ''} className={inputClass} />
        </FormField>
        <FormField
          label="Hora"
          id="time"
          required
          hint="Puerta/inicio del show — se usa para pedirle a Open-Meteo el clima de esa hora exacta."
        >
          <input
            id="time"
            name="time"
            type="time"
            required
            defaultValue={event?.date ? eventTimeOfDay(event.date) : '20:00'}
            className={inputClass}
          />
        </FormField>
      </div>
      <FormField label="Sede" id="venue-combobox" required>
        {selectedVenue ? (
          <div className="flex items-center justify-between gap-3 border border-ritual-border bg-ritual-surface px-4 py-2.5">
            <span className="font-body text-sm text-ritual-bone truncate">
              {selectedVenue.label}
              {selectedVenue.sublabel && <span className="text-ritual-gray-text"> · {selectedVenue.sublabel}</span>}
            </span>
            <button
              type="button"
              onClick={() => setSelectedVenue(null)}
              className="shrink-0 font-label text-xs text-ritual-gray-text hover:text-ritual-gray-text transition-colors"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <Combobox
            id="venue-combobox"
            options={venueOptions}
            placeholder="Buscar sede o escribir una nueva..."
            onSelect={setSelectedVenue}
            onCreate={handleCreateVenue}
          />
        )}
      </FormField>
      <FormField label="Artistas en el lineup" id="artist-combobox">
        <div className="space-y-2">
          {selectedArtists.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {selectedArtists.map((a) => (
                <li
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ritual-border bg-ritual-surface pl-3 pr-2 py-1 font-body text-sm text-ritual-bone"
                >
                  {a.label}
                  <button
                    type="button"
                    onClick={() => removeArtist(a.id)}
                    aria-label={`Quitar ${a.label} del lineup`}
                    className="text-ritual-gray-text hover:text-ritual-bone transition-colors"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Combobox
            id="artist-combobox"
            options={artistOptions}
            excludeIds={new Set(selectedArtists.map((a) => a.id))}
            placeholder="Buscar artista o escribir uno nuevo..."
            onSelect={addArtist}
            onCreate={handleCreateArtist}
          />
        </div>
      </FormField>
      <FormField
        label="Link de entradas"
        id="ticket_url"
        hint="Opcional — AllAccess, Passline o donde se consigan. No hay búsqueda automática, pegá el link del evento a mano."
      >
        <input
          id="ticket_url"
          name="ticket_url"
          type="url"
          defaultValue={event?.ticket_url ?? ''}
          placeholder="https://www.allaccess.com.ar/event/..."
          className={inputClass}
        />
      </FormField>

      {!isEdit && (
        <>
          <FormField label="¿Ya fuiste? Puntaje" id="rating" hint="Opcional — dejalo en blanco si todavía no pasó.">
            <StarRating value={rating} onChange={setRating} size="xl" ariaLabel="Puntaje del show" />
          </FormField>
          {rating > 0 && (
            <FormField label="Reseña" id="review">
              <textarea
                id="review"
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="¿Cómo estuvo el show?"
                rows={3}
                className={`${inputClass} font-body italic resize-none`}
              />
            </FormField>
          )}
          <FormField label="Gasto de la noche" id="expense-amount" hint="Opcional — entrada, viaje, lo que sea.">
            <div className="flex gap-2">
              <input
                id="expense-amount"
                type="number"
                min="0"
                step="1"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="$0"
                className={`${inputClass} flex-1`}
              />
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className={`${inputClass} w-40`}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
          </FormField>
        </>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" variant="primary" disabled={isSubmitting} className="px-6 py-3">
          {isSubmitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Guardar y generar el talón'}
        </Button>
        <Link href={cancelHref} className="inline-flex items-center justify-center font-label text-[10px] tracking-[0.14em] uppercase border border-ritual-border text-ritual-bone hover:border-ritual-border-2 hover:bg-ritual-surface px-6 py-3 transition-colors">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
