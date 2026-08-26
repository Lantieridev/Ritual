-- Consolida las policies de dueño y corrige un bypass en event_photos.
--
-- Dos problemas, uno de seguridad y uno de costo.
--
-- SEGURIDAD. `event_photos` tenía una policy "Auth insert event_photos" con
-- `with check (true)` conviviendo con "Owner insert event_photos"
-- (`auth.uid() = user_id`). Las policies permisivas se combinan con OR, así que
-- la laxa ganaba y el chequeo de dueño no servía de nada: cualquier usuario
-- autenticado podía insertar una foto atribuida a otro user_id.
-- 20260721000000_fase0_security_blockers.sql intentó eliminarla, pero dropeaba
-- el nombre "Authenticated insert event_photos" y la que existía se llamaba
-- "Auth insert event_photos" — creada fuera de las migraciones, así que el
-- `drop policy if exists` no matcheó y la dejó viva.
--
-- COSTO. Cada tabla acumulaba entre 3 y 9 policies equivalentes, restos de
-- pasadas sucesivas cuyos `drop` no coincidían con los nombres reales:
-- attendance tenía 7 y expenses 9, todas expresando "soy el dueño". Postgres
-- evalúa cada policy permisiva por fila candidata.
--
-- Además, todas escribían `auth.uid() = user_id` sin envolver. En ese contexto
-- Postgres trata la función como volátil y la ejecuta una vez POR FILA en vez
-- de una por consulta. Envolverla en `(select auth.uid())` la convierte en un
-- InitPlan que se evalúa una sola vez — es la recomendación explícita de
-- Supabase y no cambia la semántica.
--
-- Se preserva exactamente el conjunto de comandos que cada tabla permitía: las
-- tablas que tenían una policy FOR ALL quedan con FOR ALL, y las que sólo
-- permitían algunos comandos (event_photos, profiles, user_preferences) los
-- mantienen enumerados, para no habilitar un DELETE que antes no existía.

-- ─── attendance ─────────────────────────────────────────────────────────────
drop policy if exists "Manage own attendance" on public.attendance;
drop policy if exists "Owner all attendance" on public.attendance;
drop policy if exists "Owner delete attendance" on public.attendance;
drop policy if exists "Owner insert attendance" on public.attendance;
drop policy if exists "Owner select attendance" on public.attendance;
drop policy if exists "Owner update attendance" on public.attendance;
drop policy if exists "View own attendance" on public.attendance;

create policy "Owner manages own attendance" on public.attendance
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ─── expenses ───────────────────────────────────────────────────────────────
drop policy if exists "Owner all expenses" on public.expenses;
drop policy if exists "Owner delete expenses" on public.expenses;
drop policy if exists "Owner insert expenses" on public.expenses;
drop policy if exists "Owner select expenses" on public.expenses;
drop policy if exists "Owner update expenses" on public.expenses;
drop policy if exists "Users delete own expenses" on public.expenses;
drop policy if exists "Users insert own expenses" on public.expenses;
drop policy if exists "Users see own expenses" on public.expenses;
drop policy if exists "Users update own expenses" on public.expenses;

create policy "Owner manages own expenses" on public.expenses
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ─── wishlist ───────────────────────────────────────────────────────────────
drop policy if exists "Owner all wishlist" on public.wishlist;
drop policy if exists "Owner delete wishlist" on public.wishlist;
drop policy if exists "Owner insert wishlist" on public.wishlist;
drop policy if exists "Owner select wishlist" on public.wishlist;

create policy "Owner manages own wishlist" on public.wishlist
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ─── festival_attendance ────────────────────────────────────────────────────
drop policy if exists "Owner all festival_attendance" on public.festival_attendance;
drop policy if exists "Owner delete festival_attendance" on public.festival_attendance;
drop policy if exists "Owner insert festival_attendance" on public.festival_attendance;
drop policy if exists "Owner select festival_attendance" on public.festival_attendance;
drop policy if exists "Owner update festival_attendance" on public.festival_attendance;

create policy "Owner manages own festival_attendance" on public.festival_attendance
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ─── checklist del modo recital ─────────────────────────────────────────────
drop policy if exists "Users delete own checklist template" on public.checklist_template_items;
drop policy if exists "Users insert own checklist template" on public.checklist_template_items;
drop policy if exists "Users see own checklist template" on public.checklist_template_items;
drop policy if exists "Users update own checklist template" on public.checklist_template_items;

create policy "Owner manages own checklist template" on public.checklist_template_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own event checklist items" on public.event_checklist_items;
drop policy if exists "Users insert own event checklist items" on public.event_checklist_items;
drop policy if exists "Users see own event checklist items" on public.event_checklist_items;
drop policy if exists "Users update own event checklist items" on public.event_checklist_items;

create policy "Owner manages own event checklist items" on public.event_checklist_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own template checks" on public.event_checklist_checks;
drop policy if exists "Users insert own template checks" on public.event_checklist_checks;
drop policy if exists "Users see own template checks" on public.event_checklist_checks;
drop policy if exists "Users update own template checks" on public.event_checklist_checks;

create policy "Owner manages own template checks" on public.event_checklist_checks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ─── event_photos ───────────────────────────────────────────────────────────
-- La lectura es pública a propósito (mismo criterio que el catálogo), así que
-- el dueño mantiene sólo insert/update/delete y no se agrega un SELECT propio.
-- Se elimina el insert laxo descripto arriba y el SELECT redundante para
-- authenticated, que ya cubre la policy pública.
drop policy if exists "Auth insert event_photos" on public.event_photos;
drop policy if exists "Authenticated insert event_photos" on public.event_photos;
drop policy if exists "Authenticated select event_photos" on public.event_photos;
drop policy if exists "Owner delete event_photos" on public.event_photos;
drop policy if exists "Owner insert event_photos" on public.event_photos;
drop policy if exists "Owner update event_photos" on public.event_photos;

create policy "Owner inserts own event_photos" on public.event_photos
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Owner updates own event_photos" on public.event_photos
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owner deletes own event_photos" on public.event_photos
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ─── profiles ───────────────────────────────────────────────────────────────
-- El perfil es de lectura pública y el dueño sólo puede insertarlo y editarlo;
-- no había DELETE y no se agrega. Las dos policies de lectura pública
-- duplicadas se colapsan en una.
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Public profiles" on public.profiles;
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;

create policy "Public read profiles" on public.profiles
  for select to anon, authenticated
  using (true);

create policy "Owner inserts own profile" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Owner updates own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ─── user_preferences ───────────────────────────────────────────────────────
-- Sólo tenía insert/select/update; se mantiene así.
drop policy if exists "Users insert own preferences" on public.user_preferences;
drop policy if exists "Users see own preferences" on public.user_preferences;
drop policy if exists "Users update own preferences" on public.user_preferences;

create policy "Owner reads own preferences" on public.user_preferences
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "Owner inserts own preferences" on public.user_preferences
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Owner updates own preferences" on public.user_preferences
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
