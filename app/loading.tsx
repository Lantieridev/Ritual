/**
 * Loading global: se muestra mientras se carga cualquier página.
 * Evita pantalla en blanco en navegación.
 */
export default function Loading() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6 md:p-8 font-sans flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" aria-hidden />
        <p className="text-zinc-500 text-sm">Cargando...</p>
      </div>
    </main>
  )
}
