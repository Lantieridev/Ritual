# Silent Show Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a user creates a show by hand, silently complete its real start time, poster and artist genre from Ticketmaster, without ever delaying the save or overwriting user input.

**Architecture:** `insertEvent` schedules `after(() => enrichEventFromExternal(supabase, id))`. A pure `findConfidentMatch` picks the single trustworthy Ticketmaster candidate; the orchestrator writes only empty fields with conditional updates. A new `events.time_known` flag makes "no hour" representable in a `timestamptz` column; the form sends a bare `YYYY-MM-DD` when the hour is left empty and the service derives the flag from it.

**Tech Stack:** Next.js 16 (`after()` from `next/server`), React 19, Supabase (`@supabase/ssr`), Vitest 4, Testing Library, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-19-silent-show-enrichment-design.md`

## Global Constraints

- Never overwrite user-entered data: every enrichment write is conditional (`time_known = false`, `poster_url is null`, `genre is null`).
- ADR 0003: without `TICKETMASTER_API_KEY`, or on any API/DB failure, do nothing and log a `console.warn`; `enrichEventFromExternal` never throws.
- Argentina has a fixed offset: local midnight is `T00:00:00-03:00` (`combineDateAndTime(date, '00:00')`).
- A Ticketmaster time of `00:00` local is NOT real: `ticketmaster.ts` fills `T00:00:00-03:00` when Ticketmaster sends no hour.
- Absent `time_known` (old rows, old test fixtures) means the hour is known: use `isTimeKnown`, never `=== true`.
- The GraphQL schema does not change.
- Out of scope: showing the poster in the UI, per-artist lineup times, venue typical hour (subproject 2), OCR (subproject 3).
- Conventions: user-facing copy and domain comments in Spanish (matches the repo); commit messages in English, conventional commits, **no** AI attribution or `Co-Authored-By` lines.
- Tooling: use `bat`/`rg`/`fd`/`sd`/`eza` instead of `cat`/`grep`/`find`/`sed`/`ls`. Run tests with `npx vitest run <path>`.

---

### Task 1: Migration, event types and `isTimeKnown`

**Files:**
- Create: `supabase/migrations/20260919000000_show_enrichment.sql`
- Modify: `src/core/types/index.ts` (the `Event` interface, after `ticket_url`)
- Modify: `src/core/lib/dates.ts` (add `isTimeKnown` after `hasTimeOfDay`)
- Test: `src/core/lib/dates.test.ts`

**Interfaces:**
- Produces: `isTimeKnown(timeKnown: boolean | null | undefined): boolean`; `Event.poster_url?: string | null`; `Event.time_known?: boolean`.

- [ ] **Step 1: Write the failing test**

In `src/core/lib/dates.test.ts`, add `isTimeKnown,` to the import list from `'./dates'` (next to `hasTimeOfDay,`) and append at the end of the file:

```ts
describe('isTimeKnown', () => {
  it('es false solo cuando el flag es exactamente false', () => {
    expect(isTimeKnown(false)).toBe(false)
  })

  it('trata true, null y undefined como hora conocida (filas anteriores a la columna)', () => {
    expect(isTimeKnown(true)).toBe(true)
    expect(isTimeKnown(null)).toBe(true)
    expect(isTimeKnown(undefined)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/lib/dates.test.ts`
Expected: FAIL (`isTimeKnown` is not exported / is not a function).

- [ ] **Step 3: Implement**

In `src/core/lib/dates.ts`, right after `hasTimeOfDay`:

```ts
/**
 * Whether an event's stored `time_known` flag says its hour is real.
 * `events.date` is a timestamptz, so a show saved without an hour still comes
 * back as a full instant; the flag is the only record that the hour is a
 * placeholder. Absent (rows and fixtures from before the column) means known.
 */
export function isTimeKnown(timeKnown: boolean | null | undefined): boolean {
    return timeKnown !== false
}
```

In `src/core/types/index.ts`, inside `interface Event`, after `ticket_url?: string | null`:

```ts
  /** Póster del show, completado desde Ticketmaster (issue #11). */
  poster_url?: string | null
  /**
   * false cuando el usuario no cargó hora: `date` guarda entonces la
   * medianoche local sólo para no perder el día. Ausente = hora conocida —
   * ver `isTimeKnown`.
   */
  time_known?: boolean
```

Create `supabase/migrations/20260919000000_show_enrichment.sql`:

```sql
-- issue #11: enriquecimiento silencioso de shows desde Ticketmaster.
--
-- poster_url: póster del show.
-- time_known: false cuando el usuario no cargó hora. events.date es
-- timestamptz, así que "sin hora" no se puede distinguir de una hora real
-- sin este flag. Las filas existentes quedan en true (tienen hora).
alter table public.events add column if not exists poster_url text;
alter table public.events add column if not exists time_known boolean not null default true;

-- artists sólo tenía select e insert: sin una policy de update, completar el
-- género desde el enriquecimiento afectaría 0 filas en silencio. Esta policy
-- sólo deja llenar un género vacío, nunca sobrescribir uno existente.
create policy "Fill empty artist genre"
  on public.artists
  as permissive
  for update
  to authenticated
  using (genre is null or genre = '')
  with check (genre is not null and genre <> '');
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/core/lib/dates.test.ts`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260919000000_show_enrichment.sql src/core/types/index.ts src/core/lib/dates.ts src/core/lib/dates.test.ts
git commit -m "feat(events): add poster_url, time_known and artist genre fill policy (#11)"
```

---

### Task 2: Service stores shows without an hour as `time_known = false`

**Files:**
- Modify: `src/domains/events/service.ts` (imports; new `resolveEventDate`; `insertEvent` insert; `modifyEvent` payload)
- Test: `src/domains/events/service.test.ts`

**Interfaces:**
- Consumes: `hasTimeOfDay(dateStr: string): boolean`, `combineDateAndTime(date: string, time: string): string` from `@/src/core/lib/dates`.
- Produces: `insertEvent`/`modifyEvent` accept `date` either as a full timestamp or as bare `YYYY-MM-DD`.

- [ ] **Step 1: Write the failing tests**

In `src/domains/events/service.test.ts`, in the same `describe` as `'insertEvent stores null when ticket_url is omitted'` (after that test), add:

```ts
  it('insertEvent stores a date without an hour as local midnight with time_known false', async () => {
    const eventsBuilder = makeQueryBuilder({ data: { id: VALID_EVENT_ID }, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => eventsBuilder) }))

    await insertEvent({ name: 'Show', date: '2024-05-01', venue_id: VALID_VENUE_ID } as never)

    expect(eventsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2024-05-01T00:00:00-03:00', time_known: false })
    )
  })

  it('insertEvent keeps a full timestamp untouched and marks time_known true', async () => {
    const eventsBuilder = makeQueryBuilder({ data: { id: VALID_EVENT_ID }, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => eventsBuilder) }))

    await insertEvent({ name: 'Show', date: '2024-05-01T21:00:00-03:00', venue_id: VALID_VENUE_ID } as never)

    expect(eventsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2024-05-01T21:00:00-03:00', time_known: true })
    )
  })
```

And after `'modifyEvent clears ticket_url to null when set to an empty string'`, add:

```ts
  it('modifyEvent stores a date without an hour as local midnight with time_known false', async () => {
    const eventsBuilder = makeQueryBuilder({ data: null, error: null }) as Record<string, unknown>
    eventsBuilder.update = vi.fn(() => eventsBuilder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => eventsBuilder) }))

    await modifyEvent(VALID_EVENT_ID, { date: '2024-05-01' })

    expect(eventsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2024-05-01T00:00:00-03:00', time_known: false })
    )
  })

  it('modifyEvent marks time_known true when the date carries an hour', async () => {
    const eventsBuilder = makeQueryBuilder({ data: null, error: null }) as Record<string, unknown>
    eventsBuilder.update = vi.fn(() => eventsBuilder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => eventsBuilder) }))

    await modifyEvent(VALID_EVENT_ID, { date: '2024-05-01T23:15:00-03:00' })

    expect(eventsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2024-05-01T23:15:00-03:00', time_known: true })
    )
  })

  it('modifyEvent leaves time_known alone when no date is sent', async () => {
    const eventsBuilder = makeQueryBuilder({ data: null, error: null }) as Record<string, unknown>
    eventsBuilder.update = vi.fn(() => eventsBuilder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => eventsBuilder) }))

    await modifyEvent(VALID_EVENT_ID, { name: 'Nuevo nombre' })

    expect(eventsBuilder.update).toHaveBeenCalledWith(expect.not.objectContaining({ time_known: expect.anything() }))
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domains/events/service.test.ts`
Expected: the 4 new tests FAIL (`time_known` missing / date not normalized); the rest still pass.

- [ ] **Step 3: Implement**

In `src/domains/events/service.ts`, change the dates import to:

```ts
import { parseExternalDateTime, hasTimeOfDay, combineDateAndTime } from '@/src/core/lib/dates'
```

Add this helper right after `validateCreate`:

```ts
/**
 * El form manda la fecha sola ("YYYY-MM-DD") cuando el usuario dejó la hora
 * vacía. `events.date` es timestamptz, así que se guarda la medianoche local
 * (para no perder el día) y `time_known = false` conserva el "no sé la hora".
 */
function resolveEventDate(date: string): { date: string; time_known: boolean } {
  if (hasTimeOfDay(date)) return { date, time_known: true }
  return { date: combineDateAndTime(date, '00:00'), time_known: false }
}
```

In `insertEvent`, change the insert payload from `date: formData.date,` to:

```ts
      ...resolveEventDate(formData.date),
```

so it reads:

```ts
    .insert({
      name,
      ...resolveEventDate(formData.date),
      venue_id: formData.venue_id,
      ticket_url: formData.ticket_url?.trim() || null,
    })
```

In `modifyEvent`, widen the payload type and resolve the date:

```ts
  const payload: {
    name?: string | null
    date?: string
    time_known?: boolean
    venue_id?: string | null
    ticket_url?: string | null
  } = {}
```

and replace `payload.date = formData.date` with:

```ts
    Object.assign(payload, resolveEventDate(formData.date))
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/domains/events/service.test.ts`
Expected: PASS. If an older test asserts the exact stored `date` for a bare `'2024-01-01'` input, update that expectation to `'2024-01-01T00:00:00-03:00'` (that is the intended new behavior).

- [ ] **Step 5: Commit**

```bash
git add src/domains/events/service.ts src/domains/events/service.test.ts
git commit -m "feat(events): store shows without an hour as time_known false (#11)"
```

---

### Task 3: Optional hour in `EventForm`

**Files:**
- Modify: `src/domains/events/components/EventForm.tsx` (imports; submit `date`; the `Hora` field)
- Test: `src/domains/events/components/EventForm.test.tsx`

**Interfaces:**
- Consumes: `isTimeKnown(timeKnown)` from `@/src/core/lib/dates`; `Event.time_known` (Task 1); service behavior from Task 2 (bare date ⇒ `time_known = false`).

- [ ] **Step 1: Update and add tests**

In `EventForm.test.tsx`, replace the expectation in `'submits name, date, venue, and selected lineup artists, then navigates to the new event'`:

```ts
          // Sin tocar el input de hora (arranca vacío), el form manda la
          // fecha sola: el servicio la guarda como "sin hora" (issue #11).
          date: '2024-05-01',
```

Replace the test `'defaults the time input to 20:00 for a new event'` with:

```ts
  it('starts the time input empty for a new event', () => {
    render(<EventForm venues={venues} artists={artists} />)

    expect(screen.getByLabelText(/Hora/)).toHaveValue('')
  })

  it('sends the date alone when the time input is left empty', async () => {
    render(<EventForm venues={venues} artists={artists} />)

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await pickVenue('Niceto')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    await waitFor(() => {
      expect(createEventMock).toHaveBeenCalledWith({
        input: expect.objectContaining({ date: '2024-05-01' }),
      })
    })
  })
```

In the `'EventForm — edit mode'` describe, after `'pre-fills the selected venue and the artists already in the lineup'`, add:

```ts
  it('leaves the time input empty when the stored show has no known time', () => {
    render(<EventForm venues={venues} artists={artists} event={{ ...event, time_known: false }} />)

    expect(screen.getByLabelText(/Hora/)).toHaveValue('')
  })

  it('sends the date alone on save when the show has no known time and the input stays empty', async () => {
    render(<EventForm venues={venues} artists={artists} event={{ ...event, time_known: false }} />)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(updateEventMock).toHaveBeenCalledWith({
        id: 'e1',
        input: expect.objectContaining({ date: '2024-05-01' }),
      })
    })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domains/events/components/EventForm.test.tsx`
Expected: the changed/new tests FAIL (input still defaults to `20:00`, still `required`).

- [ ] **Step 3: Implement**

In `EventForm.tsx`, change the dates import to:

```ts
import { combineDateAndTime, eventTimeOfDay, isTimeKnown, toDateOnly } from '@/src/core/lib/dates'
```

Replace the line `const date = combineDateAndTime(dateValue, timeValue)` and keep its comment, so it reads:

```ts
    // Combina fecha + hora en un solo timestamp — issue #8 (clima exacto por
    // hora): antes solo se guardaba la fecha (medianoche UTC), lo que hacía
    // imposible pedirle a Open-Meteo el clima de la hora real del show.
    // Con la hora vacía se manda la fecha sola: el servicio la guarda como
    // "sin hora" (time_known = false) y el enriquecimiento puede completarla
    // (issue #11).
    const date = timeValue ? combineDateAndTime(dateValue, timeValue) : dateValue
```

Replace the `Hora` `FormField` block with:

```tsx
        <FormField
          label="Hora"
          id="time"
          hint="Opcional. Si la dejás vacía, Ritual intenta completarla con la hora real del show. Se usa para el clima de esa hora."
        >
          <input
            id="time"
            name="time"
            type="time"
            defaultValue={event?.date && isTimeKnown(event.time_known) ? eventTimeOfDay(event.date) : ''}
            className={inputClass}
          />
        </FormField>
```

(i.e. drop `required` from both the `FormField` and the `<input>`, and change the default from `'20:00'` to `''`.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/domains/events/components/EventForm.test.tsx`
Expected: PASS (the pre-existing edit-mode tests keep passing because their fixture has no `time_known`, which `isTimeKnown` treats as known).

- [ ] **Step 5: Commit**

```bash
git add src/domains/events/components/EventForm.tsx src/domains/events/components/EventForm.test.tsx
git commit -m "feat(events): make the hour optional in the event form (#11)"
```

---

### Task 4: Banners omit the hour when it is unknown

**Files:**
- Modify: `src/domains/events/home-view.ts` (`heroBadgeText`; imports)
- Modify: `src/domains/events/show-tonight.ts` (`ShowTonightRow`, `ShowTonight`, `pickShowTonight`, `bandaLinkFor`; imports)
- Modify: `src/domains/events/data.ts` (`getShowTonight` select)
- Test: `src/domains/events/home-view.test.ts`, `src/domains/events/show-tonight.test.ts`

**Interfaces:**
- Consumes: `isTimeKnown` (Task 1).
- Produces: `ShowTonight.timeKnown: boolean`.

- [ ] **Step 1: Write the failing tests**

In `home-view.test.ts`, inside `describe('heroBadgeText', …)`, add:

```ts
  it('omits the hour for show-today when the time is unknown', () => {
    const event = makeEvent({ id: 'e1', date: '2026-06-15T00:00:00-03:00', time_known: false })

    expect(heroBadgeText({ kind: 'show-today', event })).toBe('Esta noche')
  })

  it('omits the hour for normal when the time is unknown', () => {
    const nextShow = makeEvent({ id: 'e1', date: '2026-06-20T00:00:00-03:00', time_known: false })

    expect(heroBadgeText({ kind: 'normal', nextShow, daysUntil: 5 })).toBe('20 jun')
  })
```

In `show-tonight.test.ts`, inside `describe('bandaLinkFor', …)`, add:

```ts
  it('omits the hour when the time is unknown', () => {
    const show: ShowTonight = { id: 'e1', headliner: 'Divididos', date: '2026-07-21T00:00:00-03:00', timeKnown: false }

    expect(bandaLinkFor(show).title).toBe('Divididos')
  })
```

and update the two existing `ShowTonight` literals in that describe to include `timeKnown: true`.

Also add, in the `pickShowTonight` tests, one case (reuse the file's `makeRow` helper and `NOW` constant, following the neighboring tests):

```ts
  it('carries time_known through as timeKnown, defaulting to known', () => {
    const unknown = pickShowTonight([makeRow({ date: '2026-07-21T00:00:00-03:00', time_known: false })], NOW)
    const legacy = pickShowTonight([makeRow({ date: '2026-07-21T21:00:00-03:00' })], NOW)

    expect(unknown?.timeKnown).toBe(false)
    expect(legacy?.timeKnown).toBe(true)
  })
```

(If the file's "now" constant has another name, use the one the neighboring `pickShowTonight` tests use; the date must fall on that same Argentine calendar day.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domains/events/home-view.test.ts src/domains/events/show-tonight.test.ts`
Expected: new tests FAIL.

- [ ] **Step 3: Implement**

`home-view.ts`: extend the first import with `isTimeKnown` and rewrite `heroBadgeText`:

```ts
import { isPastEvent, eventYear, daysUntil, toDateOnly, todayDateOnly, eventTimeOfDay, isTimeKnown } from '@/src/core/lib/dates'
```

```ts
export function heroBadgeText(state: Extract<HomeHeroState, { kind: 'show-today' | 'normal' }>): string {
    const event = state.kind === 'show-today' ? state.event : state.nextShow
    // Sin hora conocida (issue #11) el badge muestra sólo el día, no un "00:00" inventado.
    const time = isTimeKnown(event.time_known) ? ` · ${eventTimeOfDay(event.date)}` : ''
    if (state.kind === 'show-today') return `Esta noche${time}`
    return `${formatDate(event.date, { day: 'numeric', month: 'short' })}${time}`
}
```

`show-tonight.ts`: change the import, the row/type, `pickShowTonight` and `bandaLinkFor`:

```ts
import { daysUntil, hasTimeOfDay, eventTimeOfDay, isTimeKnown } from '@/src/core/lib/dates'
```

```ts
export interface ShowTonightRow {
  status: string
  events: {
    id: string
    name: string | null
    date: string
    time_known?: boolean | null
    lineups: Array<{ artists: { name: string } }> | null
  } | null
}

export interface ShowTonight {
  id: string
  headliner: string
  date: string
  timeKnown: boolean
}
```

in `pickShowTonight`, replace the assignment with:

```ts
      best = { id: event.id, headliner, date: event.date, timeKnown: isTimeKnown(event.time_known) }
```

and in `bandaLinkFor`:

```ts
  const time = show.timeKnown && hasTimeOfDay(show.date) ? ` · ${eventTimeOfDay(show.date)}` : ''
```

`data.ts` (`getShowTonight`): change `id, name, date,` inside the `events ( … )` select to `id, name, date, time_known,`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/domains/events/home-view.test.ts src/domains/events/show-tonight.test.ts`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: no errors. If another caller builds a `ShowTonight` literal, add `timeKnown: true` there.

- [ ] **Step 5: Commit**

```bash
git add src/domains/events/home-view.ts src/domains/events/show-tonight.ts src/domains/events/data.ts src/domains/events/home-view.test.ts src/domains/events/show-tonight.test.ts
git commit -m "feat(events): omit the hour from banners when it is unknown (#11)"
```

---

### Task 5: `findConfidentMatch` (pure match rule)

**Files:**
- Create: `src/domains/events/enrichment/match.ts`
- Test: `src/domains/events/enrichment/match.test.ts`

**Interfaces:**
- Consumes: `toDateOnly`, `eventTimeOfDay` from `@/src/core/lib/dates`; `FutureEvent` from `@/src/core/types`.
- Produces:
  - `interface ShowToMatch { date: string; venueName: string | null; venueCity: string | null }`
  - `findConfidentMatch(show: ShowToMatch, candidates: FutureEvent[]): FutureEvent | null`
  - `hasRealTime(candidate: FutureEvent): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/domains/events/enrichment/match.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { findConfidentMatch, hasRealTime } from '@/src/domains/events/enrichment/match'
import type { FutureEvent } from '@/src/core/types'

function candidate(overrides: Partial<FutureEvent> = {}): FutureEvent {
  return {
    id: 'tm1',
    title: 'Bandalos Chinos',
    datetime: '2026-10-10T21:30:00-03:00',
    venue: { name: 'Niceto Club', city: 'Buenos Aires' },
    lineup: ['Bandalos Chinos'],
    ...overrides,
  }
}

const show = {
  date: '2026-10-10T00:00:00-03:00',
  venueName: 'Niceto Club',
  venueCity: 'Buenos Aires',
}

describe('findConfidentMatch', () => {
  it('returns the single candidate on the same local day in the same city', () => {
    const match = candidate()
    expect(findConfidentMatch(show, [match])).toBe(match)
  })

  it('returns null when there are no candidates', () => {
    expect(findConfidentMatch(show, [])).toBeNull()
  })

  it('returns null when two candidates qualify (ambiguous)', () => {
    expect(findConfidentMatch(show, [candidate({ id: 'a' }), candidate({ id: 'b' })])).toBeNull()
  })

  it('returns null when the local day differs', () => {
    expect(findConfidentMatch(show, [candidate({ datetime: '2026-10-11T21:30:00-03:00' })])).toBeNull()
  })

  it('compares the local day, not the UTC day', () => {
    // 22:00 ART on the 10th is already the 11th in UTC.
    const lateShow = candidate({ datetime: '2026-10-11T01:00:00Z' })
    expect(findConfidentMatch(show, [lateShow])).toBe(lateShow)
  })

  it('returns null when neither city nor venue match', () => {
    const other = candidate({ venue: { name: 'Luna Park', city: 'Córdoba' } })
    expect(findConfidentMatch(show, [other])).toBeNull()
  })

  it('matches on the venue name alone when the city differs or is missing', () => {
    const match = candidate({ venue: { name: 'Niceto Club', city: null } })
    expect(findConfidentMatch({ ...show, venueCity: null }, [match])).toBe(match)
  })

  it('matches when one venue name contains the other', () => {
    const match = candidate({ venue: { name: 'Niceto', city: null } })
    expect(findConfidentMatch({ ...show, venueCity: null }, [match])).toBe(match)
  })

  it('ignores accents and case when comparing', () => {
    const match = candidate({ venue: { name: 'ESTADIO ÚNICO', city: 'LA PLATA' } })
    const result = findConfidentMatch(
      { date: '2026-10-10T00:00:00-03:00', venueName: 'Estadio Unico', venueCity: 'la plata' },
      [match]
    )
    expect(result).toBe(match)
  })

  it('does not match on empty strings', () => {
    const blank = candidate({ venue: { name: '', city: '' } })
    expect(findConfidentMatch({ ...show, venueName: '', venueCity: '' }, [blank])).toBeNull()
  })

  it('skips candidates without a datetime', () => {
    expect(findConfidentMatch(show, [candidate({ datetime: '' })])).toBeNull()
  })
})

describe('hasRealTime', () => {
  it('is true for a real evening hour', () => {
    expect(hasRealTime(candidate({ datetime: '2026-10-10T21:30:00-03:00' }))).toBe(true)
  })

  it('is false for the local-midnight placeholder ticketmaster.ts fills when no hour is sent', () => {
    expect(hasRealTime(candidate({ datetime: '2026-10-10T00:00:00-03:00' }))).toBe(false)
  })

  it('is false when there is no datetime', () => {
    expect(hasRealTime(candidate({ datetime: '' }))).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/events/enrichment/match.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/domains/events/enrichment/match.ts`:

```ts
import { toDateOnly, eventTimeOfDay } from '@/src/core/lib/dates'
import type { FutureEvent } from '@/src/core/types'

/** Lo que se sabe del show cargado a mano, lo mínimo para reconocerlo en Ticketmaster. */
export interface ShowToMatch {
  date: string
  venueName: string | null
  venueCity: string | null
}

function normalize(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function sameVenueName(a: string, b: string): boolean {
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

/**
 * El único candidato de Ticketmaster que es, con confianza, el show cargado:
 * misma fecha local y misma ciudad o sede. Con cero o varios candidatos
 * devuelve null — un falso positivo (pegarle al show la hora o el póster de
 * otro) es peor que no completar nada.
 */
export function findConfidentMatch(show: ShowToMatch, candidates: FutureEvent[]): FutureEvent | null {
  const day = toDateOnly(show.date)
  const city = normalize(show.venueCity)
  const venue = normalize(show.venueName)

  const matches = candidates.filter((candidate) => {
    if (!candidate.datetime || toDateOnly(candidate.datetime) !== day) return false
    const candidateCity = normalize(candidate.venue.city)
    const sameCity = city !== '' && candidateCity !== '' && city === candidateCity
    return sameCity || sameVenueName(venue, normalize(candidate.venue.name))
  })

  return matches.length === 1 ? matches[0] : null
}

/**
 * Cuando Ticketmaster no manda hora, ticketmaster.ts rellena la medianoche
 * local (`T00:00:00-03:00`), así que un 00:00 no es una hora real y no se
 * puede usar para completar la del show.
 */
export function hasRealTime(candidate: FutureEvent): boolean {
  if (!candidate.datetime) return false
  return eventTimeOfDay(candidate.datetime) !== '00:00'
}
```

- [ ] **Step 4: Run test**

Run: `npx vitest run src/domains/events/enrichment/match.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domains/events/enrichment/match.ts src/domains/events/enrichment/match.test.ts
git commit -m "feat(events): add the confident-match rule for Ticketmaster candidates (#11)"
```

---

### Task 6: `enrichEventFromExternal`

**Files:**
- Create: `src/domains/events/enrichment/enrich-event.ts`
- Test: `src/domains/events/enrichment/enrich-event.test.ts`

**Interfaces:**
- Consumes: `findConfidentMatch`, `hasRealTime` (Task 5); `isTicketmasterConfigured()`, `searchTicketmasterEvents(query: { keyword?: string; city?: string })` from `@/src/core/lib/ticketmaster`; `createClient` type from `@/src/core/lib/supabase/server`.
- Produces: `enrichEventFromExternal(supabase: SupabaseClient, eventId: string): Promise<void>` — never rejects.

- [ ] **Step 1: Write the failing test**

Create `src/domains/events/enrichment/enrich-event.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/core/lib/ticketmaster', () => ({
  isTicketmasterConfigured: vi.fn(),
  searchTicketmasterEvents: vi.fn(),
}))

import { enrichEventFromExternal } from '@/src/domains/events/enrichment/enrich-event'
import { isTicketmasterConfigured, searchTicketmasterEvents } from '@/src/core/lib/ticketmaster'
import type { FutureEvent } from '@/src/core/types'

type Filter = ['eq' | 'is', string, unknown]
interface Write {
  table: string
  patch: Record<string, unknown>
  filters: Filter[]
}

/** Supabase falso: devuelve `event` en el select y registra cada update con sus guardas. */
function makeSupabase(
  event: unknown,
  opts: { selectError?: unknown; updateError?: unknown } = {}
) {
  const writes: Write[] = []
  const from = vi.fn((table: string) => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: event, error: opts.selectError ?? null }),
      }),
    }),
    update: (patch: Record<string, unknown>) => {
      const write: Write = { table, patch, filters: [] }
      writes.push(write)
      const chain = {
        eq: (column: string, value: unknown) => {
          write.filters.push(['eq', column, value])
          return chain
        },
        is: (column: string, value: unknown) => {
          write.filters.push(['is', column, value])
          return chain
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ error: opts.updateError ?? null }).then(resolve),
      }
      return chain
    },
  }))
  return { client: { from } as never, writes }
}

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    name: 'Bandalos en Niceto',
    date: '2026-10-10T00:00:00-03:00',
    time_known: false,
    poster_url: null,
    venues: { name: 'Niceto Club', city: 'Buenos Aires' },
    lineups: [{ is_headliner: true, artists: { id: 'a1', name: 'Bandalos Chinos', genre: null } }],
    ...overrides,
  }
}

