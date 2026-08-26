-- Restringe la creación de festivales a admins y moderadores.
--
-- El spec de la fase 2 (`sdd/ritual-roles-moderation-phase-2/01-spec.md` §4)
-- excluye a los festivales del scope comunitario por su complejidad
-- (multi-día, multi-escenario) y los reserva a alta top-down — a diferencia
-- de eventos/artistas/sedes, no entran a la cola de moderación como
-- `unverified`, así que dejarlos abiertos a cualquier autenticado significa
-- publicarlos directo en el catálogo compartido sin ningún paso de revisión.
--
-- `"Public insert festivals"` venía como `with check (true)` desde la
-- migración original, igual que el DELETE que ya se restringió en
-- 20260826010000. `insertFestival` (src/domains/festivals/service.ts) queda
-- como defensa en profundidad: consulta el mismo `is_moderator()` antes de
-- intentar el insert, así que un rechazo por RLS acá sería la segunda capa,
-- no la única.
--
-- `festival_events` (el vínculo festival↔evento) sigue la misma regla: sólo
-- quien puede crear el festival tiene sentido que le agregue días/eventos.

drop policy if exists "Public insert festivals" on "public"."festivals";
create policy "Moderators insert festivals"
  on "public"."festivals" for insert to authenticated
  with check (public.is_moderator());

drop policy if exists "Public insert festival_events" on "public"."festival_events";
create policy "Moderators insert festival_events"
  on "public"."festival_events" for insert to authenticated
  with check (public.is_moderator());
