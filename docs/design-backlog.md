# Backlog de diseño — RITUAL

Inventario de **qué** falta diseñar, para que Claude Design (o cualquier agente de
UI) sepa dónde entrar sin tener que relevar el repo de cero.

Este documento no propone estética ni decide criterios visuales: lista rutas,
estado real y restricciones técnicas que el diseño no puede romper. Las
decisiones de diseño son de quien diseñe.

Relevado el 2026-08-25 contra la rama `main` con el working tree sin commitear.

---

## 1. Sistema de diseño ya existente

Antes de inventar vocabulario nuevo, conviene saber que ya hay uno. Está en
`app/globals.css`.

### Color

Paleta oscura, brutalista. Se usan como clases de Tailwind v4 (`bg-ritual-panel`,
`text-ritual-bone`, `border-ritual-border-subtle`).

| Grupo | Tokens |
|---|---|
| Fondos | `ritual-bg` `#08080A`, `ritual-panel` `#0B0B0C`, `ritual-panel-2` `#0C0C0F` |
| Superficies | `ritual-surface` `#101013`, `ritual-surface-2`, `ritual-surface-high` `#17171A`, `ritual-surface-high-2` |
| Bordes | `ritual-border-subtle` `#15151A`, `ritual-border-subtle-2`, `ritual-border` `#1E1E22`, `ritual-border-2`, `ritual-border-3` |
| Grises | `ritual-gray-muted`, `-muted-2`, `-mid`, `-mid-2`, `ritual-gray-text` `#8A8A90`, `-text-2`, `ritual-gray-light`, `-light-2`, `-light-3` |
| Texto principal | `ritual-bone` `#EDEBE6` |
| Acento | `ritual-red` `#D6202A`, `ritual-red-hover` `#F0464F`, `ritual-red-dark`, `ritual-red-dark-2` |
| Papel (superficies claras) | `ritual-paper` `#EDE9DF`, `ritual-paper-2`, `ritual-paper-ink` `#141210`, `ritual-paper-red` |

### Tipografía

Ocho roles cargados por `next/font/google` en `app/layout.tsx`:

| Clase | Familia | Uso observado |
|---|---|---|
| `font-display` | Anton | Títulos grandes en mayúscula |
| `font-badge` | Archivo Black | Badges, énfasis pesado |
| `font-dense` | Archivo | Nombres de entidad, filas de tabla |
| `font-subtitle` | Big Shoulders | Subtítulos |
| `font-figure` | Bebas Neue | Cifras y números destacados |
| `font-label` | Space Mono | Etiquetas en mayúscula con tracking amplio, texto de 10px |
| `font-body` / `font-sans` | Space Grotesk | Cuerpo, texto corrido |

### Componentes reutilizables ya construidos

En `src/core/components/ui/`: `Button`, `LinkButton`, `Card`, `Combobox`
(buscar-y-elegir con creación inline, accesible por teclado), `ConfirmDeleteButton`,
`EmptyState`, `FormField`, `Input`, `Textarea`, `Skeleton`, `StarRating`, `Tabs`,
`TicketEmbed`.

En `src/core/components/layout/`: `Navbar`, `Footer`, `PageShell` (envoltorio de
página con back link, título y descripción), `ProfileDropdown`.

Conviene reusar estos antes de crear variantes nuevas.

---

## 2. Prioridad 1 — Panel de admin y moderación

**Todo el panel está sin diseñar.** Existe como esqueleto funcional: usa los
tokens correctos pero no pasó por ninguna pasada de diseño.

| Ruta | Archivo | Estado |
|---|---|---|
| `/admin` | `app/admin/page.tsx` | Redirect a la cola de artistas. No requiere diseño. |
| (layout) | `app/admin/layout.tsx` | Sidebar con navegación. Único responsive: colapsa a columna en `md`. Falta el enlace "Usuarios" (marcado como próximamente, deshabilitado). |
| `/admin/moderacion/artistas` | `app/admin/moderacion/artistas/page.tsx` | Tabla funcional con acciones cableadas. |
| `/admin/moderacion/sedes` | `app/admin/moderacion/sedes/page.tsx` | Tabla maquetada, **botones sin `onClick`**. |
| `/admin/moderacion/eventos` | `app/admin/moderacion/eventos/page.tsx` | Tabla maquetada, **botones sin `onClick`**. |

El contrato funcional detallado de estas tres pantallas (queries, mutations,
comportamiento esperado de aprobar y fusionar) está en
`sdd/ritual-roles-moderation-phase-2/04-ui-claude-design-handoff.md`. Leerlo antes
de diseñar: define el modelo de post-moderación y por qué la elección de la
entidad canónica va por buscador y no por pegado de UUID.

