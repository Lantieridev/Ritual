# Auditoría — 2026-08-25

Cuatro revisiones en paralelo (seguridad, carga de base, scrapers, estructura y
flujo) sobre la rama `main` con el working tree sin commitear, más verificación
directa contra la base desplegada `ritual-db`.

Cada hallazgo indica cómo se estableció:

- **[verificado]** — comprobado contra el código o contra la base, en esta sesión.
- **[reportado]** — hallazgo de un agente, no re-verificado de forma independiente.
- **[requiere medición]** — depende de datos o de red que no había disponibles.

## Estado de corrección

Arreglado y verificado contra un `supabase db reset` limpio, con `npm test`
(1021), `tsc --noEmit` y `npm run lint` los tres en verde:

- P1.1 — los merge apuntaban a `event_artists`/`user_wishlist`, que no existen.
  Renombrado a `lineups`/`wishlist`.
- P1.2 — colisión de `events.status`. La columna vieja (`text default
  'scheduled'`, sin lectores en el código) se dropea antes de crear el enum.
- P2.1 — el cron fallaba abierto. Ahora falla cerrado y compara en tiempo
  constante.
- P2.2 — borrado del catálogo restringido a moderadores, en RLS y en el
  service. `removeEvent` además verifica que el DELETE haya afectado una fila.
- P2.3 — `search_catalog` del MCP escapa comodines de LIKE.
- P3.1 — cron agendado en `vercel.json`.
- P3.2 — CI en verde: lint y `tsc` pasan.
- P3.3 — fechas de fuentes externas parseadas con `parseExternalDateTime`.
- P4.1 — el `approve_entity` del MCP pasa por el RPC y deja de mentir.
- Orden de `pg_trgm`: el índice trigram de `external_events_cache` se creaba
  antes de habilitar la extensión y cortaba toda la cadena de migraciones desde
  cero. **El CLI de Supabase devolvía exit 0 igual**, así que ni el CI lo veía.
- GRANTs de tabla, que ninguna migración otorgaba
  (`20260826000000_table_grants.sql`).

P5 (carga sobre la base) cerrado:

- N+1 en `Artist.events` y `Venue.events`, con DataLoader. Medido: una query
  GraphQL sobre 3 artistas ejecuta 1 sentencia.
- Cuatro índices faltantes (rate limit, colas de moderación, `attendance` por
  evento, `expires_at` del cache), verificados con EXPLAIN.
- `getCurrentUserId` memoizado por request con `cache()` de React.
- Sitemap con lectura dedicada de `id, date`: 1 sentencia sin joins.
- `getPersonalStats` invertida: parte de `attendance` del usuario en vez de
  barrer la tabla `events` entera.
- Home y `/wrapped` dejan de leer el catálogo completo. Un render anónimo del
  home pasa a ejecutar cero queries contra el catálogo.
- Las ~46 policies con `auth.uid()` sin envolver quedan en 17, todas con
  `(select auth.uid())`.

Encontrado al hacer P5, no estaba en el informe original: `event_photos` tenía
un `with check (true)` conviviendo con la policy de dueño. Como las permisivas
se combinan con OR, cualquier autenticado podía insertar una foto atribuida a
otro usuario. Corregido y verificado con dos cuentas reales (403 al intentar
suplantar, 201 al subir la propia).

Sigue pendiente P6 (estructura) y los ítems de UI pausados a propósito.

---

## P0 — El entorno local no arranca contra ninguna base

**[verificado]** leyendo `.env.local` mediante un script que reporta sólo forma
y longitud, sin exponer valores.

