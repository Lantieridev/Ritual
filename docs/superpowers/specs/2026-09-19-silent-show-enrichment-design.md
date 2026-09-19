# Enriquecimiento silencioso de shows (issue #11, subproyecto 1)

## Alcance

El issue #11 junta tres subproyectos independientes. Este spec cubre solo el primero; cada uno tiene su propio ciclo de spec, plan e implementación.

1. **Búsqueda silenciosa contra Ticketmaster (este spec).**
2. Horario típico por sede (fallback cuando no hay match). Fuera de alcance.
3. OCR del ticket, que alimenta la misma búsqueda. Fuera de alcance.

Fuera de alcance también: carga por voz (descartada en el issue), avisos del wishlist (dependen del issue de notificaciones) y **mostrar el póster en la UI** (este spec solo lo guarda).

## Problema

Cargar un show a mano obliga a tipear datos que ya existen en Ticketmaster: hora real, póster y género.

## Decisión de fondo

**Guardar primero, enriquecer después.** Al confirmar el formulario, el show se crea con lo que escribió el usuario y la respuesta sale sin esperar. La búsqueda corre después con `after()` (Next 16) y completa solo campos vacíos. Si falla o no hay match, no pasa nada. Esto resuelve el punto "qué pasa si no hay match" que el issue dejaba abierto: no hay cambios y el usuario conserva su carga.

Se descartó buscar antes de guardar: el submit quedaría atado a la latencia de Ticketmaster y habría que resolver matches dudosos en pleno submit.

## Flujo

1. `insertEvent` (`src/domains/events/service.ts`) inserta el show y su lineup.
2. Si todo salió bien, programa `after(() => enrichEventFromExternal(supabase, eventId))`, con el mismo patrón que `modifyProfile` en `src/domains/auth/service.ts`: el `after()` vive en la capa de servicio y recibe el cliente Supabase de la request.
3. `enrichEventFromExternal` lee el evento, busca en Ticketmaster, aplica la regla de match y escribe solo campos vacíos.

Corre únicamente al **crear**. Editar un show no dispara búsquedas.

## Modelo de datos

Migración `supabase/migrations/20260919000000_show_enrichment.sql`:

- `events.poster_url text null`: póster del show.
- `events.time_known boolean not null default true`: `false` cuando el usuario no cargó hora. Los shows existentes quedan en `true`.
- Política RLS de `update` en `artists` que solo permite completar un `genre` vacío (`using (genre is null or genre = '')`, `with check (genre is not null and genre <> '')`). Hoy `artists` solo tiene `select` e `insert`: sin esto, el `update` afectaría 0 filas en silencio.

**Por qué `time_known`:** `events.date` es `timestamptz not null`, así que una fecha sin hora se guarda como un instante completo y "sin hora" no se puede distinguir de una hora real. El flag conserva ese dato.

## Hora opcional en el formulario

`EventForm.tsx` hoy arranca el campo hora en `'20:00'` y lo marca `required`, así que "no lo tocó" y "escribió 20:00" son indistinguibles. Cambio:

- El campo hora es **opcional** y arranca vacío al crear.
- Vacío: el form manda la fecha sola (`YYYY-MM-DD`). El servicio (`insertEvent`/`modifyEvent`) la guarda como medianoche local (`T00:00:00-03:00`, para no perder el día) con `time_known = false`. Con hora: se guarda el timestamp tal cual y `time_known = true`. El esquema GraphQL no cambia: la ausencia de hora viaja en el propio formato de la fecha.
- Al editar: si `time_known` es `false`, el campo hora se muestra vacío; si no, con la hora guardada.
- Quienes muestran la hora del show respetan el flag: la banda "Tu entrada de hoy" (`show-tonight.ts`) y el badge del hero (`home-view.ts`) omiten la hora cuando `time_known` es `false`.

Consecuencia: quien antes aceptaba el 20:00 por inercia ahora guarda sin hora. Es más honesto, y el subproyecto 2 reutiliza el mismo flag.

## Búsqueda y regla de match

- Keyword: el artista principal del lineup; si no hay lineup, el nombre del show. Ciudad: la de la sede.
- Un candidato es match si coincide la **fecha local** (`toDateOnly`) y coincide la **ciudad o el nombre de la sede** (normalizados: sin tildes, sin mayúsculas; el nombre de sede coincide si uno contiene al otro).
- Solo se acepta si hay **exactamente un** candidato. Con cero o dos o más, no se escribe nada. Un falso positivo es peor que no completar.

## Qué se completa

| Dato | Destino | Condición |
| --- | --- | --- |
| Hora real | `events.date` y `events.time_known = true` | `time_known` es `false` y Ticketmaster trae una hora real |
| Póster | `events.poster_url` | Está vacío |
| Género | `artists.genre` del artista principal | Está vacío |

**Hora "real" de Ticketmaster:** cuando Ticketmaster no manda hora, `ticketmaster.ts` rellena `T00:00:00-03:00`. Una hora `00:00` local no se considera real y no se usa.

Fuera de alcance: hora por artista dentro del lineup. La Discovery API de Ticketmaster solo entrega nombres de artistas, sin horarios.

## Escrituras y errores

- Escrituras condicionales por campo (`update … where time_known = false`, `where poster_url is null`, `where genre is null`). Si el usuario edita el show entre el guardado y el enriquecimiento, gana el usuario.
- ADR 0003: sin `TICKETMASTER_API_KEY`, con la API caída, 429 o timeout, no se escribe nada y se loguea un warn. `enrichEventFromExternal` nunca lanza.
- Límite conocido: Ticketmaster solo devuelve shows futuros, así que para shows pasados esta búsqueda no aporta nada. Ahí entra el subproyecto 2.
- Límite conocido: el clima por hora (issue #8) usa `events.date`; para un show con `time_known = false` consultaría las 00:00. Queda como seguimiento.

## Testing

Vitest, tests junto al código, sin red real.

- `match.ts`: tabla de casos (un candidato válido; dos candidatos; fecha distinta; ciudad distinta; tildes y mayúsculas; lista vacía; hora real vs `00:00`).
- `enrich-event.ts` con Ticketmaster mockeado y un Supabase falso que registra las escrituras: camino feliz; hora conocida no se pisa; póster y género existentes no se pisan; hora `00:00` de Ticketmaster no se usa; sin key, error de búsqueda y excepciones no escriben ni lanzan; sin match o match ambiguo no escribe; cada escritura lleva su guarda condicional.
- `insertEvent`/`modifyEvent`: fecha sin hora → medianoche local y `time_known = false`; timestamp completo → `time_known = true`; `insertEvent` programa `after()` sin ejecutarlo antes de responder y no lo programa si el insert falla.
- `EventForm`: hora vacía al crear y se envía la fecha sola; con hora se combina; al editar un show con `time_known = false` el campo hora aparece vacío.
- `heroBadgeText` y `bandaLinkFor`: sin hora cuando `time_known` es `false`.
- El mapeo de `ticketmaster.ts` no cambia y ya tiene su test con fixture real; los tests de enrichment construyen `FutureEvent` a mano.
