# Estructura del proyecto RITUAL

Objetivo: **dominios claros**, **core compartido** y **app delgada** (solo rutas y composición). Así escalamos a gastos, perfil y red sin desorden.

---

## Estructura actual (implementada)

```
src/
  core/                    # Lo que usa toda la app
    lib/
      supabase.ts
      routes.ts
    types/
      index.ts              # Tipos de dominio (Artist, Venue, Event, Expense…)
    components/             # Componentes compartidos
      ui/                   # Primitivos: Button, Card, FormField, LinkButton
      layout/               # PageShell

  domains/                  # Un folder por dominio (datos + acciones + componentes)
    events/
      data.ts               # getEvents, getEventById
      actions.ts            # createEvent, updateEvent, deleteEvent
      components/           # EventCard, EventCardList, EventForm, DeleteEventButton
    venues/
      data.ts
      actions.ts
      components/
    artists/
      data.ts
      actions.ts
      components/
    expenses/               # Gastos personales (no compartidos)
      data.ts
      actions.ts
      components/

app/                        # Solo rutas y páginas (importan de src/core y src/domains)
  page.tsx
  layout.tsx
  loading.tsx               # Loading global
  error.tsx                 # Error boundary global
  not-found.tsx             # 404 global
  events/
    [id]/
      loading.tsx, error.tsx, not-found.tsx
      editar/
    nuevo/
  venues/
  artists/
  expenses/
    loading.tsx
    [id]/
      loading.tsx, error.tsx, not-found.tsx
      editar/
```

### Diseño (Tailwind)

- Paleta **minimalista**: blanco, negro y grises (zinc). Sin amarillos ni colores fuertes.
- Botones: primary = fondo blanco, secondary = borde gris. Cards y enlaces con hover sutil (border-white/20).
- Errores y destructivos siguen en rojo. Estados vacíos y avisos en zinc.

### Ventajas

- **Dominios**: Todo lo de “eventos” está en `domains/events/`. Al agregar gastos, todo va en `domains/expenses/`.
- **Core**: Tipos, Supabase, rutas y componentes UI/layout en un solo lugar. No se mezclan con lógica de un dominio.
- **Imports**: Desde cualquier página: `@/src/domains/events/data`, `@/src/core/components/ui`, `@/src/core/types`.
- **Escalabilidad**: Perfil, red social o más dominios = nueva carpeta en `domains/` y rutas en `app/`.

### Imports

- Páginas en `app/`: importan de `@/src/core/*` y `@/src/domains/*`.
- Dentro de un dominio: `data.ts` y `actions.ts` importan de `@/src/core/lib/supabase` y `@/src/core/types`.
- Componentes de dominio: importan de `@/src/core/components/ui` y `@/src/core/lib/routes`.

---

## Gastos (expenses)

- **Tabla**: `expenses` con `user_id` (dueño del gasto). Solo ese usuario ve/edita/borra (RLS).
- **Información personal**: No se comparte con otros usuarios; cuando haya red social, los gastos siguen privados.
- **Campos iniciales**: user_id, amount, category (entrada, viaje, hospedaje, etc.), note, event_id (opcional, para asociar a un recital), date.
- **Rutas**: `/expenses` (listado), `/expenses/nuevo` (formulario). Más adelante: editar y eliminar.

Cuando agreguemos auth, `user_id` será `auth.uid()`. Hasta entonces: en desarrollo podés setear **`RITUAL_DEV_USER_ID`** en `.env.local` con un user id de Supabase Auth (creá un usuario en el dashboard o por signup) para poder cargar y ver gastos. Sin ese env o sin sesión, la app muestra mensaje y lista vacía.

---

## UX y metadata

- **Loading**: `app/loading.tsx` (global) y `loading.tsx` en segmentos clave (detalle evento, listado y detalle de gastos) para evitar pantalla en blanco.
- **Error**: `app/error.tsx` (global) y `error.tsx` en `events/[id]` y `expenses/[id]` con mensaje + Reintentar / Volver.
- **404**: `app/not-found.tsx` (rutas inexistentes); `not-found.tsx` en `events/[id]` y `expenses/[id]` cuando el recurso no existe.
- **Metadata**: Todas las páginas tienen título (y donde aplica descripción) vía `metadata` o `generateMetadata` para SEO y pestaña del navegador (siempre con sufijo `| RITUAL`).
- **Estados vacíos**: En home, artistas, sedes y gastos, cuando la lista está vacía se muestra mensaje + CTA (ej. "Agregar primer recital", "+ Nuevo artista").