- `NEXT_PUBLIC_SUPABASE_URL` = `http://localhost:54321` — el stack de Supabase
  **local**, no el proyecto remoto. Existe una config `supabase-local` en
  `.claude/launch.json` que lo respalda.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` mide 153 caracteres, de los cuales 145 son
  no-Latin1: 8 caracteres reales seguidos de 145 `•` (U+2022, desde el índice 8).
  Es la key copiada del dashboard con el enmascarado puesto.

Consecuencia: `fetch` no puede construir el header y tira
`TypeError: Cannot convert argument to a ByteString`. Toda lectura falla, la
degradación las convierte en listas vacías, y la home muestra su estado vacío
("Todavía no hay ningún talón") como si simplemente no hubiera datos.

`validateEnv()` no lo detecta porque sólo verifica que las variables estén
presentes, no que sean válidas.

### Corrección

Reponer la anon key real. Si el desarrollo va contra Supabase local, es el JWT
fijo que imprime `supabase start`.

---

## P0.1 — El proyecto remoto está muy por detrás del repo

**[verificado]** contra el proyecto Supabase del entorno remoto, consultando su
esquema en vivo. El identificador del proyecto se omite a propósito: este repo
es público.

Salvedad importante: `.env.local` apunta a Supabase local, así que **este
proyecto remoto no es el que usa el entorno de desarrollo**. No hay
configuración de despliegue en el repo que confirme si es el de producción o un
remoto abandonado. Determinarlo es el primer paso; el resto de esta sección
describe su estado tal cual está hoy.

### Qué falta

| Objeto ausente | Migración que lo crea |
|---|---|
| `profiles.role`, tipo `user_role`, `get_user_role()`, `assign_user_role()` | `20260823202400_user_roles` |
| `artists.status`, `venues.status`, `created_by`, tipo `verification_status` | `20260824202000_moderation_queue` |
| `merge_artists()`, `merge_venues()`, `merge_events()`, `check_creation_rate_limit()` | `20260824202000_moderation_queue` |
| `approve_entity()`, `is_moderator()`, triggers de guarda de status | `20260825060000_moderation_approve_and_status_guard` |
| `external_events_cache` | `20260824000000_external_events_cache` |
| `get_expenses_summary()`, `get_venue_artist_spend_estimate()` | `20260824205600_expenses_aggregations` |
| `event_checklist_items`, `event_checklist_checks`, `checklist_template_items` | `20260823100000_show_mode` |

`events.status` sigue siendo `text default 'scheduled'` — la columna original,
no el enum de verificación. Las 16 tablas tienen 0 filas. Siguen existiendo
`tours`, `festival_editions` y `memories`, que migraciones posteriores debían
eliminar o plegar.

El historial de migraciones registra 7 entradas, pero `wishlist` existe y la crea
la octava. Se aplicaron cambios a mano desde el SQL Editor, así que el historial
no sirve como referencia: el esquema real es la única fuente de verdad.

### Qué rompe hoy

- `createGraphQLContext` llama a `get_user_role`, que no existe. El catch degrada
  a `'usuario'`, así que `requireModerator` rechaza a todos — **el panel de
  moderación no lo puede abrir nadie, ni el Owner**.
- `getExpensesSummary()` y `getVenueArtistSpendEstimate()` llaman a RPCs
  inexistentes y devuelven su fallback vacío. El resumen de gastos muestra ceros
  sin avisar.
- La cola de moderación consulta `.eq('status','unverified')` sobre columnas que
  no existen en `artists` ni `venues`.

La degradación elegante del proyecto es lo que evita que esto explote: falla en
silencio en lugar de gritar.

### Acción

1. Determinar si la base se sincroniza (`supabase db push`) o si hay divergencia
   que resolver primero con `supabase db pull`. Dado que hay 0 filas, un reset
   limpio es viable y probablemente lo más simple.
2. **Antes de sincronizar**, corregir P1.1 y P1.2 — están dentro de las
   migraciones no aplicadas, así que se arreglan sin necesidad de una migración
   correctiva encima.

---

## P0.2 — Dos bugs encontrados al levantar el entorno local, uno arreglado

**[verificado]** de punta a punta: levanté Supabase local (`supabase start`),
sembré datos de prueba y navegué la home logueado.

### Arreglado — el talón 3D no podía renderizar dentro de la app

`next.config.ts` aplicaba `X-Frame-Options: DENY` y `frame-ancestors 'none'` a
`source: '/(.*)'`, sin excepción para `/tickets/`. `TicketEmbed.tsx` monta el
talón como iframe same-origin, y `DENY` bloquea el framing incluso desde el
propio origen — sólo `SAMEORIGIN` lo permite. Resultado: la request al HTML del
talón respondía `200 OK` pero el navegador la descartaba con
`net::ERR_BLOCKED_BY_RESPONSE`, sin ningún error en consola. El talón se veía
negro dentro de la home; la misma URL abierta directo funcionaba perfecto, lo
que hacía parecer un problema de three.js cuando era un header.

Cronología: los headers son del 18 de febrero (`b140686`); el talón se
empaquetó como iframe reusable el 31 de julio (`f5b292f`). El fix de esa fecha
resolvió un bloqueo distinto (CSP del `script-src` contra unpkg) y
probablemente se verificó abriendo el HTML suelto, no montado en la app — así
nunca se notó el framing roto.

Arreglado en `next.config.ts`: una regla para `/tickets/:path*` que afloja
`X-Frame-Options` a `SAMEORIGIN` y `frame-ancestors` a `'self'`, después de la
regla global para que la pise. El resto del sitio conserva `DENY`. Pendiente de
commitear.

### Sin arreglar en el repo — faltan GRANT a nivel tabla

Con RLS habilitada pero sin `GRANT SELECT`/`INSERT`/etc. a `anon` y
`authenticated`, todas las lecturas fallaban con
`permission denied for table events` (42501), incluso con policies correctas.
Ninguna migración del repo otorga estos privilegios explícitamente — el
proyecto remoto probablemente los tiene por un `GRANT` aplicado a mano alguna
vez, igual que los objetos de P0.1.

Lo apliqué manualmente en la base local para poder probar (no está en una
migración versionada):

```sql
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
alter default privileges in schema public grant select on tables to anon, authenticated;
```

Falta decidir el alcance correcto por tabla (no necesariamente todas necesitan
los cuatro privilegios para `authenticated`) y escribirlo como migración,
porque hoy un `supabase db reset` desde cero no deja el entorno funcional.

---

## P1 — Bugs dentro de migraciones todavía no aplicadas

Se arreglan editando el archivo, porque nunca corrieron.

### P1.1 — Los merge apuntan a dos tablas que no existen

**[verificado]** contra la base: sólo existen `lineups` y `wishlist`.

`20260824202000_moderation_queue.sql` y su reescritura
`20260825060000_moderation_approve_and_status_guard.sql` usan `event_artists` y
`user_wishlist`. Esos identificadores no aparecen en ningún otro archivo del
repo. Las tablas reales son `lineups` y `wishlist`.

`plpgsql` no valida catálogos al crear la función, así que la migración aplica
limpia y el error aparece recién al ejecutar la fusión:
`42P01 relation "event_artists" does not exist`.

Alcance: `merge_artists` y `merge_events` abortan en su primera sentencia.
`merge_venues` es la única que funcionaría.

Nota de proceso: la guarda de rol de esos tres RPC se endureció el 2026-08-25 sin
verificar que las tablas que tocan existieran.

### P1.2 — `events.status` colisiona

**[verificado]**: la base tiene `events.status text default 'scheduled'`, creada
en `20260216230841_remote_schema.sql:41`. Ninguna migración la elimina — los
únicos `drop column` son `tour_id`, `festival_edition_id` e `is_child_event`.

`20260824202000_moderation_queue.sql:13-16` hace
`ALTER TABLE events ADD COLUMN status verification_status, ADD COLUMN created_by ...`
en una sola sentencia. Sobre la base actual falla con
`column "status" of relation "events" already exists`, y al ser una única
sentencia tampoco se agrega `created_by` — que el trigger
`check_creation_rate_limit` escribe incondicionalmente, con lo cual todo INSERT
en `events` pasaría a fallar.

Hay que decidir si la columna vieja se renombra, se elimina o si la de
verificación usa otro nombre, y reflejarlo en `src/graphql/events.ts:96`, que hoy
expone `status` sin distinguir cuál de las dos semánticas devuelve.

### P1.3 — Fusionar deja registros huérfanos

**[reportado]**, cruzado contra las FK de las migraciones.

| FK | ON DELETE | ¿la mueve el merge? | Consecuencia |
|---|---|---|---|
| `expenses.event_id` | SET NULL | no | el gasto pierde su show |
| `festival_events.event_id` | CASCADE | no | el evento desaparece del festival |
| `event_checklist_items.event_id` | CASCADE | no | se borra el checklist |
| `event_checklist_checks.event_id` | CASCADE | no | se borra el estado tildado |
| `festivals.venue_id` | SET NULL | no | el festival queda sin sede |

Ninguna levanta excepción: `merge_*` devuelve éxito y la pérdida es silenciosa.

---

## P2 — Seguridad

### P2.1 — El cron falla abierto — CRÍTICO

**[verificado]** en `app/api/cron/sync-external-sources/route.ts:14`.

```ts
if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

