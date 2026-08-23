'use client'

import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { Button } from '@/src/core/components/ui'
import { memoryCardFileName } from '@/src/domains/showmode/memory-card'
import type { MemoryCardData } from '@/src/domains/showmode/memory-card'

interface MemoryCardProps {
  card: MemoryCardData
  /** Lo que falta cargar; vacío cuando el show está completo. */
  pendingLabels: string[]
}

function formatARS(amount: number): string {
  return `$${amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

/**
 * La "tarjeta recuerdo" del issue #9: un stub de entrada digital con los
 * datos esenciales del show, las comparaciones de gasto (issue #7) y el
 * clima (issue #8), descargable como imagen para guardarla fuera de la app.
 *
 * NO es una función social — el issue lo aclara explícitamente. No hay
 * compartir, ni publicar, ni link público: se descarga y listo.
 *
 * Cómo se descarga: `toPng` de html-to-image sobre el nodo de la tarjeta.
 * No es una dependencia nueva — ya estaba en el proyecto desde la
 * exportación de las placas de Wrapped, y se reusa el mismo patrón, incluido
 * el `filter` que saca del render cualquier nodo marcado con
 * `data-no-export` (los botones no van adentro de la imagen).
 *
 * El papel: se reusan los tokens `ritual-paper*`, los mismos que ya viste en
 * la reseña de la ficha del evento. Un stub tiene que sentirse impreso, no
 * ser otra caja oscura más.
 */
export function MemoryCard({ card, pendingLabels }: MemoryCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function handleDownload() {
    if (!cardRef.current || isExporting) return
    try {
      setIsExporting(true)
      setExportError(null)
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        // 2x para que el stub no salga borroso en pantallas densas ni al
        // abrirlo fuera de la app, que es todo el punto de descargarlo.
        pixelRatio: 2,
        filter: (node) => !(node instanceof HTMLElement && node.dataset.noExport === 'true'),
      })
      const link = document.createElement('a')
      link.download = memoryCardFileName(card)
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Error al exportar la tarjeta recuerdo:', err)
      setExportError('No se pudo descargar la imagen. Probá de nuevo.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4" data-testid="memory-card">
      {pendingLabels.length > 0 && (
        <p className="font-body text-sm text-ritual-gray-text">
          Todavía falta {pendingLabels.join(', ').toLowerCase()} — podés descargarla igual, pero el
          recuerdo queda incompleto.
        </p>
      )}

      <div
        ref={cardRef}
        className="bg-ritual-paper text-ritual-paper-ink border border-ritual-paper-2 overflow-hidden"
      >
        <div className="grid sm:grid-cols-[1fr_auto]">
          {/* Cuerpo de la entrada */}
          <div className="p-6 md:p-8">
            <div className="flex items-baseline justify-between gap-4 border-b border-ritual-paper-ink/20 pb-3">
              <p className="font-display text-lg uppercase tracking-[0.08em] text-ritual-paper-red">
                Ritual
              </p>
              <p className="font-label text-[9px] tracking-[0.2em] uppercase text-ritual-paper-ink/60">
                Admitido una vez
              </p>
            </div>

            <h3 className="font-display text-3xl md:text-5xl leading-[0.9] uppercase mt-5">
              {card.title}
            </h3>
            <p className="font-label text-[10px] tracking-[0.16em] uppercase mt-2 text-ritual-paper-ink/70">
              {card.dateLabel} · {card.venueLabel}
            </p>

            {card.lineup.length > 1 && (
              <p className="font-body text-sm mt-3 text-ritual-paper-ink/80">
                {card.lineup.join(' · ')}
              </p>
            )}

            {/* La cuenta de esa noche — issue #7 */}
            <div className="mt-6 border-t border-dashed border-ritual-paper-ink/30 pt-4">
              <p className="font-label text-[9px] tracking-[0.2em] uppercase text-ritual-paper-ink/60">
                Lo que salió
              </p>
              <p className="font-display text-4xl md:text-5xl leading-none mt-1">
                {formatARS(card.totalSpent)}
              </p>
              {(card.choripanLine || card.inflationLine) && (
                <p className="font-body text-sm italic mt-1.5 text-ritual-paper-ink/70">
                  {[card.choripanLine, card.inflationLine].filter(Boolean).join(' · ')}
                </p>
              )}
              {card.categories.length > 0 && (
                <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
                  {card.categories.map((line) => (
                    <li
                      key={line.category}
                      className="font-label text-[11px] tracking-[0.04em] flex justify-between gap-2 text-ritual-paper-ink/80"
                    >
                      <span>
                        {line.icon} {line.category}
                      </span>
                      <span>{formatARS(line.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {card.reviewExcerpt && (
              <p className="font-body italic text-base mt-5 border-l-[3px] border-ritual-paper-red pl-4">
                &ldquo;{card.reviewExcerpt}&rdquo;
              </p>
            )}
          </div>

          {/* El talón: perforado, con clima, puntaje y serial */}
          <div className="border-t sm:border-t-0 sm:border-l border-dashed border-ritual-paper-ink/40 p-6 md:p-8 flex sm:flex-col justify-between gap-6 sm:w-44 bg-ritual-paper-2/60">
            <div>
              <p className="font-label text-[9px] tracking-[0.2em] uppercase text-ritual-paper-ink/60">
                Clima
              </p>
              {card.weather ? (
                <>
                  <p className="text-3xl mt-1" aria-hidden="true">
                    {card.weather.emoji}
                  </p>
                  <p className="font-subtitle font-black text-2xl">{card.weather.temperatureC}°C</p>
                  <p className="font-label text-[10px] text-ritual-paper-ink/70">
                    {card.weather.description}
                  </p>
                </>
              ) : (
                <p className="font-label text-[10px] mt-1 text-ritual-paper-ink/60">Sin registro</p>
              )}
            </div>

            <div>
              <p className="font-label text-[9px] tracking-[0.2em] uppercase text-ritual-paper-ink/60">
                Puntaje
              </p>
              <p className="font-display text-3xl leading-none mt-1">
                {card.rating != null ? `${card.rating}/5` : '—'}
              </p>
            </div>

            <p className="font-label text-[9px] tracking-[0.14em] uppercase text-ritual-paper-ink/50 self-end sm:self-auto">
              {card.serial}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3" data-no-export="true">
        <Button type="button" variant="primary" className="px-5 py-2.5" onClick={handleDownload} disabled={isExporting}>
          {isExporting ? 'Generando...' : 'Descargar recuerdo'}
        </Button>
        <p className="font-body text-xs text-ritual-gray-text">
          Se guarda como imagen en tu dispositivo. No se publica en ningún lado.
        </p>
      </div>

      {exportError && (
        <p role="alert" className="font-body text-sm text-ritual-red-hover">
          {exportError}
        </p>
      )}
    </div>
  )
}
