import { describe, it, expect } from 'vitest'
import { routes } from '@/src/core/lib/routes'

describe('routes', () => {
  it('interpolates ids into detail/edit routes for every resource', () => {
    expect(routes.artists.detail('a1')).toBe('/artists/a1')
    expect(routes.venues.detail('v1')).toBe('/venues/v1')
    expect(routes.events.detail('e1')).toBe('/events/e1')
    expect(routes.events.edit('e1')).toBe('/events/e1/editar')
    expect(routes.events.expenses('e1')).toBe('/events/e1/gastos')
    expect(routes.expenses.detail('x1')).toBe('/expenses/x1')
    expect(routes.expenses.edit('x1')).toBe('/expenses/x1/editar')
    expect(routes.festivals.detail('f1')).toBe('/festivals/f1')
  })

  it('exposes the expected static routes', () => {
    expect(routes.home).toBe('/')
    expect(routes.login).toBe('/login')
    expect(routes.signup).toBe('/signup')
    expect(routes.profile).toBe('/profile')
  })
})
