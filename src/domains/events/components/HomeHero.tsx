'use client'

import { useState, use } from 'react'
import Link from 'next/link'
import { TicketEmbed } from '@/src/core/components/ui'
import { routes } from '@/src/core/lib/routes'
import { formatDate } from '@/src/core/lib/utils'
import type { HomeHeroState } from '@/src/domains/events/home-view'

interface HomeHeroProps {
  state: HomeHeroState
  backgroundImage: Promise<string | null> | string | null
  /**
   * Cuántos shows tiene marcados como "fui". Sólo se usa cuando no hay show
   * agendado (`state.kind === 'normal'` con `nextShow` undefined), para
   * distinguir un archivo real sin nada agendado de un usuario que recién
   * empieza — son dos estados vacíos distintos, no el mismo mensaje.
   */
  archiveCount?: number
}

/**
 * El hero de Inicio, en sus tres estados reales (festival en curso / show
 * hoy / cuenta regresiva normal) — ver 01 del handoff de rediseño. El
 * talón 3D solo entra en juego para show-today y normal: un festival no
 * tiene "una" entrada, tiene un evento por día.
 */
export function HomeHero({ state, backgroundImage, archiveCount = 0 }: HomeHeroProps) {
  const resolvedBg = backgroundImage instanceof Promise ? use(backgroundImage) : backgroundImage
  const [open, setOpen] = useState(false)

  if (state.kind === 'festival') {
    return (
      <section className="relative min-h-screen snap-start flex flex-col justify-center px-6 md:px-10 pt-16 overflow-hidden bg-ritual-panel">
        <p className="font-label text-[10px] tracking-[0.32em] text-ritual-red-hover uppercase">
          Está pasando ahora
        </p>
        <h1 className="font-display text-[13vh] leading-[0.82] uppercase text-ritual-bone mt-2">
          {state.festival.name}
        </h1>
        <p className="font-subtitle font-black text-2xl uppercase text-ritual-gray-light-3 mt-2">
          {formatDate(state.festival.start_date, { day: 'numeric', month: 'long' })}
          {state.festival.end_date && state.festival.end_date !== state.festival.start_date && (
            <> — {formatDate(state.festival.end_date, { day: 'numeric', month: 'long' })}</>
          )}
        </p>
        <Link
          href={routes.festivals.detail(state.festival.id)}
          className="font-figure text-lg tracking-wider bg-ritual-red text-ritual-bone px-6 py-3 mt-8 w-fit"
        >
          VER EL FESTIVAL
        </Link>
      </section>
    )
  }

  const event = state.kind === 'show-today' ? state.event : state.nextShow

  if (!event) {
    // Dos usuarios muy distintos caen acá y no son el mismo mensaje: uno
    // recién empieza (nunca cargó nada), el otro tiene un archivo entero y
    // simplemente no tiene nada agendado ahora mismo. Confundirlos — "todavía
    // no hay ningún talón" a alguien con 40 shows encima — no tiene sentido.
    const hasArchive = archiveCount > 0

    return (
      <section className="relative min-h-screen snap-start flex flex-col justify-center items-start px-6 md:px-10 pt-16 bg-ritual-panel overflow-hidden">
        {/*
          El fondo se resuelve del último show del archivo cuando no hay
          ninguno agendado, así que alguien con historial pero sin nada
          próximo ya no ve una pantalla pelada. Si no hay imagen —usuario
          nuevo, o las fuentes externas caídas— el degradado sobre
          `bg-ritual-panel` se ve igual que antes.
        */}
        <div className="absolute inset-0 ritual-photo-fallback" />
        {resolvedBg && (
          <div
            className="absolute inset-0 ritual-photo ritual-photo-bg"
            style={{ backgroundImage: `url(${resolvedBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ritual-bg via-ritual-bg/60 to-ritual-bg/20" />

        {hasArchive ? (
          <>
            {/* Mismo lenguaje visual que el contador de días (número gigante
                en hueco + kicker colgando), reutilizado para mostrar cuántos
                talones ya tiene en vez de una cuenta regresiva que no existe. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute z-10 font-display select-none"
              style={{
                left: '44px',
                top: '12vh',
                fontSize: '23vh',
                lineHeight: '.78',
                letterSpacing: '-.03em',
                color: 'transparent',
                WebkitTextStroke: '2px rgba(237,235,230,.5)',
              }}
            >
              {archiveCount}
            </div>
            <p
              className="pointer-events-none absolute z-10 font-label uppercase"
              style={{
                left: '48px',
                top: 'calc(12vh + 18vh)',
                background: 'var(--color-ritual-panel)',
                padding: '6px 12px',
                fontSize: '11px',
                letterSpacing: '.4em',
                color: 'var(--color-ritual-red)',
              }}
            >
              {archiveCount === 1 ? 'talón en el archivo' : 'talones en el archivo'}
            </p>

            <p className="relative font-label text-[10px] tracking-[0.32em] text-ritual-gray-text uppercase mt-[26vh]">
              Sin nada agendado
            </p>
            <h1 className="relative font-display text-[9vh] leading-[0.82] uppercase text-ritual-bone mt-2">
              Tu próximo ritual,<br />todavía sin fecha
            </h1>
            <div className="relative flex gap-3 mt-8">
              <Link href={routes.events.search} className="font-figure text-lg tracking-wider bg-ritual-red text-ritual-bone px-6 py-3">
                BUSCAR TU PRÓXIMO SHOW
              </Link>
              <Link href={routes.events.new} className="font-label text-[10px] tracking-[0.14em] text-ritual-gray-text uppercase border border-ritual-border px-6 py-3">
                Cargar a mano
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="relative font-label text-[10px] tracking-[0.32em] text-ritual-gray-text uppercase">Tu archivo</p>
            <h1 className="relative font-display text-[9vh] leading-[0.82] uppercase text-ritual-bone mt-2">
              Todavía no hay<br />ningún talón
            </h1>
            <div className="relative flex gap-3 mt-8">
              <Link href={routes.events.search} className="font-figure text-lg tracking-wider bg-ritual-red text-ritual-bone px-6 py-3">
                BUSCAR SHOWS
              </Link>
              <Link href={routes.events.new} className="font-label text-[10px] tracking-[0.14em] text-ritual-gray-text uppercase border border-ritual-border px-6 py-3">
                Cargar a mano
              </Link>
            </div>
          </>
        )}
      </section>
    )
  }

  const artists = event.lineups?.map((l) => l.artists.name) ?? []
  const headliner = artists[0] ?? event.name ?? 'Recital'
  const venueName = event.venues?.name ?? ''
  const venueLocation = [event.venues?.city, event.venues?.country].filter(Boolean).join(', ')
  const days = state.kind === 'show-today' ? 0 : state.daysUntil

  return (
    <section className="relative min-h-screen snap-start overflow-hidden bg-ritual-panel">
      {/* El bloque tonal va siempre, debajo de la foto: si la fuente externa
          no resolvió imagen el hero igual tiene volumen en vez de negro
          plano, que es como el diseño lo piensa sin fotos. */}
      <div className="absolute inset-0 ritual-photo-fallback" />
      {resolvedBg && (
        <div
          className="absolute inset-0 ritual-photo ritual-photo-bg"
          style={{
            backgroundImage: `url(${resolvedBg})`,
            backgroundSize: 'cover',
            // El prototipo encuadra la foto arriba y apenas a la derecha: es
            // donde suele caer la cara, y deja el aire de la izquierda para
            // el contador y el nombre.
            backgroundPosition: '52% 26%',
          }}
        />
      )}
      {/* Al abrir la entrada el scrim se retira casi del todo (1 → .25): la
          foto se revela justo cuando el talón pasa a ser el protagonista. */}
      <div
        className="pointer-events-none absolute inset-0 ritual-hero-scrim-x motion-safe:transition-opacity motion-safe:duration-700"
        style={{ opacity: open ? 0.25 : 1 }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 ritual-hero-scrim-y" />

      {/*
        Todo el texto del hero vive en una sola capa —como el `.layer` del
        prototipo— para que al abrir la entrada se retire junto: se desvanece
        y se corre 26px a la izquierda, dejándole la pantalla al talón. Antes
        se quedaba fijo y competía con el objeto.
      */}
      <div
        className="absolute inset-0 motion-safe:transition-[opacity,transform] motion-safe:duration-[620ms]"
        style={{
          transitionTimingFunction: 'var(--ease-ritual)',
          opacity: open ? 0 : 1,
          transform: open ? 'translateX(-26px)' : 'translateX(0)',
          pointerEvents: open ? 'none' : undefined,
        }}
      >

      {/* El contador va absoluto arriba a la izquierda y en hueco, no en el
          flujo: en el diseño es la marca de la pantalla, y la foto se lee a
          través de él. Valores tomados del prototipo, no aproximados. */}
      {days !== null && days > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-10 font-display select-none"
          style={{
            left: '44px',
            top: '12vh',
            fontSize: '23vh',
            lineHeight: '.78',
            letterSpacing: '-.03em',
            color: 'transparent',
            WebkitTextStroke: '2px rgba(237,235,230,.5)',
          }}
        >
          {days}
        </div>
      )}

      {/* El kicker cuelga del contador: sin él el número gigante no dice de
          qué es. Va sobre un bloque opaco para recortarse contra la foto. */}
      {days !== null && days > 0 && (
        <p
          className="pointer-events-none absolute z-10 font-label uppercase"
          style={{
            left: '48px',
            top: 'calc(12vh + 18vh)',
            background: 'var(--color-ritual-panel)',
            padding: '6px 12px',
            fontSize: '11px',
            letterSpacing: '.4em',
            color: 'var(--color-ritual-red)',
          }}
        >
          días para el ritual
        </p>
      )}

      {/* El talón está siempre en cuadro, fundido con la foto. Al abrir sólo
          cambian transform y opacity: animar width/height reiniciaría el
          renderer de three.js del iframe y produce glitch. */}
      <div
        className="pointer-events-none absolute z-10 hidden md:block motion-safe:transition-[transform,opacity] motion-safe:duration-[1050ms]"
        style={{
          left: '46%',
          top: '-14%',
          width: '60%',
          height: '128%',
          mixBlendMode: 'screen',
          transitionTimingFunction: 'var(--ease-ritual)',
          transform: open ? 'translateX(-16%) scale(1.06)' : 'translateX(0) scale(1)',
          opacity: open ? 1 : 0.85,
        }}
      >
        <TicketEmbed
          material="hierro"
          artistLine1={headliner.toUpperCase()}
          venue={venueName || 'A confirmar'}
          address={venueLocation}
          when={formatDate(event.date, { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
          date={event.date.slice(0, 10)}
          seat="Campo general"
          seatShort="Campo General"
          className="w-full h-full"
          title={`Entrada — ${headliner}`}
        />
      </div>

      <div className="relative z-20 flex flex-col justify-end min-h-screen px-6 md:px-10 pb-16 pt-24">
        {days === 0 && (
          <span className="font-label text-[11px] tracking-[0.32em] bg-ritual-red text-ritual-bone px-3 py-1.5 w-fit uppercase font-bold">
            es hoy
          </span>
        )}

        <h1 className="font-display text-[11vh] leading-[0.82] uppercase text-ritual-bone mt-2">
          {headliner}
        </h1>
        {venueName && (
          <p className="font-subtitle font-black text-2xl uppercase text-ritual-gray-light-3 mt-2">
            {venueName}{venueLocation && ` · ${venueLocation}`} · {formatDate(event.date, { day: 'numeric', month: 'short' })}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 mt-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ritual-cta font-figure text-xl tracking-wider bg-ritual-red text-ritual-bone px-8 py-3.5"
          >
            ABRIR MI ENTRADA
          </button>
          <Link
            href={routes.events.detail(event.id)}
            className="ritual-btn font-label text-[10px] tracking-[0.14em] text-ritual-gray-text uppercase border border-ritual-border-2 px-4 py-3"
          >
            Ver función
          </Link>
        </div>
      </div>

      </div>

      {/* Sin esto el scroll snap se lee como que la pantalla termina acá. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex flex-col items-center gap-1.5 ritual-bob">
        <span className="font-label text-[9px] tracking-[0.24em] uppercase text-ritual-gray-mid-2">
          seguí bajando
        </span>
        <span className="font-figure text-[18px] leading-none text-ritual-gray-mid-2" aria-hidden="true">
          ↓
        </span>
      </div>

      {/* Apertura continua: el panel entra sobre la misma pantalla, sin
          navegar y sin tapar el talón — el diseño oscurece la foto y corre el
          objeto, no lo reemplaza por un modal. */}
      <div
        className="pointer-events-none absolute inset-0 z-[15] bg-ritual-bg motion-safe:transition-opacity motion-safe:duration-[620ms]"
        style={{ transitionTimingFunction: "var(--ease-ritual)", opacity: open ? 0.62 : 0 }}
        aria-hidden="true"
      />

      {open && (
        <div className="absolute inset-x-0 bottom-0 z-30 px-6 md:px-10 pb-16">
          <div className="max-w-md border-l-[3px] border-ritual-red bg-ritual-surface/95 px-6 py-6 backdrop-blur-sm">
            <p className="font-label text-[10px] tracking-[0.16em] text-ritual-red-hover uppercase mb-2">Entrada válida</p>
            <p className="font-display text-4xl uppercase text-ritual-bone">{headliner}</p>
            <p className="font-subtitle font-black uppercase text-ritual-gray-light-3 mt-1">
              {venueName}{venueLocation && ` · ${venueLocation}`}
            </p>
            <p className="font-label text-[10px] tracking-[0.16em] text-ritual-gray-text uppercase mt-3">
              {formatDate(event.date, { weekday: 'long', day: 'numeric', month: 'long' })} · Campo general
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="font-label text-[10px] tracking-[0.16em] text-ritual-gray-text uppercase border border-ritual-border px-4 py-2 mt-6"
            >
              Cerrar ✕
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
