/**
 * Emoji para un código WMO de Open-Meteo.
 *
 * Vive en su propio módulo (y no dentro de EventWeather.tsx, donde nació, ni
 * dentro de weather-service.ts) porque lo necesitan dos consumidores con
 * requisitos incompatibles: el componente de servidor de la ficha del evento
 * y la tarjeta recuerdo, que es un componente de cliente. weather-service.ts
 * declara 'server-only', así que un cliente no puede importar nada de ahí en
 * runtime — este archivo es puro y no toca la red.
 */

/**
 * La lluvia gana sobre el código: el servicio decide "llovió" por
 * precipitación horaria > 0mm y no por el weather_code (ver la cabecera de
 * weather-service.ts), así que el ícono respeta esa misma señal.
 */
export function weatherEmoji(code: number | null, isRain: boolean): string {
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
