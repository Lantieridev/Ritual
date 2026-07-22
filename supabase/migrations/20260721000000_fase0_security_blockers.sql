-- Fase 0 de la auditoría 2026-07-21: cierra los bloqueantes de seguridad
-- documentados en "Plan de Implementación - Auditoría 2026-07-21" (vault).
-- Nada de esto cambia la forma de las tablas salvo event_photos (user_id nueva).

-- ─── R1-001: catálogo compartido (events/lineups/venues/artists/festivals) ──
-- Restringe todas las escrituras del catálogo a usuarios autenticados.
-- SELECT se mantiene público a propósito (catálogo compartido, de lectura libre).

alter policy "Allow insert events" on "public"."events" to authenticated;
alter policy "Allow update events" on "public"."events" to authenticated;
alter policy "Allow delete events" on "public"."events" to authenticated;

alter policy "Allow insert lineups" on "public"."lineups" to authenticated;
alter policy "Allow delete lineups" on "public"."lineups" to authenticated;

alter policy "Allow insert venues" on "public"."venues" to authenticated;
alter policy "Allow insert artists" on "public"."artists" to authenticated;

alter policy "Public insert festivals" on "public"."festivals" to authenticated;
alter policy "Public update festivals" on "public"."festivals" to authenticated;
alter policy "Public delete festivals" on "public"."festivals" to authenticated;

alter policy "Public insert festival_events" on "public"."festival_events" to authenticated;
alter policy "Public delete festival_events" on "public"."festival_events" to authenticated;

-- ─── R1-003 / R1-007: event_photos necesita dueño real ──────────────────────

alter table "public"."event_photos"
  add column if not exists "user_id" uuid references auth.users(id) on delete cascade;

-- Tabla vacía en instalaciones frescas (sin deploy todavía), así que forzar
-- NOT NULL de una es seguro. Si hubiera filas legacy sin dueño, fallaría acá
-- a propósito en vez de dejar huérfanos silenciosos.
alter table "public"."event_photos" alter column "user_id" set not null;

drop policy if exists "Authenticated insert event_photos" on "public"."event_photos";
create policy "Owner insert event_photos"
  on "public"."event_photos" for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Owner update event_photos"
  on "public"."event_photos" for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Owner delete event_photos"
  on "public"."event_photos" for delete to authenticated
  using (auth.uid() = user_id);

-- ─── R1-002: bucket de Storage event-photos era 100% público ────────────────

drop policy if exists "Public upload event-photos" on storage.objects;
drop policy if exists "Public delete event-photos" on storage.objects;
drop policy if exists "Public update event-photos" on storage.objects;
-- "Public read event-photos" se mantiene: las fotos son visibles públicamente
-- a propósito (mismo criterio que el catálogo).

create policy "Authenticated upload event-photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'event-photos');

create policy "Owner delete event-photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'event-photos'
    and exists (
      select 1 from public.event_photos ep
      where ep.storage_path = storage.objects.name
        and ep.user_id = auth.uid()
    )
  );

create policy "Owner update event-photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'event-photos'
    and exists (
      select 1 from public.event_photos ep
      where ep.storage_path = storage.objects.name
        and ep.user_id = auth.uid()
    )
  );

-- ─── R1-004: migrate_legacy_data era una escalada de privilegios ────────────
-- Sin deploy todavía, no hay datos legacy reales que migrar — se elimina
-- en vez de intentar "validar" un caller contra un placeholder sin dueño real.

-- DROP FUNCTION revokes all grants on it too, no separate REVOKE needed.
drop function if exists migrate_legacy_data(uuid);

-- ─── R1-008: bucket "avatars" nunca estuvo en control de versiones ──────────
-- profile-actions.ts sube a un nombre plano "{user.id}-{random}.{ext}"
-- (sin subcarpeta), así que la política de dueño matchea por prefijo del name.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

drop policy if exists "Owner upload avatars" on storage.objects;
create policy "Owner upload avatars"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name like (auth.uid()::text || '-%'));

drop policy if exists "Owner update avatars" on storage.objects;
create policy "Owner update avatars"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name like (auth.uid()::text || '-%'));

drop policy if exists "Owner delete avatars" on storage.objects;
create policy "Owner delete avatars"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and name like (auth.uid()::text || '-%'));
