import type { EventWeather as EventWeatherData } from '@/src/domains/weather/weather-service'

interface EventWeatherProps {
  weather: EventWeatherData | null
  /** Sede sin lat/lng cargado — mensaje distinto a "no se pudo calcular". */
  hasVenueCoords: boolean
  isPast: boolean
}

function weatherEmoji(code: number | null, isRain: boolean): string {
  if (isRain) return '🌧️'
  if (code === null) return '🌡️'
  if (code === 0) return '☀️'
  if (code <= 2) return '🌤️'
  if (code === 3) return '☁️'
  if (code === 45 || code === 48) return '🌫️'
  if (code >= 71 && code <= 86) return '❄️'
  if (code >= 95) return '⛈️'
  return '🌡️'
}

/**
 * Clima real del show — ubicación exacta de la sede, hora exacta del
 * evento (issue #8). Se degrada en silencio (no renderiza nada más que un
 * mensaje corto) cuando la sede no tiene coordenadas cargadas o Open-Meteo
 * no devolvió datos — nunca debe romper la ficha del evento.
 */
export function EventWeather({ weather, hasVenueCoords, isPast }: EventWeatherProps) {
  if (!hasVenueCoords) {
    return (
      <section className="border-t border-ritual-border-subtle pt-8">
        <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-3">Clima</h2>
        <p className="font-body text-sm text-ritual-gray-text">
          Esta sede todavía no tiene coordenadas cargadas — no se puede calcular el clima exacto.
        </p>
      </section>
    )
  }

  if (!weather) {
    return (
      <section className="border-t border-ritual-border-subtle pt-8">
        <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-3">Clima</h2>
        <p className="font-body text-sm text-ritual-gray-text">
          {isPast
            ? 'No se pudo obtener el clima histórico de esta fecha.'
            : 'Todavía no hay pronóstico disponible para esta fecha (Open-Meteo solo cubre los próximos 16 días).'}
        </p>
      </section>
    )
  }

  return (
    <section className="border-t border-ritual-border-subtle pt-8">
      <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-3">
        Clima {isPast ? 'del show' : '(pronóstico)'}
      </h2>
      <div className="flex items-center gap-4 bg-ritual-surface border border-ritual-border px-5 py-4">
        <span className="text-4xl" aria-hidden="true">
          {weatherEmoji(weather.weatherCode, weather.isRain)}
        </span>
        <div>
          <p className="font-subtitle font-black text-2xl uppercase text-ritual-bone">
            {Math.round(weather.temperatureC)}°C
          </p>
          <p className="font-body text-sm text-ritual-gray-text">
            {weather.description} · {weather.hourLabel}hs
          </p>
        </div>
      </div>
    </section>
  )
}