Las tres tablas usan `<table>` con anchos en fracciones. En viewport angosto no
hay estrategia definida: es el punto a resolver.

Pantallas del panel que el sidebar promete y todavía no existen:
- `/admin/usuarios` — gestión de roles. El backend ya tiene el RPC `assign_user_role`.
- No hay pantalla de métricas, aunque el `01-spec.md` la menciona como parte del rol Admin.

---

## 3. Prioridad 2 — Mobile en todo el sitio

Medida usada: cantidad de prefijos responsive (`sm:` `md:` `lg:` `xl:` `2xl:`) por
archivo. **Es una señal, no una prueba**: una pantalla de una sola columna puede
funcionar bien en mobile sin un solo breakpoint. Sirve para saber dónde mirar
primero, no para concluir que está rota.

### Navegación

Resuelta para mobile (2026-09). Por debajo de `md` el `Navbar` se oculta y la
navegación pasa a ser el talón fijo de abajo
(`src/core/components/layout/MobileTabBar.tsx`: cuatro palabras, Hoy · Buscar ·
Archivo · Vos), portado del handoff mobile de Claude Design. Una página puede fijar
su acción principal sobre el talón con `<MobileHeroAction>`
(`src/core/components/layout/MobileAction.tsx`), y el aire inferior de la página
sale del token `--ritual-mobile-clearance`, que crece con esa pila.