function candidate(overrides: Partial<FutureEvent> = {}): FutureEvent {
  return {
    id: 'tm1',
    title: 'Bandalos Chinos',
    datetime: '2026-10-10T21:30:00-03:00',
    venue: { name: 'Niceto Club', city: 'Buenos Aires' },
    lineup: ['Bandalos Chinos'],
    image: 'https://img.test/poster.jpg',
    genre: 'Rock',
    ...overrides,
  }
}

describe('enrichEventFromExternal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(isTicketmasterConfigured).mockReturnValue(true)
    vi.mocked(searchTicketmasterEvents).mockResolvedValue({ events: [candidate()], total: 1 })
  })

  it('searches by the headliner and the venue city', async () => {
    const { client } = makeSupabase(eventRow())

    await enrichEventFromExternal(client, 'e1')

    expect(searchTicketmasterEvents).toHaveBeenCalledWith({ keyword: 'Bandalos Chinos', city: 'Buenos Aires' })
  })

  it('falls back to the show name when the lineup is empty', async () => {
    const { client } = makeSupabase(eventRow({ lineups: [] }))

    await enrichEventFromExternal(client, 'e1')

    expect(searchTicketmasterEvents).toHaveBeenCalledWith({ keyword: 'Bandalos en Niceto', city: 'Buenos Aires' })
  })

  it('completes the hour, poster and genre on a confident match, each write guarded', async () => {
    const { client, writes } = makeSupabase(eventRow())

    await enrichEventFromExternal(client, 'e1')

    expect(writes).toEqual([
      {
        table: 'events',
        patch: { date: '2026-10-10T21:30:00-03:00', time_known: true },
        filters: [['eq', 'id', 'e1'], ['eq', 'time_known', false]],
      },
      {
        table: 'events',
        patch: { poster_url: 'https://img.test/poster.jpg' },
        filters: [['eq', 'id', 'e1'], ['is', 'poster_url', null]],
      },
      {
        table: 'artists',
        patch: { genre: 'Rock' },
        filters: [['eq', 'id', 'a1'], ['is', 'genre', null]],
      },
    ])
  })

  it('does not touch the hour when the user already set it', async () => {
    const { client, writes } = makeSupabase(eventRow({ time_known: true }))

    await enrichEventFromExternal(client, 'e1')

    expect(writes.some((w) => 'date' in w.patch)).toBe(false)
    expect(writes.some((w) => 'poster_url' in w.patch)).toBe(true)
  })

  it('does not use the local-midnight placeholder Ticketmaster fills when it sends no hour', async () => {
    vi.mocked(searchTicketmasterEvents).mockResolvedValue({
      events: [candidate({ datetime: '2026-10-10T00:00:00-03:00' })],
      total: 1,
    })
    const { client, writes } = makeSupabase(eventRow())

    await enrichEventFromExternal(client, 'e1')

    expect(writes.some((w) => 'date' in w.patch)).toBe(false)
  })

  it('does not overwrite an existing poster or genre', async () => {
    const { client, writes } = makeSupabase(
      eventRow({
        poster_url: 'https://mine.test/p.jpg',
        lineups: [{ is_headliner: true, artists: { id: 'a1', name: 'Bandalos Chinos', genre: 'Indie' } }],
      })
    )

    await enrichEventFromExternal(client, 'e1')

    expect(writes.some((w) => 'poster_url' in w.patch)).toBe(false)
    expect(writes.some((w) => w.table === 'artists')).toBe(false)
  })

  it('writes nothing when there is no candidate', async () => {
    vi.mocked(searchTicketmasterEvents).mockResolvedValue({ events: [], total: 0 })
    const { client, writes } = makeSupabase(eventRow())

    await enrichEventFromExternal(client, 'e1')

    expect(writes).toEqual([])
  })

  it('writes nothing when two candidates match (ambiguous)', async () => {
    vi.mocked(searchTicketmasterEvents).mockResolvedValue({
      events: [candidate({ id: 'a' }), candidate({ id: 'b' })],
      total: 2,
    })
    const { client, writes } = makeSupabase(eventRow())

    await enrichEventFromExternal(client, 'e1')

    expect(writes).toEqual([])
  })

  it('does nothing and does not search when Ticketmaster is not configured', async () => {
    vi.mocked(isTicketmasterConfigured).mockReturnValue(false)
    const { client, writes } = makeSupabase(eventRow())

    await enrichEventFromExternal(client, 'e1')

    expect(searchTicketmasterEvents).not.toHaveBeenCalled()
    expect(writes).toEqual([])
  })

  it('writes nothing and does not throw when the search reports an error', async () => {
    vi.mocked(searchTicketmasterEvents).mockResolvedValue({ events: [], total: 0, error: 'Límite alcanzado' })
    const { client, writes } = makeSupabase(eventRow())

    await expect(enrichEventFromExternal(client, 'e1')).resolves.toBeUndefined()
    expect(writes).toEqual([])
  })

  it('does not throw when the search itself throws', async () => {
    vi.mocked(searchTicketmasterEvents).mockRejectedValue(new Error('network down'))
    const { client } = makeSupabase(eventRow())

    await expect(enrichEventFromExternal(client, 'e1')).resolves.toBeUndefined()
  })

  it('does not throw and does not search when the event cannot be read', async () => {
    const { client } = makeSupabase(null, { selectError: { message: 'boom' } })

    await expect(enrichEventFromExternal(client, 'e1')).resolves.toBeUndefined()
    expect(searchTicketmasterEvents).not.toHaveBeenCalled()
  })

  it('keeps going and does not throw when one write fails', async () => {
    const { client, writes } = makeSupabase(eventRow(), { updateError: { message: 'rls' } })

    await expect(enrichEventFromExternal(client, 'e1')).resolves.toBeUndefined()
    expect(writes).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/events/enrichment/enrich-event.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/domains/events/enrichment/enrich-event.ts`:

```ts
import { isTicketmasterConfigured, searchTicketmasterEvents } from '@/src/core/lib/ticketmaster'
import type { createClient } from '@/src/core/lib/supabase/server'
import { findConfidentMatch, hasRealTime } from './match'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

interface EventRow {
  id: string
  name: string | null
  date: string
  time_known: boolean
  poster_url: string | null
  venues: { name: string; city: string | null } | null
  lineups: Array<{
    is_headliner?: boolean | null
    artists: { id: string; name: string; genre: string | null } | null
  }> | null
}

const EVENT_SELECT = `
  id, name, date, time_known, poster_url,
  venues ( name, city ),
  lineups ( is_headliner, artists ( id, name, genre ) )
`

/**
 * Completa en silencio la hora real, el póster y el género de un show recién
 * cargado a mano, a partir de Ticketmaster (issue #11). Corre desde `after()`,
 * cuando la respuesta al usuario ya salió, así que jamás debe lanzar: sin API
 * key, con la API caída o sin match no hace nada (ADR 0003).
 *
 * Sólo escribe campos vacíos, y cada escritura lleva su propia guarda en el
 * `where`: si el usuario edita el show entre el guardado y este job, gana el
 * usuario.
 */
export async function enrichEventFromExternal(supabase: SupabaseClient, eventId: string): Promise<void> {
  try {
    await enrich(supabase, eventId)
  } catch (error) {
    console.warn('Enriquecimiento del evento falló:', error)
  }
}

async function enrich(supabase: SupabaseClient, eventId: string): Promise<void> {
  if (!isTicketmasterConfigured()) return

  const { data, error } = await supabase.from('events').select(EVENT_SELECT).eq('id', eventId).single()
  const event = data as unknown as EventRow | null
  if (error || !event) {
    console.warn('Enriquecimiento: no se pudo leer el evento', eventId, error)
    return
  }

  const lineup = event.lineups ?? []
  const headliner = (lineup.find((row) => row.is_headliner) ?? lineup[0])?.artists ?? null
  const keyword = headliner?.name ?? event.name ?? undefined
  const city = event.venues?.city ?? undefined

  const { events: candidates, error: searchError } = await searchTicketmasterEvents({ keyword, city })
  if (searchError) {
    console.warn('Enriquecimiento: la búsqueda en Ticketmaster falló:', searchError)
    return
  }

  const match = findConfidentMatch(
    { date: event.date, venueName: event.venues?.name ?? null, venueCity: event.venues?.city ?? null },
    candidates
  )
  if (!match) return

  if (!event.time_known && hasRealTime(match)) {
    const { error: writeError } = await supabase
      .from('events')
      .update({ date: match.datetime, time_known: true })
      .eq('id', eventId)
      .eq('time_known', false)
    if (writeError) console.warn('Enriquecimiento: no se pudo guardar la hora:', writeError)
  }

  if (!event.poster_url && match.image) {
    const { error: writeError } = await supabase
      .from('events')
      .update({ poster_url: match.image })
      .eq('id', eventId)
      .is('poster_url', null)
    if (writeError) console.warn('Enriquecimiento: no se pudo guardar el póster:', writeError)
  }

  if (headliner && !headliner.genre && match.genre) {
    const { error: writeError } = await supabase
      .from('artists')
      .update({ genre: match.genre })
      .eq('id', headliner.id)
      .is('genre', null)
    if (writeError) console.warn('Enriquecimiento: no se pudo guardar el género:', writeError)
  }
}
```

- [ ] **Step 4: Run test and typecheck**

Run: `npx vitest run src/domains/events/enrichment/enrich-event.test.ts`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/domains/events/enrichment/enrich-event.ts src/domains/events/enrichment/enrich-event.test.ts
git commit -m "feat(events): add enrichEventFromExternal to fill empty show fields (#11)"
```

---

### Task 7: Schedule the enrichment from `insertEvent`

**Files:**
- Modify: `src/domains/events/service.ts` (imports; end of `insertEvent`)
- Test: `src/domains/events/service.test.ts` (module mocks at the top + new tests)

**Interfaces:**
- Consumes: `enrichEventFromExternal(supabase, eventId)` (Task 6); `after` from `next/server`.

- [ ] **Step 1: Add the module mocks and failing tests**

At the top of `service.test.ts`, next to the existing `vi.mock(...)` calls (before the `import { addExternalEvent, … }` block), add:

```ts
vi.mock('next/server', () => ({
  after: vi.fn(),
}))

vi.mock('@/src/domains/events/enrichment/enrich-event', () => ({
  enrichEventFromExternal: vi.fn(),
}))
```

and add these imports next to the other imports:

```ts
import { after } from 'next/server'
import { enrichEventFromExternal } from '@/src/domains/events/enrichment/enrich-event'
```

Add to the same `describe` that holds `'insertEvent returns the new id, leaving navigation to the caller'`:

```ts
  it('insertEvent schedules the silent enrichment after saving, without running it before responding', async () => {
    const eventsBuilder = makeQueryBuilder({ data: { id: VALID_EVENT_ID }, error: null })
    const supabase = { from: vi.fn(() => eventsBuilder) }
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await insertEvent({ name: 'Show', date: '2024-05-01', venue_id: VALID_VENUE_ID } as never)

    expect(result).toEqual({ id: VALID_EVENT_ID })
    expect(after).toHaveBeenCalledTimes(1)
    expect(enrichEventFromExternal).not.toHaveBeenCalled()

    const scheduled = vi.mocked(after).mock.calls[0][0] as () => unknown
    await scheduled()
    expect(enrichEventFromExternal).toHaveBeenCalledWith(supabase, VALID_EVENT_ID)
  })

  it('insertEvent does not schedule the enrichment when the insert fails', async () => {
    const eventsBuilder = makeQueryBuilder({ data: null, error: { message: 'boom' } })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => eventsBuilder) }))

    const result = await insertEvent({ name: 'Show', date: '2024-05-01', venue_id: VALID_VENUE_ID } as never)

    expect(result.error).toBeTruthy()
    expect(after).not.toHaveBeenCalled()
  })

  it('insertEvent does not schedule the enrichment when the lineup insert fails', async () => {
    const eventsBuilder = makeQueryBuilder({ data: { id: VALID_EVENT_ID }, error: null })
    const lineupsBuilder = makeQueryBuilder({ data: null, error: { message: 'lineup boom' } })
    const fromMock = vi.fn((table: string) => (table === 'events' ? eventsBuilder : lineupsBuilder))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    await insertEvent({
      name: 'Show',
      date: '2024-05-01',
      venue_id: VALID_VENUE_ID,
      artist_ids: [VALID_ARTIST_ID],
    } as never)

    expect(after).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domains/events/service.test.ts`
Expected: the first new test FAILs (`after` never called). If the `lineups` failure test's builder does not resolve as an error because the mock's `insert` resolves through `.then`, mirror how the existing `'El recital se guardó, pero…'` lineup-failure test in this file builds its `lineupsBuilder` and copy that setup.

- [ ] **Step 3: Implement**

In `src/domains/events/service.ts` add the imports:

```ts
import { after } from 'next/server'
import { enrichEventFromExternal } from './enrichment/enrich-event'
```

At the very end of `insertEvent`, replace the final `return { id: newEvent.id }` with:

```ts
  // Enriquecimiento silencioso (issue #11): completa hora, póster y género
  // desde Ticketmaster DESPUÉS de responder. after() nunca demora el guardado
  // y enrichEventFromExternal nunca lanza, así que una API caída no puede
  // convertir un show creado en un error (mismo criterio que modifyProfile).
  after(() => enrichEventFromExternal(supabase, newEvent.id))

  return { id: newEvent.id }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/domains/events/service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domains/events/service.ts src/domains/events/service.test.ts
git commit -m "feat(events): schedule silent enrichment after creating a show (#11)"
```

---

### Task 8: Full verification

**Files:** none (verification only; fix regressions where they surface).

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: PASS. Any other test that imports the real `insertEvent` without mocking `next/server` will fail with an `after` outside-of-request-scope error; add `vi.mock('next/server', () => ({ after: vi.fn() }))` to that test file.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Apply the migration (manual, needs the linked Supabase project)**

Run: `npx supabase db push`
Expected: `20260919000000_show_enrichment.sql` applied. Then confirm in the Supabase SQL editor: `select column_name from information_schema.columns where table_name = 'events' and column_name in ('poster_url','time_known');` returns 2 rows.

- [ ] **Step 4: Manual end-to-end check (needs `TICKETMASTER_API_KEY` in `.env.local`)**

1. Run `npm run dev`, create a show with an artist that has a real upcoming Ticketmaster date, a venue in the right city, the correct date, and the **hour left empty**.
2. Expected: the save returns immediately; after a few seconds the event row has `time_known = true`, the real `date` hour and `poster_url`; the artist has a `genre` if it was empty.
3. Create the same show with an hour typed by hand: expected `date` untouched and `time_known = true` from the start.
4. Remove `TICKETMASTER_API_KEY` and create a show: expected it saves normally and nothing is enriched.

- [ ] **Step 5: Final commit (only if Step 1–2 required fixes)**

```bash
git add -A
git commit -m "test(events): keep suites green after enrichment wiring (#11)"
```
