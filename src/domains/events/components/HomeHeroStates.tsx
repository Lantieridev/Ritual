import Link from 'next/link'
import { Suspense, use, type ReactNode } from 'react'
import { MobileHeroAction } from '@/src/core/components/layout/MobileAction'
import { routes } from '@/src/core/lib/routes'
import { formatDate } from '@/src/core/lib/utils'
import { heroBadgeText, weatherTag, type HomeHeroState } from '@/src/domains/events/home-view'
import type { EventWithAttendance, EventWithRelations } from '@/src/domains/events/service'
import type { HeroVenueDetails } from '@/src/domains/events/hero-details'
import { MorningAfterScore } from './MorningAfterScore'

/**
 * Shape of `getFirstTimeSeeds`'s result (`recommendations/seeds.ts`),
 * duplicated structurally instead of imported: `recommendations` composes
 * `events` + `taste` (ADR 0001), so only `app/` is meant to import it —
 * `events` never imports back from it.
 */
interface SeedSet {
  names: string[]
  note: string
}

/*
 * Los cuatro estados de Hoy que no tienen show por delante — portados del
 * prototipo mobile (Ritual Mobile.dc.html: hoyManana, hoyPasado, hoyVacio,
 * hoySinSesion). Mobile-first; en desktop se estiran a pantalla completa y la
 * acción principal vuelve al flujo, porque ahí no hay talón fijo abajo.
 *
 * Donde el copy del prototipo afirmaba algo que Ritual todavía no sabe
 * ("lo más fuerte de la semana", "queda cargado con la fecha y la sede"), se
 * dijo lo que sí es cierto: el propio diseño pide no fingir personalización.
 */

const DESKTOP_PRIMARY = 'items-center justify-center font-figure text-xl tracking-wider bg-ritual-red text-ritual-bone px-8 py-3.5'
const DESKTOP_SECONDARY = 'items-center justify-center font-label text-[10px] tracking-[0.14em] text-ritual-gray-text uppercase border border-ritual-border px-6 py-3'
const LIST_KICKER = 'font-label text-[9px] tracking-[0.24em] uppercase text-ritual-gray-mid-2'

function headlinerOf(event: EventWithRelations): string {
  return event.lineups?.[0]?.artists.name ?? event.name ?? 'Recital'
}

function Wordmark() {
  return (
    <span className="font-display text-[20px] tracking-[0.06em] uppercase text-ritual-bone">
      Ritu<span className="text-ritual-red">al</span>
    </span>
  )
}

/**
 * Isotipo arriba en mobile (en desktop ya está el Navbar). Sobre una foto va
 * absoluto; `inFlow` lo deja en el flujo cuando no hay foto debajo.
 */
function MobileHomeHeader({ guest = false, inFlow = false }: { guest?: boolean; inFlow?: boolean }) {
  const position = inFlow ? '' : 'absolute top-3 inset-x-5 z-20'
  return (
    <div className={`md:hidden ${position} flex items-center justify-between min-h-[44px]`}>
      <Wordmark />
      {guest && (
        <Link
          href={routes.login}
          className="flex items-center min-h-[44px] font-label text-[10px] tracking-[0.2em] uppercase text-ritual-bone border-b border-ritual-red"
        >
          Entrar
        </Link>
      )}
    </div>
  )
}

function StateBadge({ children, tone = 'red' }: { children: ReactNode; tone?: 'red' | 'bone' }) {
  const colors = tone === 'bone' ? 'bg-ritual-bone text-ritual-panel' : 'bg-ritual-red text-ritual-panel'
  return (
    <p className={`absolute left-5 top-[64px] md:left-10 md:top-24 z-20 font-label text-[9px] font-bold tracking-[0.26em] uppercase px-[9px] py-[5px] ${colors}`}>
      {children}
    </p>
  )
}

/*
 * Scrim sobre la foto. "Sólo pasado" lo lleva un poco más cerrado que el
 * resto (.45 al 60%, .62 arriba) porque su texto es más largo — valores del
 * prototipo, no del ojo.
 */
const SCRIMS = {
  default: 'from-ritual-panel from-[10%] via-ritual-panel/40 via-[58%] to-ritual-panel/60',
  past: 'from-ritual-panel from-[10%] via-ritual-panel/45 via-[60%] to-ritual-panel/62',
} as const

