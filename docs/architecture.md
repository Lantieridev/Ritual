# 🏛️ Arquitectura del Sistema RITUAL

Este documento define el modelo de datos y la lógica de negocio real de la app, reflejando el esquema efectivamente implementado (no el diseño original — ver nota histórica al final para el porqué de esa diferencia).

## 1. Conceptos Core

* **Artist (Artista):** La unidad base (ej. *Los Piojos*, *Charly García*).
* **Event (Evento/Fecha):** Un show puntual, con fecha y `Venue` específicos. Es la unidad central de la app — todo lo demás (attendance, expenses) cuelga de acá.
* **Festival:** Un evento de varios días con múltiples artistas (ej. *Cosquín Rock 2026*). Se modela como una entidad propia con sus propios `attendance`/`rating` (no reutiliza `attendance` de eventos), y opcionalmente puede vincular `events` individuales como sus días (ver `festival_events`).

No existe el concepto de "gira" (tour): se evaluó en el diseño original pero nunca se construyó ninguna funcionalidad sobre él — ver nota al final.

## 2. Esquema de Base de Datos

### A. Entidades Globales
* **`profiles`**: Usuarios de la app (Extiende de Supabase Auth).
    * `id`, `username`, `avatar_url`, `bio`.
* **`artists`**:
    * `id`, `name`, `genre`, `image_url`, `spotify_id`, `name_key` (generada, para dedup case-insensitive).
* **`venues`**: Lugares físicos.
    * `id`, `name`, `address`, `city`, `country`, `lat`, `lng`, `name_key` (generada, para dedup case-insensitive).

### B. Estructura de Eventos y Festivales
* **`events` (La tabla principal)**:
    * `id` (UUID), `name`, `date` (timestamptz), `venue_id` (FK), `status`.
* **`festivals`**: Festival con sus propios datos, independiente de `events`.
    * `id`, `name`, `edition`, `start_date`, `end_date`, `venue_id`, `city`, `country`, `website`, `notes`.
* **`festival_events`**: Tabla puente — vincula `events` individuales (los "días") a un `festival`.
    * `festival_id` (FK), `event_id` (FK), `day_label` (ej. "Día 1").

### C. Relación Artista-Evento
* **`lineups`**: Tabla intermedia (Muchos a Muchos), solo para `events`.
    * `event_id`: FK.
    * `artist_id`: FK.
    * `stage`, `start_time`, `is_headliner`.

### D. User Experience
* **`attendance`**: Asistencia del usuario a un `event` puntual, con su rating/reseña/notas de ESE show planos en la misma fila (fusionado desde una tabla `memories` separada — ver nota histórica al final).
    * `user_id`, `event_id`, `status`: ENUM ('interested', 'going', 'went'), `rating` (0-5), `review`, `notes`.
* **`festival_attendance`**: Asistencia del usuario a un `festival` (independiente de la de sus `events` individuales, si los tiene vinculados). Mismo patrón plano que `attendance`.
    * `festival_id`, `user_id`, `status`, `rating`, `review`.

## 3. Flujos de Usuario

### Caso 1: Asistir a un Festival (con días vinculados)
1.  El usuario busca "Cosquín Rock" y lo carga como `festival`.
2.  Opcionalmente vincula `events` puntuales como sus días (`festival_events`, con `day_label`).
3.  El usuario marca su asistencia general al festival en `festival_attendance` (status/rating/review propios del festival).
4.  Si además quiere trackear un día específico como show individual, marca attendance en ESE `event` por separado — son registros independientes a propósito: no es redundancia, son cardinalidades distintas.

### Caso 2: Asistir a un Show Suelto
1.  El usuario busca un artista o importa un show vía Ticketmaster/Setlist.fm.
2.  El sistema crea el `event` (con su `venue` y `lineup`).
3.  El usuario marca "Voy"/"Fui" — se guarda en `attendance`, junto con el rating/reseña de ese show cuando lo carga.

---

**Nota histórica (2026-07-21):** el diseño original de este documento planteaba un modelo jerárquico con `tours` (giras) y `festival_editions` (ediciones anuales de festival) como "contenedores" de `events`, vía columnas `events.tour_id`/`events.festival_edition_id`/`events.is_child_event`. Ninguna de las dos tablas ni esas columnas llegaron a tener código de aplicación que las usara — se confirmó cero referencias reales en todo el repo. Se eliminaron en la migración `20260722000000_drop_dead_tour_columns.sql`. El modelo que sí se construyó y funciona es el descrito arriba: `festivals` + `festival_events` como tabla puente, plano y sin jerarquía de "ediciones".

Además, en ese mismo momento se eliminó la tabla `memories` (que guardaba rating/review/notes en una fila 1:1 aparte de `attendance`, vía un `attendance_id` con constraint único) y se fusionaron sus columnas directamente en `attendance` — mismo razonamiento: era una relación forzada 1:1 sin ninguna razón de diseño viva, y `festival_attendance` ya modelaba lo mismo plano desde el principio. Migración: `20260722010000_fold_memories_into_attendance.sql`.