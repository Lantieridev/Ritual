import Link from 'next/link'
import { routes } from '@/src/core/lib/routes'
import { ReactNode } from 'react'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ritual-bg flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 shrink-0 bg-ritual-panel border-r border-ritual-border-subtle flex flex-col h-auto md:min-h-screen">
        <div className="p-6 border-b border-ritual-border-subtle">
          <p className="font-label text-[10px] tracking-[0.32em] text-ritual-red-hover uppercase">Control</p>
          <h2 className="font-display text-3xl uppercase text-ritual-bone mt-2">
            Sala de Máquinas
          </h2>
        </div>

        <nav className="flex-1 p-6 space-y-8">
          <div>
            <p className="font-label text-[10px] tracking-[0.14em] text-ritual-gray-text uppercase mb-4">
              Moderación
            </p>
            <ul className="space-y-3">
              <li>
                <Link
                  href={routes.admin.moderation.artists}
                  className="font-dense text-ritual-bone hover:text-ritual-red-hover uppercase transition-colors"
                >
                  Artistas
                </Link>
              </li>
              <li>
                <Link
                  href={routes.admin.moderation.venues}
                  className="font-dense text-ritual-bone hover:text-ritual-red-hover uppercase transition-colors"
                >
                  Sedes
                </Link>
              </li>
              <li>
                <Link
                  href={routes.admin.moderation.events}
                  className="font-dense text-ritual-bone hover:text-ritual-red-hover uppercase transition-colors"
                >
                  Eventos
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Futuros enlaces de admin */}
          <div>
            <p className="font-label text-[10px] tracking-[0.14em] text-ritual-gray-text uppercase mb-4">
              Sistema
            </p>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/admin/usuarios"
                  className="font-dense text-ritual-gray-light-2 hover:text-ritual-red-hover uppercase transition-colors cursor-not-allowed opacity-50"
                  title="Próximamente"
                >
                  Usuarios
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
