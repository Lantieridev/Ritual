import { supabase } from '@/src/lib/supabase'
export default async function Home() {
  // 1. Pedimos los eventos a Supabase
  const { data: events, error } = await supabase
    .from('events')
    .select(`
      *,
      venues ( name, city ),
      lineups (
        artists ( name, genre )
      )
    `)

  if (error) console.error("Error cargando eventos:", error)

  // 2. Renderizamos la pantalla
  return (
    <main className="min-h-screen bg-neutral-950 text-white p-8 font-sans">
      <h1 className="text-4xl font-bold mb-8 text-yellow-500 tracking-tighter">
        PRÓXIMOS RITUALES
      </h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events?.map((event) => (
          <div key={event.id} className="group border border-white/10 bg-white/5 p-6 rounded-xl hover:border-yellow-500/50 transition-all">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm text-zinc-400 font-medium uppercase tracking-widest">
                  {new Date(event.date).toLocaleDateString()}
                </p>
                <h2 className="text-2xl font-bold mt-1 group-hover:text-yellow-400 transition-colors">
                  {event.name || "Recital Principal"}
                </h2>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-zinc-300">
                  <span>📍</span>
                  <span>{event.venues?.name}, {event.venues?.city}</span>
                </div>
                
                {/* Lista de Artistas */}
                <div className="pt-4 border-t border-white/10">
                  {event.lineups?.map((lineup: any) => (
                    <span key={lineup.artists.id} className="inline-block bg-yellow-500/10 text-yellow-500 text-xs font-bold px-2 py-1 rounded mr-2">
                      {lineup.artists.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        {events?.length === 0 && (
          <p className="text-zinc-500">No hay recitales cargados todavía.</p>
        )}
      </div>
    </main>
  )
}