Los estados mobile de Hoy (primera vez, sólo pasado, la mañana después, sin
sesión, show hoy y cuenta regresiva) ya están portados — issue #82 cerrado: hero
mobile propio (badge de hora, "Lo último que viste", degradación honesta de
dirección y clima) más la banda de "Tu entrada de hoy" sobre Buscar/Colección/Vos,
con su propio aire de clearance (`html[data-mobile-banda]`). Introdujo tres pares
de contraste nuevos/extendidos por debajo de AA — ver §7 (issue #78). Queda la
tira de sugeridos con el ranking unificado (#81).

`Footer` tiene 2 breakpoints. `ProfileDropdown`, 1.

### Rutas con contenido real y cero breakpoints

Las candidatas más fuertes a revisar, ordenadas por tamaño:

| Ruta | Líneas |
|---|---|
| `/buscar` | 276 |
| `/festivals/nuevo` | 170 |
| `/wishlist` | 168 |
| `/events/[id]/gastos` | 160 |
| `/expenses` | 145 |
| `/expenses/[id]` | 84 (1 breakpoint) |
| `/events/[id]/editar` | 68 |
| `/events/nuevo` | 56 |
| `/reset-password` | 45 |
| `/modo-recital` | 44 |
| `/expenses/[id]/editar` | 41 |
| `/profile/edit` | 35 |
| `/expenses/nuevo` | 30 |
| `/artists/nuevo` | 26 |
| `/venues/nuevo` | 26 |
| `/login`, `/signup`, `/forgot-password` | 25 c/u |

### Componentes con contenido pesado y cero breakpoints

Acá vive buena parte de la UI real, porque muchas páginas son envoltorios finos:

| Componente | Líneas |
|---|---|
| `domains/events/components/EventForm.tsx` | 385 |
| `domains/showmode/components/PreShowChecklist.tsx` | 229 |
| `domains/expenses/components/EventExpensesPanel.tsx` | 219 |
| `domains/stats/components/WrappedStories.tsx` | 150 |
| `domains/expenses/components/ExpenseQuickAdd.tsx` | 145 |
| `domains/expenses/components/ExpenseForm.tsx` | 131 |
| `domains/festivals/components/FestivalAttendanceButton.tsx` | 117 |
| `domains/events/components/RatingAndReviewForm.tsx` | 111 |
| `domains/events/components/SearchEventsForm.tsx` | 109 |
| `domains/expenses/components/ExpenseInlineEdit.tsx` | 102 |
| `domains/auth/components/*Form.tsx` | 79–91 c/u |
| `domains/events/components/AttendanceStatusButtons.tsx` | 91 |
| `domains/venues/components/VenueForm.tsx` | 88 |
| `domains/artists/components/ArtistForm.tsx` | 80 |

`EventForm` es el más grande del proyecto y concentra datos del show, lineup,
puntaje, reseña y gasto en un solo submit. Es el caso mobile más difícil.

### Lo que ya tiene tratamiento responsive

Para no tocar de más: `MemoryCard` (10 breakpoints), `/profile` (9), `/events/[id]`
(7), `/coleccion` (5), `/festivals/[id]` (5), `ArtistProfile` (5), `HomeHero` (4),
`/artists/[id]` (4), `Hero` (3), `ProfileForm` (3), la home (3).

---

## 4. Rutas que no hay que diseñar

Son redirects de compatibilidad tras fusiones de rutas ya hechas. Existen sólo
para no romper links viejos:

| Ruta | Redirige a |
|---|---|
| `/artists` | `/coleccion?tab=artistas` |
| `/venues` | `/coleccion?tab=sedes` |
| `/festivals` | `/coleccion?tab=festivales` |
| `/search` | `/buscar?tab=archivo` |
| `/admin` | `/admin/moderacion/artistas` |

---

## 5. Restricciones que el diseño no puede romper

1. **Degradación elegante.** Fijada en `docs/adr/0003-optional-external-api-keys-graceful-degradation.md`.
   Las cuatro APIs externas (Last.fm, Setlist.fm, Spotify, Ticketmaster) son
   opcionales. `fetchWithTimeout` (`src/core/lib/http.ts`) aborta a los 8 segundos
   y los clientes devuelven `{ artist: null, error }` en vez de tirar. Toda
   pantalla que muestre datos enriquecidos de terceros necesita un estado para
   cuando esos datos no llegan, y la información propia de Supabase tiene que
   seguir visible y operable. Nada de loaders infinitos.

2. **Server Components por defecto.** Sólo se marca `'use client'` cuando hace
   falta interactividad, hooks o APIs del browser. Las páginas leen datos en el
   servidor; los formularios y acciones son islas cliente.

3. **Post-moderación.** Lo que crea un usuario se publica al instante con
   `status = 'unverified'`. El diseño de las vistas públicas tiene que contemplar
   que puede haber contenido sin verificar a la vista — es intencional, no un bug.

4. **`framer-motion` no está instalado.** El handoff de moderación lo pide para las
   animaciones de la cola. Es la única dependencia nueva prevista para esa fase y
   todavía no se agregó.

5. **Sin librerías de íconos.** La convención actual es usar caracteres (`✓`, `→`)
   o trazos minimalistas.

---

## 6. Pendientes conocidos que no son de diseño

Anotados acá para que no se confundan con huecos visuales:

- **El panel de admin no se puede abrir hoy, con ninguna cuenta.** La base
  desplegada no tiene la columna `profiles.role` ni la función `get_user_role()`,
  así que el rol resuelve a `usuario` para todo el mundo y el guard de GraphQL
  rechaza a todos. Diseñar sobre estas pantallas requiere trabajar contra los
  archivos, no contra la app corriendo, hasta que se sincronice la base. Detalle
  completo en `docs/auditoria-2026-08-25.md`.
- `/admin` no tiene guard de rol todavía, y no figura en `protectedPaths` de
  `src/core/lib/supabase/middleware.ts`.
- Las tres páginas de moderación hacen `throw new Error(...)` si falla el query,
  en vez de degradar como hace el resto del repo.
- `src/graphql/builder.ts` tiene un error de tipos con `relayOptions` de Pothos v4.

---

## 7. Deuda de diseño abierta (mobile)

Encontrada en el QA de los estados de Hoy (2026-09-12). Son decisiones del
prototipo aprobado, así que se resuelven en Claude Design, no en código:

- **Contraste por debajo de WCAG AA** (#78). Siete pares texto/fondo del prototipo:
  - badge rojo con texto `panel` a 9px (3,84:1);
  - puntaje apagado `gray-muted-2` sobre `surface-high` (2,03:1);
  - etiquetas `gray-mid-2` a 9px sobre el fondo (3,72:1) — el kicker "Lo último
    que viste" (`HHT-06`) y la meta de cada show reciente (`HHT-08`) del hero
    mobile de Hoy comparten este mismo par;
  - notas `gray-mid` (3,11:1);
  - subtítulo de la banda (3,53:1);
  - acción de la banda a 16px (3,84:1);
  - tag de clima del hero mobile de Hoy, rojo sobre panel a 9px (3,84:1) —
    nuevo, `HHT-04`.

  `src/core/design-tokens.contrast.test.ts` los mantiene como `it.fails`
  (`DESIGN_DEBT_PAIR_IDS` incluye `HHT-04`, `HHT-06` y `HHT-08` contra este
  issue), así que el día que el diseño los suba el test avisa que hay que
  pasarlos a normales.
- **Escala del puntaje** (#79). El prototipo dibuja 1–10; el rating de la app es 1–5
  (`validateRating`). La UI usa cinco botones hasta que se decida.
- **Copy que afirma datos que no existen.** "Lo más fuerte de esta semana", "queda
  cargado con la fecha y la sede", los compañeros ("con Tomás y Juli"). Se
  reescribieron en versión honesta hasta que haya datos que los respalden.
