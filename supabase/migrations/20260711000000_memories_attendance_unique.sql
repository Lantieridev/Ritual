-- The app has always treated "memory" (rating/review/notes) as 1:1 with an
-- attendance record (saveMemory selects by attendance_id and expects at
-- most one row), but the schema never enforced that. Enforce it so the
-- server action can upsert instead of racily selecting-then-inserting.

-- Defensive dedupe first, in case any duplicate rows already exist:
-- keep the most recently created memory per attendance_id.
delete from public.memories m
using public.memories newer
where m.attendance_id = newer.attendance_id
  and m.created_at < newer.created_at;

alter table public.memories
  add constraint memories_attendance_id_key unique (attendance_id);