function PhotoHero({
  image,
  position,
  scrim = 'default',
  children,
}: {
  image: string | null
  position: string
  scrim?: keyof typeof SCRIMS
  children: ReactNode
}) {
  return (
    <section className="relative h-[472px] md:h-auto md:min-h-screen snap-start overflow-hidden bg-ritual-panel">
      <div className="absolute inset-0 ritual-photo-fallback" />
      {image && (
        <div
          className="absolute inset-0 ritual-photo ritual-photo-bg"
          style={{ backgroundImage: `url(${image})`, backgroundSize: 'cover', backgroundPosition: position }}
        />
      )}
      <div className={`absolute inset-0 bg-gradient-to-t ${SCRIMS[scrim]}`} />
      {children}
    </section>
  )
}

function HeroBottom({ children }: { children: ReactNode }) {
  return <div className="absolute inset-x-5 bottom-5 md:inset-x-10 md:bottom-16 z-20 md:max-w-2xl">{children}</div>
}

/** La mañana después: el show de anoche todavía sin puntuar. */
export function MorningAfterHero({ event, image }: { event: EventWithAttendance; image: string | null }) {
  const details = [headlinerOf(event), event.venues?.name, 'anoche'].filter(Boolean).join(' · ')
  const pending = [
    { label: 'Escribir la reseña', hint: 'Dos líneas alcanzan', href: routes.events.detail(event.id), tone: 'text-ritual-bone' },
    { label: 'Cargar el gasto', hint: 'Entrada, viaje, birra', href: routes.events.expenses(event.id), tone: 'text-ritual-red' },
  ]

  return (
    <>
      <PhotoHero image={image} position="44% 34%">
        <MobileHomeHeader />
        <StateBadge tone="bone">Anoche · sin puntuar</StateBadge>
        <HeroBottom>
          <h1 className="font-display text-[62px] md:text-[11vh] leading-[0.82] tracking-[-0.02em] uppercase text-ritual-bone">
            ¿Cómo<br />estuvo?
          </h1>
          <p className="font-subtitle font-black text-[22px] leading-none uppercase text-ritual-gray-light-3 mt-[10px]">
            {details}
          </p>
          <p className="font-body italic text-[14px] text-ritual-gray-text mt-2 max-w-[290px]">
            Escribilo hoy o no lo escribís nunca. Con el puntaje solo ya alcanza.
          </p>
          <div className="md:max-w-sm">
            <MorningAfterScore eventId={event.id} />
          </div>
        </HeroBottom>
      </PhotoHero>

      <div className="px-5 pt-[22px] md:px-10 md:pt-10">
        <p className={LIST_KICKER}>Lo que queda de anoche</p>
        {pending.map(({ label, hint, href, tone }) => (
          <Link key={label} href={href} className="flex items-center gap-3 py-[14px] min-h-[60px] border-b border-ritual-surface-high">
            <span className="flex-1">
              <span className={`block font-subtitle font-black text-[21px] leading-none uppercase ${tone}`}>{label}</span>
              <span className="block font-label text-[9px] tracking-[0.1em] uppercase text-ritual-gray-mid-2 mt-1">{hint}</span>
            </span>
            <span aria-hidden className="font-label text-[13px] text-ritual-red">→</span>
          </Link>
        ))}
      </div>

      <MobileHeroAction label="Puntuar anoche" href={routes.events.detail(event.id)} />
    </>
  )
}