Si `CRON_SECRET` no está seteada, la condición completa es falsa y el chequeo se
saltea entero. El handler sigue con `SUPABASE_SERVICE_ROLE_KEY`, que bypassa RLS.
Un olvido de variable en un deploy de preview deja el endpoint público con la
llave maestra.

Corrección: fallar cerrado cuando el secreto no está configurado, y comparar con
`crypto.timingSafeEqual`.

### P2.2 — Cualquier autenticado puede borrar cualquier evento o festival

**[verificado]**: `"Allow update events"` y `"Allow delete events"` son
`using (true) with check (true)`, restringidas sólo a `authenticated`
(`20260217000000` + `20260721000000`). `removeEvent`
(`src/domains/events/service.ts:248`) sólo comprueba que haya sesión — sin
ownership ni rol. Mismo patrón en festivales.

El trigger de guarda de status protege únicamente esa columna. El resto de las
columnas y el `DELETE` completo siguen abiertos.

Si el catálogo colaborativo estilo wiki es la intención, conviene al menos
reservar el `DELETE` a moderadores. La migración original lo dejó anotado como
deuda: *"Más adelante se puede restringir a auth.uid() o rol"*.

### P2.3 — `search_catalog` del MCP no escapa comodines de LIKE

**[reportado]**, `mcp/src/index.ts:118`. Es el mismo bug que ya se corrigió del
lado de la app con `escapeLikeWildcards`
(`src/domains/moderation/service.ts:67`). Un `%` en el término ensancha el match
justo antes de una fusión destructiva.

