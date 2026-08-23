import type { PendingItem } from '@/src/domains/showmode/pending'

interface PendingShowPromptProps {
  pending: PendingItem[]
}

/**
 * El "recordatorio post-show" del issue #9, resuelto in-app.
 *
 * El issue pide un solo aviso que junte todo lo pendiente del show (gastos +
 * rating + reseña) en vez de notificaciones sueltas, pero ese aviso depende
 * del sistema de notificaciones del issue #6, que está frenado esperando una
 * decisión de tooling. Así que este PR construye la mitad que no depende de
 * esa decisión: el cálculo de pendientes (ver ../pending.ts) y este prompt,
 * que lo muestra en la propia ficha del evento durante la ventana posterior.
 *
 * Cuando el issue #6 se destrabe, el job que mande el mail o el push puede
 * reusar `computePendingForShow` sin tocar nada de acá. No hay
 * infraestructura de mail ni de push en este PR.
 */
export function PendingShowPrompt({ pending }: PendingShowPromptProps) {
  if (pending.length === 0) return null

  return (
    <div
      data-testid="pending-show-prompt"
      className="border border-ritual-border bg-ritual-surface px-5 py-4"
    >
      <p className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text">
        Quedó pendiente de esta noche
      </p>
      <ul className="mt-3 space-y-1.5">
        {pending.map((item) => (
          <li key={item.kind} className="font-body text-sm text-ritual-bone flex items-baseline gap-2">
            <span aria-hidden="true" className="text-ritual-red-hover">
              ▸
            </span>
            {item.label}
          </li>
        ))}
      </ul>
      <p className="font-body text-xs text-ritual-gray-text mt-3">
        Un solo aviso con todo junto, no notificaciones sueltas. Por ahora vive acá adentro: el aviso
        por mail o push depende del sistema de notificaciones (
        <a
          href="https://github.com/Lantieridev/Ritual/issues/6"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ritual-red-hover underline underline-offset-4"
        >
          issue #6
        </a>
        ), todavía sin implementar.
      </p>
    </div>
  )
}