/** Sólo pasado: la efeméride manda, las sugerencias quedan debajo como salida. */
export function PastOnlyHero({
  event,
  yearsAgo,
  image,
}: {
  event: EventWithAttendance
  yearsAgo: number | null
  image: string | null
}) {
  const rating = event.attendance?.[0]?.rating
  // Menos de un año no es efeméride (buildHomeHeroState nunca lo manda, pero
  // "hace 0 años" no puede llegar a pantalla aunque cambie el cálculo).
  const kicker =
    yearsAgo === null || yearsAgo < 1
      ? 'Lo último que viste'
      : yearsAgo === 1
        ? 'Hace un año, hoy'
        : `Hace ${yearsAgo} años, hoy`
  const dateLine = [
    formatDate(event.date, { day: '2-digit', month: 'short', year: 'numeric' }),
    rating ? `le pusiste ${rating}/5` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const place = [event.venues?.name, event.venues?.city].filter(Boolean).join(' · ')

  return (
    <>
      <PhotoHero image={image} position="60% 26%" scrim="past">
        <MobileHomeHeader />
        <StateBadge>{kicker}</StateBadge>
        <HeroBottom>
          <p className="font-figure text-[19px] tracking-[0.14em] uppercase text-ritual-red">{dateLine}</p>
          <h1 className="font-display text-[64px] md:text-[11vh] leading-[0.82] tracking-[-0.02em] uppercase text-ritual-bone mt-1">
            {headlinerOf(event)}
          </h1>
          {place && (
            <p className="font-subtitle font-black text-[21px] leading-none uppercase text-ritual-gray-light-3 mt-2">{place}</p>
          )}
          <p className="font-body italic text-[14px] text-ritual-gray-text mt-2 max-w-[300px]">
            No tenés nada próximo cargado. Mientras, tu colección sigue acá.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-[14px]">
            <Link
              href={routes.events.detail(event.id)}
              className="inline-flex items-center gap-2 min-h-[48px] px-[15px] border border-ritual-gray-muted font-figure text-[16px] tracking-[0.1em] uppercase text-ritual-bone"
            >
              Ver ese show <span aria-hidden className="text-ritual-red">→</span>
            </Link>
            <Link href={routes.events.new} className={`hidden md:inline-flex ${DESKTOP_PRIMARY}`}>
              Cargar un show
            </Link>
          </div>
        </HeroBottom>
      </PhotoHero>

      <MobileHeroAction label="Cargar un show" href={routes.events.new} />
    </>
  )
}

const PROMISES = [
  { n: '01', label: 'El show de esta noche, con la hora y cómo llegar' },
  { n: '02', label: 'Tu entrada, lista para la puerta' },
  { n: '03', label: 'Los que no te perderías, según lo que cargues' },
]

/** El talón sin emitir: el mismo troquel del sistema, sin tinta todavía. */
function UnissuedTicket() {
  return (
    <div aria-hidden className="mx-6 md:mx-0 md:max-w-md h-[168px] overflow-hidden flex border-2 border-dashed border-ritual-mobile-dashed">
      <div className="w-[52px] flex-none flex items-center justify-center border-r-2 border-dashed border-ritual-mobile-dashed">
        <span className="[writing-mode:vertical-rl] whitespace-nowrap font-label text-[9px] tracking-[0.36em] text-ritual-mobile-ghost-label">
          SIN EMITIR
        </span>
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between px-[14px] pt-[14px] pb-4">
        <span className="font-label text-[9px] tracking-[0.24em] uppercase text-ritual-mobile-ghost-label">Talón Nº 0000001</span>
        <span className="font-display text-[30px] leading-[0.88] uppercase text-ritual-mobile-ghost">
          Tu primer<br />talón
        </span>
        <span
          className="block w-24 h-4"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, var(--color-ritual-mobile-ghost) 0 2px, transparent 2px 5px, var(--color-ritual-mobile-ghost) 5px 6px, transparent 6px 10px)',
          }}
        />
      </div>
    </div>
  )
}

/**
 * Los chips de semilla ya resueltos, más la nota honesta del escalón de la
 * escalera que los produjo (issue #81's seed ladder) — `pickSeeds` decide
 * cuál es, nunca se inventa acá.
 */
function SeedChips({ seeds }: { seeds: SeedSet }) {
  return (
    <>
      <div className="flex flex-wrap gap-2 mt-3">
        {seeds.names.map((name) => (
          <Link
            key={name}
            href={`${routes.events.search}?artist=${encodeURIComponent(name)}`}
            className="min-h-[48px] flex items-center gap-2 px-[14px] border border-ritual-mobile-line font-figure text-[17px] tracking-[0.08em] uppercase text-ritual-gray-light-3"
          >
            {name}
            <span aria-hidden className="font-label text-[12px] text-ritual-red">+</span>
          </Link>
        ))}
      </div>
      <p className="font-label text-[9px] tracking-[0.14em] uppercase text-ritual-gray-mid mt-3">{seeds.note}</p>
    </>
  )
}

