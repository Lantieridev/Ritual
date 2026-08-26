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
  /** Unifica los catálogos de artistas/sedes/festivales en pestañas. */
  collection: '/coleccion',
  /** Ajustes del modo recital activo: ventana y plantilla del checklist — issue #9. */
  showMode: '/modo-recital',

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
    /** Vista de detalle de gastos de un recital puntual, con desglose por categoría — issue #7. */
    expenses: (id: string) => `/events/${id}/gastos` as const,
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

  // Admin & Moderation
  admin: {
    home: '/admin',
    moderation: {
      artists: '/admin/moderacion/artistas',
      venues: '/admin/moderacion/sedes',
      events: '/admin/moderacion/eventos',
    },
  },

  // Auth
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  profile: '/profile',
} as const
