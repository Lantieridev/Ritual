// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EventWeather } from './EventWeather'
import type { EventWeather as EventWeatherData } from '@/src/domains/weather/weather-service'

const weather: EventWeatherData = {
  temperatureC: 14.6,
  precipitationMm: 0,
  weatherCode: 1,
  isRain: false,
  description: 'Mayormente despejado',
  hourLabel: '20:00',
}

describe('EventWeather', () => {
  it('shows a message instead of weather data when the venue has no coordinates', () => {
    render(<EventWeather weather={null} hasVenueCoords={false} isPast />)

    expect(screen.getByText(/no tiene coordenadas cargadas/)).toBeInTheDocument()
    expect(screen.queryByText('14°C')).not.toBeInTheDocument()
  })

  it('shows a past-tense fallback when the venue has coordinates but Open-Meteo returned nothing', () => {
    render(<EventWeather weather={null} hasVenueCoords isPast />)

    expect(screen.getByText(/No se pudo obtener el clima histórico/)).toBeInTheDocument()
  })

  it('shows a forecast-horizon fallback for a future show beyond 16 days', () => {
    render(<EventWeather weather={null} hasVenueCoords isPast={false} />)

    expect(screen.getByText(/Todavía no hay pronóstico disponible/)).toBeInTheDocument()
  })

  it('renders the temperature, description and hour for a past show', () => {
    render(<EventWeather weather={weather} hasVenueCoords isPast />)

    expect(screen.getByText('15°C')).toBeInTheDocument()
    expect(screen.getByText(/Mayormente despejado/)).toBeInTheDocument()
    expect(screen.getByText(/20:00hs/)).toBeInTheDocument()
    expect(screen.getByText('Clima del show')).toBeInTheDocument()
  })

  it('labels it as a forecast for a future show', () => {
    render(<EventWeather weather={weather} hasVenueCoords isPast={false} />)

    expect(screen.getByText('Clima (pronóstico)')).toBeInTheDocument()
  })

  it('rounds the temperature to the nearest whole degree', () => {
    render(<EventWeather weather={{ ...weather, temperatureC: 14.2 }} hasVenueCoords isPast />)
    expect(screen.getByText('14°C')).toBeInTheDocument()
  })
})