/** Resuelve la Promise de semillas en su propio Suspense (mismo patrón que `ResolvedTonightMeta`) — nunca bloquea el resto del hero. */
function ResolvedSeedChips({ seeds }: { seeds: Promise<SeedSet> }) {
  return <SeedChips seeds={use(seeds)} />
}

/**
 * Mientras las semillas resuelven (o si no se pasó `seeds`): dos filas en
 * hueco y un status accesible — nunca una lista inventada. El status vive
 * FUERA del bloque `aria-hidden`: un ancestro `aria-hidden` saca del árbol
 * de accesibilidad a todos sus descendientes, status incluido.
 */
function SeedChipsFallback() {
  return (
    <div className="mt-3">
      <div aria-hidden="true" className="flex flex-wrap gap-2">
        <div className="min-h-[48px] w-28 border border-ritual-mobile-line" />
        <div className="min-h-[48px] w-28 border border-ritual-mobile-line" />
      </div>
      <span role="status" className="sr-only">Buscando tus primeras semillas</span>
    </div>
  )
}

/** Primera vez: no es un vacío, es un talón sin emitir. */
export function FirstTimeHero({ seeds }: { seeds?: Promise<SeedSet> }) {
  return (
    <>
      <section className="relative snap-start bg-ritual-mobile-blank flex flex-col gap-[22px] px-5 pt-3 pb-6 md:min-h-screen md:justify-center md:px-10 md:pt-24">
        <div className="md:hidden flex items-center min-h-[44px]">
          <Wordmark />
        </div>
        <UnissuedTicket />
        <div>
          <div className="flex items-center gap-[9px]">
            <span className="w-6 h-[2px] bg-ritual-red" />
            <span className="font-label text-[9px] tracking-[0.26em] uppercase text-ritual-gray-text">
              no hay nada que abrir todavía
            </span>
          </div>
          <h1 className="font-display text-[44px] md:text-[9vh] leading-[0.86] tracking-[-0.02em] uppercase text-ritual-bone mt-3">
            Empezá por<br />el último<br />que viste
          </h1>
          <p className="font-body italic text-[14.5px] text-ritual-gray-text mt-[10px] max-w-[290px]">
            Ritual no arranca vacío: arranca con lo que ya fuiste. Los shows viejos también son talones.
          </p>
          <div className="hidden md:flex flex-wrap items-center gap-3 mt-8">
            <Link href={routes.events.search} className={`inline-flex ${DESKTOP_PRIMARY}`}>
              Buscar mi primer show
            </Link>
            <Link href={routes.events.new} className={`inline-flex ${DESKTOP_SECONDARY}`}>
              Cargarlo a mano
            </Link>
          </div>
        </div>
      </section>

      <div className="px-5 pt-6 md:px-10">
        <p className={LIST_KICKER}>¿A cuál de estos fuiste?</p>
        {seeds ? (
          <Suspense fallback={<SeedChipsFallback />}>
            <ResolvedSeedChips seeds={seeds} />
          </Suspense>
        ) : (
          <SeedChipsFallback />
        )}
        <p className="font-body italic text-[12.5px] text-ritual-gray-mid mt-[6px]">
          Tocá uno y buscás sus shows para marcar el que viste.
        </p>
      </div>

      <div className="px-5 pt-[26px] mt-2 border-t border-ritual-surface-high md:px-10">
        <p className={LIST_KICKER}>Lo que se va a llenar acá</p>
        {PROMISES.map(({ n, label }) => (
          <div key={n} className="flex items-center gap-[14px] py-[13px] border-b border-ritual-surface-high">
            {/* El número es tinta fantasma a propósito (todavía no se llenó):
                decorativo, el orden no aporta nada al que escucha la lista. */}
            <span aria-hidden className="w-11 flex-none font-display text-[26px] text-ritual-mobile-ghost">{n}</span>
            <span className="flex-1 font-subtitle font-extrabold text-[19px] leading-none uppercase text-ritual-gray-mid-2">
              {label}
            </span>
          </div>
        ))}
      </div>

      <MobileHeroAction
        label="Buscar mi primer show"
        href={routes.events.search}
        altLabel="Cargarlo a mano"
        altHref={routes.events.new}
      />
    </>
  )
}