### P2.4 — `check_creation_rate_limit()` sin `SET search_path`

**[reportado]**, `20260824202000_moderation_queue.sql:19`. Es la única función
`SECURITY DEFINER` del repo sin esa cláusula.

### P2.5 — `spatial_ref_sys` con RLS deshabilitada

**[verificado]** vía el advisor de Supabase. Es la tabla de sistema de PostGIS,
datos de referencia — riesgo bajo, pero el advisor lo marca como crítico.
Habilitar RLS sin policies bloquea el acceso, así que es una decisión a tomar,
no algo a aplicar automáticamente.

---

## P3 — Los scrapers no funcionan

### P3.1 — El cron nunca se ejecuta

**[verificado]**: no existe `vercel.json`, no hay bloque `crons`, `.vercel/` sólo
tiene el `project.json` de vinculación, y `ci.yml` no lo invoca. Buscando
`sync-external-sources` en todo el repo, la única aparición es la propia route.

Sumado a que `external_events_cache` tampoco existe en la base (P0), la feature
de scraping está muerta por dos razones independientes.

### P3.2 — El CI está en rojo

**[verificado]**: `npm run lint` → exit 1 (190 errores), `npx tsc --noEmit` →
exit 1. `ci.yml` corre ambos. Los tests pasan (1011/1011). Un CI que siempre
falla es un CI que nadie mira.

La mayoría de los errores de lint vienen de archivos que no deberían lintearse
(`coverage/`, `supabase/.temp/`, un bundle minificado en `public/`). El error de
`tsc` es real: `relayOptions` no existe en Pothos v4
(`src/graphql/builder.ts:12`).

### P3.3 — Importar un evento scrapeado falla en la mayoría de las fuentes

**[reportado]**, con la premisa verificada: `events.date` es `timestamptz not null`.

El `datetime` crudo del adaptador va directo a esa columna sin validación en
ningún punto — ni el input GraphQL, ni el resolver, ni el service. Varias fuentes
producen fechas en prosa (`"Domingo 06 de Septiembre"`), que Postgres rechaza y
`sanitizeError` convierte en un mensaje genérico.

En la práctica el botón de importar sólo funciona con Ticketmaster, enigma y
norteticket. `livepass` produce como fecha las primeras tres palabras del texto
de la tarjeta. `konex` devuelve `datetime: ''` siempre.

Lo mismo se filtra a la UI: `FutureEventsResults` renderiza literalmente el texto
`"Invalid Date"`.

### P3.4 — Ceros silenciosos

