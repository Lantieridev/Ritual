-- Índices para los caminos calientes que quedaron sin cobertura.
--
-- Cada uno responde a un patrón de consulta concreto que hoy hace seq scan.
-- Se usan índices parciales donde el predicado es fijo: indexan sólo las filas
-- que la consulta mira, así que quedan chicos y las filas dejan de ocupar
-- lugar en cuanto salen del estado que se consulta.

-- ─── 1. Trigger de rate limit ───────────────────────────────────────────────
-- check_creation_rate_limit() corre en CADA INSERT de artists/venues/events y
-- hace `select count(*) ... where created_by = $1 and created_at > now() -
-- interval '1 hour'`. Sin índice sobre created_by eso es un seq scan completo
-- de la tabla por cada alta — y no sólo del alta manual: findOrCreateByName
-- pasa por el mismo camino dos veces (venue + artista) en cada importación de
-- un evento externo.
--
-- Parcial sobre `created_by is not null` porque las altas que entran por el
-- cron con service role dejan esa columna en null y nunca se consultan por
-- este predicado.
create index if not exists artists_created_by_recent_idx
  on public.artists (created_by, created_at desc)
  where created_by is not null;

create index if not exists venues_created_by_recent_idx
  on public.venues (created_by, created_at desc)
  where created_by is not null;

create index if not exists events_created_by_recent_idx
  on public.events (created_by, created_at desc)
  where created_by is not null;

-- ─── 2. Cola de moderación ──────────────────────────────────────────────────
-- Los tres getUnverified* filtran por `status = 'unverified'` y ordenan. El
-- patrón esperado en régimen es una cola corta sobre una tabla grande (20
-- pendientes sobre 50.000 artistas), que es justo el peor caso para un filtro
-- sin índice: seq scan + sort de toda la tabla para devolver 20 filas.
--
-- El índice parcial es ideal acá: sólo contiene las filas pendientes, y
-- aprobar una la saca del índice.
create index if not exists artists_unverified_idx
  on public.artists (created_at desc)
  where status = 'unverified';

create index if not exists venues_unverified_idx
  on public.venues (created_at desc)
  where status = 'unverified';

create index if not exists events_unverified_idx
  on public.events (date)
  where status = 'unverified';

-- ─── 3. attendance por evento ───────────────────────────────────────────────
-- El único índice de attendance que menciona event_id es el único compuesto
-- (user_id, event_id), con user_id como columna líder: un `where event_id = X`
-- sin filtro de user_id no lo puede usar.
--
-- merge_events hace dos pasadas de ese tipo (el UPDATE y el DELETE) dentro de
-- una transacción, manteniendo el lock mientras escanea la tabla entera.
-- attendance es la que crece más rápido de todas: usuarios × shows.
create index if not exists attendance_event_id_idx
  on public.attendance (event_id);

-- ─── 4. Cache de fuentes externas ───────────────────────────────────────────
-- `expires_at > now()` es el único predicado presente en TODAS las lecturas de
-- searchCachedExternalEvents, y era el único sin índice: el trigram sobre el
-- título sólo entra en juego cuando hay término de búsqueda.
create index if not exists external_events_cache_expires_at_idx
  on public.external_events_cache (expires_at);