/** Sin sesión: misma maqueta, fuente de datos del catálogo, sin fingir personalización. */
export function GuestHero({
  event,
  image,
  suggestions,
}: {
  event: EventWithRelations | undefined
  image: string | null
  /** La franja de sugerencias (issue #81), ya resuelta como elemento — ver JD-006 en HomeHero.tsx. */
  suggestions?: ReactNode
}) {
  const place = event ? [event.venues?.name, event.venues?.city].filter(Boolean).join(' · ') : ''

  return (
    <>
      {event ? (
        <PhotoHero image={image} position="50% 28%">
          <MobileHomeHeader guest />
          <StateBadge>Se viene</StateBadge>
          <HeroBottom>
            <p className="font-figure text-[19px] tracking-[0.14em] uppercase text-ritual-red">
              {formatDate(event.date, { weekday: 'short', day: '2-digit', month: 'short' })}
            </p>
            <h1 className="font-display text-[66px] md:text-[11vh] leading-[0.8] tracking-[-0.02em] uppercase text-ritual-bone mt-1">
              {headlinerOf(event)}
            </h1>
            {place && (
              <p className="font-subtitle font-black text-[22px] leading-none uppercase text-ritual-gray-light-3 mt-2">{place}</p>
            )}
            <p className="font-body italic text-[14px] text-ritual-gray-text mt-2 max-w-[296px]">
              Sin sesión te mostramos lo que se viene. Con sesión, lo que es para vos.
            </p>
            <div className="hidden md:flex flex-wrap items-center gap-3 mt-8">
              <Link href={routes.login} className={`inline-flex ${DESKTOP_PRIMARY}`}>
                Cortar tu talón
              </Link>
              <Link href={routes.events.detail(event.id)} className={`inline-flex ${DESKTOP_SECONDARY}`}>
                Ver el show
              </Link>
            </div>
          </HeroBottom>
        </PhotoHero>
      ) : (
        // Sin show en el catálogo no hay foto que sostener: el header va en el
        // flujo y la tarjeta sube, en vez de dejar un bloque negro vacío.
        <section className="snap-start bg-ritual-panel px-5 pt-3 md:px-10 md:pt-24">
          <MobileHomeHeader guest inFlow />
        </section>
      )}

      {suggestions}

      <div className="mx-5 mt-6 border-2 border-dashed border-ritual-mobile-dashed px-4 py-[18px] md:mx-10 md:max-w-xl">
        <p className="font-display text-[26px] leading-[0.94] uppercase text-ritual-bone">
          Esto es tu<br />colección vacía
        </p>
        <p className="font-body italic text-[13px] text-ritual-gray-text mt-2">
          Cortá tu talón y el inicio pasa a ser tuyo: tu ciudad, tus géneros, tus sedes.
        </p>
        {!event && (
          <Link href={routes.login} className={`hidden md:inline-flex mt-6 ${DESKTOP_PRIMARY}`}>
            Cortar tu talón
          </Link>
        )}
      </div>

      <MobileHeroAction label="Cortar tu talón" href={routes.login} />
    </>
  )
}

/* Scrim propio del hero de "hoy" mobile (.dc.html línea 271): más abierto que
   el resto porque el h1 y el meta que sigue debajo necesitan leerse sobre la
   foto sin que el degradado los tape antes de tiempo. */
const TONIGHT_SCRIM = 'from-ritual-panel from-[8%] via-ritual-panel/35 via-[60%] to-ritual-panel/55'

/**
 * Resuelve la Promise de dirección/clima en su propio Suspense (R1-008,
 * issue #82): sólo esta pieza espera al clima, nunca el resto del hero.
 */
function ResolvedTonightMeta({ details }: { details: Promise<HeroVenueDetails> }) {
  return <TonightMeta details={use(details)} />
}

/**
 * Hero mobile de "hoy" (show-today) y "cuenta regresiva" (normal) — sin la
 * butaca hardcodeada del desktop (Ritual no tiene esa data) y sin el 3D, que
 * en mobile no monta (issue #82). HomeHero.tsx lo cablea dentro de un
 * `md:hidden`, junto al desktop existente.
 */