**[reportado]**. Cuando un sitio cambia su HTML, el adaptador devuelve
`{ events: [], total: 0 }` sin `error`. El cron lo cuenta como éxito y responde
`{ success: true }`. No hay forma de distinguir "el selector se rompió" de "hoy
no hay recitales". Sentry está inicializado pero sin `captureConsoleIntegration`,
así que los `console.error` no llegan.

Los tests seguirán en verde indefinidamente porque corren contra fixtures
congelados — y **6 de los 11 fixtures son miniaturas escritas a mano** (konex 147
bytes, puntoticket 214, tuentrada 304, norteticket 497/541, pulsotickets 1.5 KB),
que validan una forma inventada por quien escribió el adaptador. Los de
allaccess, enigma, entraste y livepass sí son capturas reales de 230–450 KB.

### P3.5 — Otros

- **[reportado]** `events` no tiene constraint de unicidad. El mismo show
  importado dos veces crea dos filas — justo lo que la cola de moderación
  después tiene que fusionar a mano.
- **[reportado]** `isConfigured()` es código muerto: los 13 adaptadores lo
  implementan como `() => true` y nadie lo llama.
- **[reportado]** `norteticket` hace un loop secuencial sin cota; cada iteración
  cuesta hasta 16.5 s y puede agotar sola los 300 s de `maxDuration`.
- **[reportado]** Ningún adaptador manda User-Agent, aunque el diseño se
  compromete a `RitualBot/1.0` y a un crawl delay de 1-2 s.

---

## P4 — Flujo de usuario

### P4.1 — Aprobar por MCP miente en artistas y sedes

**[reportado]**, `mcp/src/index.ts:125`. Hace `UPDATE` directo — el mismo camino
que se reemplazó por RPC del lado web. Sin policy de UPDATE en `artists` ni
`venues`, RLS deniega, PostgREST devuelve 0 filas con `error: null`, y el MCP
responde `Éxito`. En `events` sí funciona.

### P4.2 — Los festivales no están restringidos a Admin

**[reportado]**. El `01-spec.md` §4 los excluye del scope comunitario, pero
`insertFestival` (`src/domains/festivals/service.ts:63`) sólo valida que haya
sesión, y `createFestival` no tiene guarda de rol. `/festivals/nuevo` está
publicada en `routes.ts:49`.

### P4.3 — Importar carga la cola con tres filas

**[reportado]**. `addExternalEvent` crea venue + artista + evento, los tres
`unverified`. El flujo de alta más común es el que más carga la cola. Y
`/admin/moderacion/eventos` dice "Recitales creados a mano que no vinieron por
APIs externas", que es falso.

Relacionado: el rate limit corta en 5 creaciones por hora **por tabla**, así que
a la sexta importación en una hora el usuario recibe un error genérico —
`sanitizeError` no mapea `rate_limit_exceeded`.

### P4.4 — La cola de eventos ordena por fecha del recital

**[reportado]**, `service.ts:54` usa `.order('date')` en vez de `created_at`. Lo
recién cargado cae al fondo. Artistas y sedes sí ordenan por `created_at desc`.

### P4.5 — El buscador de fusión está construido y desconectado

**[verificado]**. `searchMergeTargets` y la query `mergeTargets` están escritas,
testeadas y con escapado de comodines; `Combobox` existe. Ningún componente los
consume: la UI sigue pidiendo el UUID tipeado a mano. Es trabajo de UI pausado a
propósito, anotado acá para que no se pierda.

### P4.6 — Soft-publish funciona como dice el spec

**[verificado]**. Ningún `data.ts` filtra por `status`. Es la decisión del
`01-spec.md` §2, no un bug. Lo que falta es cualquier marca visual de "sin
verificar" en la vista pública — eso es trabajo de diseño, no de filtrado.

---

## P5 — Carga sobre la base

Todos **[reportado]**. Ninguno duele hoy con 0 filas; importan a medida que crezca.

