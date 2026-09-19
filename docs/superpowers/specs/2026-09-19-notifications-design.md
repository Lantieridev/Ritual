# Sistema de notificaciones + mensajería interna (issue #6)

Estado: diseño aprobado, pendiente de revisión del spec escrito.

## Objetivo

Poder avisarle al usuario algo fuera de que esté mirando la app, con control granular por tipo de aviso y por canal. Ritual hoy no tiene ningún sistema de notificaciones.

## Decisiones

| Tema | Decisión |
| --- | --- |
| Canales v1 | In-app (inbox) + email transaccional (Resend). Push del navegador queda para una v2. |
| Tipos v1 | `moderation_rejected`, `post_show_reminder`, `admin_message`. |
| Timing del post-show | Un aviso por show, en la corrida diaria del día siguiente al show. |
| Entrega | La base como cola: filas en `notifications` + cron que drena los emails pendientes. |
| Control | Preferencias por tipo **y** por canal (`in_app`, `email`). |

Motivo de la entrega por cola en la base: la infraestructura de background actual son crons de Vercel (`vercel.json`) con `authorizeCron` y `cron_runs`, y Vercel Hobby limita los crons a una corrida diaria. Una cola en Postgres cumple el patrón productor → cola → consumidor asíncrono del issue sin sumar un vendor ni un runtime nuevo. Alternativas descartadas: `pgmq` + Edge Function (superficie nueva sin justificación por el volumen) y cola externa tipo Inngest/QStash (vendor y secrets extra).

## 1. Modelo de datos

### `notifications` (inbox y cola)

- `id`, `user_id`, `type`, `title`, `body`, `payload jsonb` (motivo del rechazo, `event_id`, lista de pendientes), `read_at`, `created_at`.
- `dedupe_key`, con índice único `(user_id, dedupe_key)`. El post-show usa `post_show:{event_id}`, así un reintento del cron no duplica el aviso.
- Estado de email: `email_status` (`skipped | pending | sent | failed`), `email_attempts`, `email_last_error`, `email_sent_at`.

### `notification_preferences`

- Una fila por `(user_id, type)` con `in_app boolean` y `email boolean`.
- Sin fila, aplican los defaults por tipo definidos en código (el mensaje del admin siempre va por email).

### RLS

- El usuario lee y marca como leídas (`read_at`) solo sus filas, y edita solo sus preferencias.
- Ningún insert desde el cliente: solo el servidor con service-role.
- El email del destinatario sale de `auth.users`/`profiles`; no se duplica.

## 2. Dominio y flujo

Nuevo dominio `src/domains/notifications/` con la misma forma que `moderation` (`service.ts`, `data.ts`, `components/`).

### Productores

- `notify({ userId, type, title, body, payload, dedupeKey })` es el único punto de entrada. Lee las preferencias, inserta la fila con `in_app` / `email_status` según corresponda y devuelve sin bloquear.
- `moderation/service.ts` llama a `notify` al rechazar una entrada, con el motivo.
- Mutation GraphQL `sendAdminMessage`, solo para admins, llama a `notify`.
- Cron `notify-post-show`: busca shows terminados el día anterior, aplica `computePendingForShow` (`src/domains/showmode/pending.ts`) y, si queda algo pendiente, hace **un solo** `notify` con la lista completa. Si no queda nada pendiente, no envía.

### Consumidor

- Cron `deliver-notifications`: toma filas con `email_status = 'pending'` con `for update skip locked` (protege de corridas superpuestas), envía por Resend y marca `sent` o `failed`. Reintenta hasta 3 veces y respeta `RUN_BUDGET_MS`.
- Para `admin_message` y `moderation_rejected`, `after()` intenta el envío inmediato. Si falla, la fila queda `pending` y el cron la levanta.

### Proveedor de email

Detrás de una interfaz `EmailSender`, para testear con un fake y cambiar de proveedor sin tocar el resto.

### UI

Campanita con contador en el header, lista de avisos y pantalla de ajustes con un toggle por tipo y canal. Todo por GraphQL, con el patrón existente.

## 3. Errores, tests y alcance

### Errores

- `notify()` nunca propaga error al productor. Si falla el insert, loguea a Sentry y continúa: perder un aviso no debe romper el rechazo de una entrada ni una respuesta al usuario.
- Email caído: la fila queda `failed` con `email_last_error` tras 3 intentos. El inbox in-app funciona igual. `cron_runs` registra los contadores (enviados, fallidos).
- Sin `RESEND_API_KEY`, el cron falla cerrado con 503, igual que `authorizeCron` sin `CRON_SECRET`.

### Tests

- Unit (Vitest): `notify` (preferencias, defaults, dedupe), cálculo de destinatarios del post-show, reintentos con un `EmailSender` fake.
- SQL (`supabase/tests/`): RLS (un usuario no lee ni escribe filas ajenas, el cliente no inserta) e índice único de dedupe.
- Route tests de los dos crons, siguiendo el de `sync-external-sources`.
- Componentes: campanita y pantalla de ajustes con Testing Library.

### Migraciones

Una sola migración con tablas, RLS e índices; tipos regenerados con `supabase:gen-types`.

### Fuera de la v1

Push del navegador, modo recital activo (checklist + clima), wishlist, recordatorio a los 3 días y digest agrupado. El modelo de tipos y preferencias permite sumarlos sin migraciones grandes.

## Relación con otros issues

- #9 (post-show): `computePendingForShow` ya es pura y agnóstica del canal; el cron la reusa sin reimplementar la regla.
- Integración con Google Calendar: sistema separado, no reemplaza ni se reemplaza por este.
