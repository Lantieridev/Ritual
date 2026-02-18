-- Security Hardening: Revoke public access and enforce strict RLS

-- 1. Revoke existing permissive policies
-- Drop policies for 'expenses'
drop policy if exists "Public select expenses" on "public"."expenses";
drop policy if exists "Public insert expenses" on "public"."expenses";
drop policy if exists "Public update expenses" on "public"."expenses";
drop policy if exists "Public delete expenses" on "public"."expenses";

-- Drop policies for 'attendance'
drop policy if exists "Public select attendance" on "public"."attendance";
drop policy if exists "Public insert attendance" on "public"."attendance";
drop policy if exists "Public update attendance" on "public"."attendance";
drop policy if exists "Public delete attendance" on "public"."attendance";

-- Drop policies for 'memories'
drop policy if exists "Public select memories" on "public"."memories";
drop policy if exists "Public insert memories" on "public"."memories";
drop policy if exists "Public update memories" on "public"."memories";
drop policy if exists "Public delete memories" on "public"."memories";

-- Drop policies for 'wishlist'
drop policy if exists "Public select wishlist" on "public"."wishlist";
drop policy if exists "Public insert wishlist" on "public"."wishlist";
drop policy if exists "Public delete wishlist" on "public"."wishlist";

-- Drop policies for 'event_photos'
drop policy if exists "Public select event_photos" on "public"."event_photos";
drop policy if exists "Public insert event_photos" on "public"."event_photos";
drop policy if exists "Public delete event_photos" on "public"."event_photos";

-- Drop policies for 'festival_attendance'
drop policy if exists "Public select festival_attendance" on "public"."festival_attendance";
drop policy if exists "Public insert festival_attendance" on "public"."festival_attendance";
drop policy if exists "Public update festival_attendance" on "public"."festival_attendance";
drop policy if exists "Public delete festival_attendance" on "public"."festival_attendance";


-- 2. Create strict policies (Authenticated users only, accessing their own data)

-- Expenses
create policy "Owner select expenses"
  on "public"."expenses" for select to authenticated using (auth.uid() = user_id);

create policy "Owner insert expenses"
  on "public"."expenses" for insert to authenticated with check (auth.uid() = user_id);

create policy "Owner update expenses"
  on "public"."expenses" for update to authenticated using (auth.uid() = user_id);

create policy "Owner delete expenses"
  on "public"."expenses" for delete to authenticated using (auth.uid() = user_id);

-- Attendance
create policy "Owner select attendance"
  on "public"."attendance" for select to authenticated using (auth.uid() = user_id);

create policy "Owner insert attendance"
  on "public"."attendance" for insert to authenticated with check (auth.uid() = user_id);

create policy "Owner update attendance"
  on "public"."attendance" for update to authenticated using (auth.uid() = user_id);

create policy "Owner delete attendance"
  on "public"."attendance" for delete to authenticated using (auth.uid() = user_id);

-- Memories
create policy "Owner select memories"
  on "public"."memories" for select to authenticated using (auth.uid() = user_id);

create policy "Owner insert memories"
  on "public"."memories" for insert to authenticated with check (auth.uid() = user_id);

create policy "Owner update memories"
  on "public"."memories" for update to authenticated using (auth.uid() = user_id);

create policy "Owner delete memories"
  on "public"."memories" for delete to authenticated using (auth.uid() = user_id);

-- Wishlist
create policy "Owner select wishlist"
  on "public"."wishlist" for select to authenticated using (auth.uid() = user_id);

create policy "Owner insert wishlist"
  on "public"."wishlist" for insert to authenticated with check (auth.uid() = user_id);

create policy "Owner delete wishlist"
  on "public"."wishlist" for delete to authenticated using (auth.uid() = user_id);

-- Festival Attendance
create policy "Owner select festival_attendance"
  on "public"."festival_attendance" for select to authenticated using (auth.uid() = user_id);

create policy "Owner insert festival_attendance"
  on "public"."festival_attendance" for insert to authenticated with check (auth.uid() = user_id);

create policy "Owner update festival_attendance"
  on "public"."festival_attendance" for update to authenticated using (auth.uid() = user_id);

create policy "Owner delete festival_attendance"
  on "public"."festival_attendance" for delete to authenticated using (auth.uid() = user_id);


-- 3. Special cases

-- Event Photos: Anyone can see photos (maybe?), but only owner can upload/delete?
-- For now, let's allow authenticated read, but only owner delete.
-- Wait, 'event_photos' doesn't have 'user_id' in the schema I saw earlier? 
-- Let's check schema. If no user_id, we can't restrict by owner efficiently without join.
-- I'll assume it doesn't have user_id for now and leave it 'authenticated select' but 'no delete' for now?
-- Or I should add user_id to event_photos?
-- The user said "Cree políticas restrictivas... para tablas privadas". event_photos is semi-public?
-- I'll skip Strict Owner Policy for event_photos if I'm not sure about user_id, 
-- but I'll make it "Authenticated Select" and "Authenticated Insert" (if needed).
-- Let's assume 'event_photos' table structure from previous `view_file`.
-- "event_id", "storage_path", "caption". No user_id.
-- So I can't enforce ownership easily.
-- I will allow "Authenticated Select" and "Authenticated Insert". Deletion is tricky.

create policy "Authenticated select event_photos"
  on "public"."event_photos" for select to authenticated using (true);

create policy "Authenticated insert event_photos"
  on "public"."event_photos" for insert to authenticated with check (true);

-- No update/delete policy for now (admin only or implementation detail).