export function TonightMobileHero({
  state,
  image,
  details,
}: {
  state: Extract<HomeHeroState, { kind: 'show-today' | 'normal' }>
  image: string | null
  details: Promise<HeroVenueDetails> | HeroVenueDetails | null
}) {
  const event = state.kind === 'show-today' ? state.event : state.nextShow
  const headliner = headlinerOf(event)
  const venueName = event.venues?.name ?? ''

  return (
    <section className="relative h-[500px] overflow-hidden bg-ritual-panel">
      <div className="absolute inset-0 ritual-photo-fallback" />
      {image && (
        <div
          className="absolute inset-0 ritual-photo ritual-photo-bg"
          style={{ backgroundImage: `url(${image})`, backgroundSize: 'cover', backgroundPosition: '56% 22%' }}
        />
      )}
      <div className={`absolute inset-0 bg-gradient-to-t ${TONIGHT_SCRIM}`} />
      <p className="absolute left-5 top-[104px] z-20 font-label text-[9px] font-bold tracking-[0.26em] uppercase px-[9px] py-[5px] bg-ritual-red text-ritual-panel">
        {heroBadgeText(state)}
      </p>
      <div className="absolute inset-x-5 bottom-5 z-20">
        <h1 className="font-display text-[length:min(78px,19vw)] leading-[0.79] tracking-[-0.02em] uppercase text-ritual-bone">
          {headliner}
        </h1>
        {venueName && (
          <p className="font-subtitle font-black text-[22px] uppercase leading-none text-ritual-gray-light-3 mt-2">
            {venueName}
          </p>
        )}
        <Suspense fallback={null}>
          {details instanceof Promise ? <ResolvedTonightMeta details={details} /> : <TonightMeta details={details} />}
        </Suspense>
      </div>
    </section>
  )
}

/**
 * Línea de dirección y clima del show de hoy — sin dato inventado: cada
 * parte se omite si no está resuelta, y el separador nunca queda colgando
 * (issue #82).
 */
export function TonightMeta({ details }: { details: HeroVenueDetails | null }) {
  if (!details) return null
  const { address, weather } = details
  if (!address && !weather) return null

  return (
    <div className="flex flex-wrap items-center gap-2 mt-[9px] font-label text-[9px] tracking-[0.1em] uppercase text-ritual-gray-text">
      {address && <span>{address}</span>}
      {address && weather && (
        <span aria-hidden="true" className="text-ritual-mobile-sep">·</span>
      )}
      {weather && <span className="text-ritual-red">{weatherTag(weather)}</span>}
    </div>
  )
}

/**
 * "Lo último que viste" — hasta `RECENT_SEEN_LIMIT` shows vistos, con o sin
 * puntaje (issue #82). Se omite entera sin shows vistos; nunca rellena con
 * slots vacíos si hay menos de tres.
 */
export function RecentSeenList({ events }: { events: EventWithAttendance[] }) {
  if (events.length === 0) return null

  return (
    <div className="px-5 pt-[22px]">
      <p className={LIST_KICKER}>Lo último que viste</p>
      {events.map((ev) => {
        const rating = ev.attendance?.[0]?.rating
        const meta = [ev.venues?.name, formatDate(ev.date, { day: '2-digit', month: 'short' })]
          .filter(Boolean)
          .join(' · ')
        return (
          <div key={ev.id} className="flex items-center gap-[13px] py-3 border-b border-ritual-surface-high">
            <div aria-hidden="true" className="w-11 h-14 flex-none ritual-photo-fallback" />
            <div className="flex-1 min-w-0">
              <p className="font-subtitle font-black text-[21px] uppercase leading-none text-ritual-bone">
                {headlinerOf(ev)}
              </p>
              <p className="font-label text-[9px] tracking-[0.1em] uppercase text-ritual-gray-mid-2 mt-[3px]">
                {meta}
              </p>
            </div>
            {rating != null && (
              <span className="font-display text-[19px] text-ritual-red">
                <span aria-hidden="true">{rating}/5</span>
                <span className="sr-only">Le pusiste {rating} de 5</span>
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
