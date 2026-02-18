import Link from 'next/link'
import { routes } from '@/src/core/lib/routes'

/**
 * Hero Section del Home.
 * Diseño monocromático industrial: fondo casi negro, gradiente radial sutil,
 * tipografía grande con tracking-tighter.
 */
export function Hero() {
    return (
        <section className="relative flex min-h-[85vh] flex-col items-center justify-center overflow-hidden bg-neutral-950 px-6 text-center">
            {/* Gradiente radial sutil de fondo */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(255,255,255,0.04) 0%, transparent 70%)',
                }}
            />

            {/* Patrón de puntos */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage:
                        'radial-gradient(circle, #fff 1px, transparent 1px)',
                    backgroundSize: '32px 32px',
                }}
            />

            {/* Contenido */}
            <div className="relative z-10 flex flex-col items-center gap-6 max-w-4xl">
                {/* Eyebrow */}
                <span className="text-[10px] font-semibold tracking-[0.35em] uppercase text-zinc-500">
                    RITUAL
                </span>

                {/* Título principal */}
                <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-balance text-white leading-[0.95]">
                    Tu Historial
                    <br />
                    <span className="text-zinc-400">de Recitales.</span>
                </h1>

                {/* Subtítulo */}
                <p className="max-w-md text-base text-zinc-500 leading-relaxed text-balance">
                    Guardá cada show que viviste. Artistas, sedes, fechas — todo en un solo lugar, sin ruido.
                </p>

                {/* CTAs */}
                <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                    <a
                        href="#recitales"
                        className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-neutral-950 hover:bg-zinc-100 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30"
                    >
                        Ver mis recitales
                    </a>
                    <Link
                        href={routes.events.search}
                        className="inline-flex items-center justify-center rounded-lg border border-white/15 px-6 py-3 text-sm font-semibold text-zinc-300 hover:border-white/30 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
                    >
                        Buscar nuevo show
                    </Link>
                </div>
            </div>

            {/* Indicador de scroll */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-zinc-700">
                <div className="h-8 w-px bg-gradient-to-b from-transparent to-zinc-700" />
            </div>
        </section>
    )
}
