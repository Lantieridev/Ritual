'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'

const CompleteOnboardingMutation = gql`
  mutation CompleteOnboarding {
    completeOnboarding {
      success
      error
    }
  }
`

const STEPS = [
  {
    kicker: '01 / 04',
    title: 'Bienvenido a Ritual',
    body: 'Tu archivo personal de recitales: cada show que fuiste, con fecha, sede y cómo te sentiste esa noche.',
  },
  {
    kicker: '02 / 04',
    title: 'Buscá o cargá a mano',
    body: 'Buscá el show en Ticketmaster, Setlist.fm y otras fuentes, o cargalo vos con los datos que tengas.',
  },
  {
    kicker: '03 / 04',
    title: 'Marcá tu asistencia',
    body: 'Me interesa, Voy a ir, o Fui — así la app sabe qué mostrar en tu Inicio y qué contar en tu archivo.',
  },
  {
    kicker: '04 / 04',
    title: 'Explorá tu historial',
    body: 'Colección agrupa artistas y sedes, Números arma tus estadísticas, Wrapped resume tu año. Todo se arma solo con lo que vayas cargando.',
  },
]

/**
 * Tour de bienvenida flotante en 4 pasos para usuarios nuevos.
 *
 * Se renderiza en posición fija sin overlay bloqueante para no interrumpir
 * la visión de la aplicación. Al finalizar o saltear, marca el onboarding
 * como completado vía GraphQL server-side.
 */
export function OnboardingTour() {
  const [isOpen, setIsOpen] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, completeOnboarding] = useMutation(CompleteOnboardingMutation)

  const primaryActionRef = useRef<HTMLButtonElement | null>(null)

  // El foco entra al primer elemento interactivo del panel cuando aparece
  useEffect(() => {
    primaryActionRef.current?.focus()
  }, [])

  const handleFinishOrSkip = useCallback(async () => {
    if (isPending) return

    // Si la mutation falló previamente, el aviso role="alert" fue mostrado.
    // Un nuevo intento de cerrar desmonta el panel para no bloquear al usuario.
    if (error) {
      setIsOpen(false)
      return
    }

    setIsPending(true)
    setError(null)

    const result = await completeOnboarding({})
    const { error: mutError } = unwrapMutation(result, 'completeOnboarding')

    if (mutError) {
      setError(mutError)
      setIsPending(false)
      return
    }

    setIsOpen(false)
  }, [isPending, error, completeOnboarding])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleFinishOrSkip()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleFinishOrSkip])

  if (!isOpen) return null

  const step = STEPS[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === STEPS.length - 1

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Tour de bienvenida"
      className="fixed bottom-6 right-6 z-50 w-[calc(100vw-3rem)] max-w-md border-l-[3px] border-ritual-red bg-ritual-panel p-6 shadow-2xl motion-safe:transition-all motion-safe:duration-300"
    >
      <p aria-hidden="true" className="font-label text-[10px] tracking-[0.16em] uppercase text-ritual-red-hover mb-2">
        {step.kicker}
      </p>

      <h2 className="font-display text-2xl uppercase text-ritual-bone mb-3">
        {step.title}
      </h2>

      <p className="font-body text-sm text-ritual-gray-text leading-relaxed mb-6">
        {step.body}
      </p>

      {error && (
        <p role="alert" className="font-label text-xs text-ritual-red-hover mb-4">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-4 border-t border-ritual-border">
        <div className="flex items-center gap-2">
          {!isFirstStep && (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              disabled={isPending}
              className="border border-ritual-border text-ritual-gray-text uppercase font-label text-[10px] tracking-[0.1em] px-3 py-2 hover:bg-ritual-surface hover:text-ritual-bone transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
          )}

          <button
            ref={primaryActionRef}
            type="button"
            onClick={isLastStep ? handleFinishOrSkip : () => setCurrentStep((prev) => prev + 1)}
            disabled={isPending}
            className="ritual-cta bg-ritual-red text-ritual-bone font-figure text-sm tracking-wider px-5 py-2 uppercase hover:bg-ritual-red-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLastStep ? 'Empezar' : 'Siguiente'}
          </button>
        </div>

        <button
          type="button"
          onClick={handleFinishOrSkip}
          disabled={isPending}
          className="border border-ritual-border text-ritual-gray-text uppercase font-label text-[10px] tracking-[0.1em] px-3 py-2 hover:bg-ritual-surface hover:text-ritual-bone transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Saltear
        </button>
      </div>
    </div>
  )
}