| Hallazgo | Ubicación |
|---|---|
| `getPersonalStats()` trae la tabla `events` entera con tres joins, sin límite, y filtra en JS | `src/domains/stats/data.ts:84` |
| `/wrapped` hace dos barridas casi idénticas del catálogo en el mismo request | `app/wrapped/page.tsx:33` |
| N+1 vivo en `Artist.events` y `Venue.events` — el pase de DataLoader no los cubrió | `src/graphql/artists.ts:67`, `venues.ts:57` |
| El home carga tres catálogos completos por request | `app/page.tsx:166` |
| El trigger de rate limit hace `count(*)` sin índice sobre `created_by` | `20260824202000:37` |
| Los filtros de la cola no tienen índice sobre `status`; ninguna pagina | `moderation/service.ts:18` |
| `attendance` no tiene índice por `event_id` solo — `merge_events` hace dos seq scans con lock | `20260216230841:142` |
| Policies RLS con `auth.uid()` sin envolver en `(select ...)` — se re-evalúa por fila | ~15 policies |
| Ninguna página declara revalidación; todo es dinámico porque `createClient()` llama a `cookies()` | global |
| `sitemap.ts` trae 1000 eventos con joins para usar sólo el `id` | `app/sitemap.ts:6` |
| `getCurrentUserId()` sin `cache()` — 5 validaciones del mismo JWT por render | `src/core/auth/session.ts:10` |

Nota sobre el trigger de guarda de status: **no** agrega una query por cada
UPDATE. El `AND` de `NEW.status IS DISTINCT FROM OLD.status AND NOT is_moderator()`
corta a la izquierda, así que `is_moderator()` sólo corre cuando `status`
efectivamente cambia. Un UPDATE de nombre o fecha paga cero queries.

---

## P6 — Estructura y limpieza

Todos **[reportado]**.

- `app/buscar/page.tsx:28` tiene `createClient` y lógica de negocio en la ruta, con
  `ilike` sin escapar comodines. Es la única violación real de la convención.
- `moderation` es el único dominio sin `data.ts`.
- El seam `service.ts` ya estaba erosionado: `src/graphql/` importa `data.ts`
  directo en 7 archivos y `app/` en 16.
- Imports cruzados entre dominios: `expenses` → `events`, `showmode` → `expenses`
  y `weather`.
- Tres documentos de convención desactualizados: `src/README.md` describe
  `actions.ts` (borrado), `docs/estructura-del-proyecto.md` no lista tres
  dominios, y `docs/access-control.md` afirma que no hay roles ni panel admin.
- Versionado y no debería: `msg.txt`, `test-adapters.ts`, `scratch/`.
- Sin trackear, para borrar: `refactor.js`, `refactor-waterfall.js`.
- `.gitignore` no cubre `mcp/node_modules/` ni `mcp/dist/`. Un `git add mcp/`
  metería 4355 archivos.

---

## Verificado y sano

- Los DataLoaders de `attendance` y `photos` están bien construidos: `.in()` con
  remapeo que preserva el orden de las claves.
- Paginación de `events` con `resolveOffsetConnection` y la cota `MAX_EVENTS`.
- El cliente GraphQL corre en proceso vía `yoga.fetch`, sin vuelta por HTTP.
- `findOrCreateByName`: upsert-then-select atómico contra `name_key`, sin TOCTOU.
- Los índices de gastos cubren exactamente los shapes que usan sus RPCs.
- Los 13 adaptadores usan `fetchWithRetry`, ninguno tira hacia arriba, y ninguno
  es alcanzable desde una Server Component — un sitio caído no puede colgar una
  página.
- Los cuatro clientes de API externa cumplen el ADR 0003.
- `assign_user_role` usa `IS DISTINCT FROM` para fallar cerrado ante rol NULL.
- El JSON-LD con `dangerouslySetInnerHTML` está correctamente mitigado.
- `safeHref` bloquea `javascript:`; `sanitizeError` no filtra detalles internos.
- `/admin` sin guard no filtra datos: `requireModerator` corta en el resolver.

---

## Requiere verificación con la base viva o con red

- Si algún sitio scrapeado ya cambió su HTML. Sin red, los fixtures sólo prueban
  que el parser maneja ese snapshot.
- Si los endpoints de `alpogo` y `quehacemos` existen. `alpogo.ts:14` se
  auto-declara adivinado.
- Si los sitios rechazan requests sin User-Agent.
- Volumen y frecuencia reales del cron, que multiplican todo P5.
- Contenido de `mcp/.env.example` — el sandbox bloquea la lectura de archivos
  `.env`. Está commiteado a propósito; conviene confirmar a mano que sólo tiene
  placeholders.
- A qué proyecto de Supabase apunta `.env.local`. `ritual-db` es el único de la
  cuenta, pero no pude leer el archivo.
