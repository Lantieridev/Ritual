# Enriquecimiento silencioso de shows (issue #11, subproyecto 1)

## Alcance

El issue #11 junta tres subproyectos independientes. Este spec cubre solo el primero; cada uno tiene su propio ciclo de spec, plan e implementación.

1. **Búsqueda silenciosa contra Ticketmaster (este spec).**
2. Horario típico por sede (fallback cuando no hay match). Fuera de alcance.
3. OCR del ticket, que alimenta la misma búsqueda. Fuera de alcance.

Fuera de alcance también: carga por voz (descartada en el issue) y avisos del wishlist (dependen del issue de notificaciones).

## Problema

Cargar un show a mano obliga a tipear datos que ya existen en Ticketmaster: hora real, póster y género.

## Decisión de fondo

**Guardar primero, enriquecer después.** Al confirmar el formulario, el show se crea con lo que escribió el usuario y la respuesta sale sin esperar. La búsqueda corre después con `after()` (Next 16; mismo patrón que `syncCityCoordinates` en `src/domains/auth/service.ts`) y completa solo campos vacíos. Si falla o no hay match, no pasa nada. Esto resuelve el punto "qué pasa si no hay match" que el issue dejaba abierto: no hay cambios y el usuario conserva su carga.

Se descartó buscar antes de guardar: el submit quedaría atado a la latencia de Ticketmaster y habría que resolver matches dudosos en pleno submit.

## Flujo

1. `createEvent` (`src/graphql/events.ts`) inserta el show y responde.
2. En el mismo resolver, `after(() => enrichEventFromExternal(eventId))`.
3. `enrichEventFromExternal` lee el evento, busca en Ticketmaster, aplica la regla de match y escribe solo campos vacíos.

Corre únicamente al **crear**. Editar un show no dispara búsquedas.

## Unidades

- `src/domains/events/enrichment/match.ts`: función pura. Recibe el show cargado y los candidatos de Ticketmaster, devuelve el único match confiable o `null`.
- `src/domains/events/enrichment/enrich-event.ts`: orquesta la lectura, la llamada a `searchTicketmasterEvents` (ya existente en `src/core/lib/ticketmaster.ts`), `match` y las escrituras. No lanza excepciones.
- Migración: `events.poster_url text null`.
- `src/core/lib/ticketmaster.ts` no cambia: `FutureEvent` ya expone `image` (vía `bestImage`), `genre`, `datetime` y `venue`.

## Búsqueda y regla de match

- Keyword: el nombre del show; si no tiene, el primer artista del lineup. Ciudad: la de la sede.
- Un candidato es match si coincide la **fecha local** (`toDateOnly`) y coincide la **ciudad o el nombre de la sede** (normalizados: sin tildes, sin mayúsculas).
- Solo se acepta si hay **exactamente un** candidato. Con cero o dos o más, no se escribe nada. Un falso positivo es peor que no completar.

## Qué se completa

| Dato | Destino | Condición |
| --- | --- | --- |
| Hora real | `events.date` | El show quedó sin hora (fecha `YYYY-MM-DD`) |
| Póster | `events.poster_url` | Está vacío |
| Género | `artists.genre` del artista principal | Está vacío |

Fuera de alcance: hora por artista dentro del lineup. La Discovery API de Ticketmaster solo entrega nombres de artistas, sin horarios.

## Cambio en el formulario

`EventForm.tsx:314` hoy arranca el campo hora con `'20:00'` al crear, así que "no lo tocó" y "escribió 20:00" son indistinguibles. Cambio: al crear, el campo hora arranca **vacío**. Vacío se guarda como fecha sin hora, estado que `dates.ts` ya soporta. Al editar, sigue mostrando la hora guardada.

Consecuencia: quien antes aceptaba el 20:00 por inercia ahora guarda sin hora. Es más honesto y el subproyecto 2 reutiliza la misma señal de "no hay hora".

## Escrituras y errores

- Escrituras condicionales por campo (`poster_url` solo `where poster_url is null`, etc.). Si el usuario edita el show entre el guardado y el enriquecimiento, gana el usuario.
- ADR 0003: sin `TICKETMASTER_API_KEY`, con la API caída, 429 o timeout, no se escribe nada y se loguea un warn. Nunca se propaga un error al usuario.
- Límite conocido: Ticketmaster solo devuelve shows futuros, así que para shows pasados esta búsqueda no aporta nada. Ahí entra el subproyecto 2.
- A verificar al implementar: que RLS permita las escrituras desde el contexto de `after()`. Si no, el módulo usa el cliente de servicio (ADR 0002).

## Testing

Vitest, tests junto al código, sin red real.

- `match.ts`: tabla de casos (un candidato válido; dos candidatos; fecha distinta; ciudad distinta; tildes y mayúsculas; lista vacía).
- `enrich-event.ts` con Ticketmaster mockeado: camino feliz; hora manual no se pisa; póster existente no se pisa; sin key, 429, timeout y excepción no escriben ni lanzan; sin match no escribe; escritura condicional ante campo llenado en el medio.
- Resolver `createEvent`: programa `after()` y la respuesta no espera al enriquecimiento (mismo enfoque que `service.test.ts`).
- `EventForm`: hora vacía al crear, hora guardada al editar, vacío se envía como fecha sin hora.
- Fixture nuevo: respuesta real recortada de Ticketmaster con `dateTime`, `images` y `classifications`.
