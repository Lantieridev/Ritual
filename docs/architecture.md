# 🏛️ Arquitectura del Sistema RITUAL

Este documento define el modelo de datos y la lógica de negocio para manejar la complejidad de giras y festivales.

## 1. Conceptos Core

Para resolver el problema de "Shows vs. Festivales", el sistema utiliza una estructura jerárquica:

* **Artist (Artista):** La unidad base (ej. *Los Piojos*, *Charly García*).
* **Context (Contexto):** El "contenedor" del evento. Puede ser:
    * **Gira (Tour):** Un artista principal recorriendo lugares (ej. *Ritual 87*).
    * **Edición de Festival:** Un evento masivo con múltiples artistas (ej. *Cosquín Rock 2026*).
* **Event (Evento/Fecha):** La instancia espacio-temporal concreta a la que asiste el usuario.
    * Tiene una fecha y un lugar (`Venue`) específico.
    * Si es un festival, representa un "Día" (ej. *Día 1*).

## 2. Esquema de Base de Datos (ERD Preliminar)

### A. Entidades Globales
* **`profiles`**: Usuarios de la app (Extiende de Supabase Auth).
    * `id`, `username`, `avatar_url`, `bio`.
* **`artists`**:
    * `id`, `name`, `genre`, `image_url`, `spotify_id`.
* **`venues`**: Lugares físicos.
    * `id`, `name`, `address`, `city`, `lat`, `lng`.

### B. Estructura de Eventos
* **`tours`**:
    * `id`, `artist_id` (Dueño de la gira), `name` (ej. "Gira 2026"), `year`.
* **`festivals`**: La marca del festival.
    * `id`, `name` (ej. "Lollapalooza").
* **`festival_editions`**: La realización anual.
    * `id`, `festival_id`, `year`, `name` (ej. "Lollapalooza Arg 2025").

* **`events` (La tabla principal)**:
    * `id` (UUID)
    * `date`: TIMESTAMP (Fecha y hora).
    * `venue_id`: FK.
    * `tour_id`: FK (Nullable) -> Si pertenece a una gira.
    * `festival_edition_id`: FK (Nullable) -> Si es parte de un festival.
    * `is_child_event`: Boolean (True si es el "Día 1" de un festival).

### C. Relación Artista-Evento
* **`lineups`**: Tabla intermedia (Muchos a Muchos).
    * `event_id`: FK.
    * `artist_id`: FK.
    * `stage`: Texto (ej. "Escenario Norte").
    * `order`: Integer (Para ordenar el cartel).
    * `is_headliner`: Boolean.

### D. User Experience
* **`attendance` (La "Asistencia")**:
    * `user_id`, `event_id`.
    * `status`: ENUM ('interested', 'going', 'went').
* **`memories` (Bitácora)**:
    * `attendance_id`.
    * `rating`: 1-5.
    * `review`: Texto.
    * `media_urls`: Array de fotos.

## 3. Flujos de Usuario

### Caso 1: Asistir a un Festival
1.  El usuario busca "Cosquín Rock".
2.  El sistema muestra la `festival_edition`.
3.  El usuario ve los `events` hijos (Día 1, Día 2).
4.  El usuario marca "Voy" al `event` "Día 1".
5.  En la tabla `attendance` se guarda la relación con ese día específico.

### Caso 2: Asistir a un Show de Gira
1.  El usuario busca "Los Piojos".
2.  El sistema muestra el `tour` actual y los próximos `events` (fechas).
3.  El usuario marca "Voy" a la fecha de La Plata.