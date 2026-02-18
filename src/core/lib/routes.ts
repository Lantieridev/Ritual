/**
 * Rutas de la app en un solo lugar.
 * Facilita cambiar prefijos (ej. /app/events) o añadir i18n más adelante.
 * Cuando exista perfil de usuario: routes.profile(), routes.myEvents(), etc.
 */

export const routes = {
  home: '/',
  stats: '/stats',
  wishlist: '/wishlist',
  search: '/search',
  wrapped: '/wrapped',

  artists: {
    list: '/artists',
    new: '/artists/nuevo',
    detail: (id: string) => `/artists/${id}` as const,
  },

  venues: {
    list: '/venues',
    new: '/venues/nuevo',
    detail: (id: string) => `/venues/${id}` as const,
  },

  events: {
    list: '/',
    new: '/events/nuevo',
    search: '/buscar',
    detail: (id: string) => `/events/${id}` as const,
    edit: (id: string) => `/events/${id}/editar` as const,
  },

  expenses: {
    list: '/expenses',
    new: '/expenses/nuevo',
    detail: (id: string) => `/expenses/${id}` as const,
    edit: (id: string) => `/expenses/${id}/editar` as const,
  },

  festivals: {
    list: '/festivals',
    new: '/festivals/nuevo',
    detail: (id: string) => `/festivals/${id}` as const,
  },

  // Auth
  login: '/login',
  signup: '/signup',
  profile: '/profile',
} as const
