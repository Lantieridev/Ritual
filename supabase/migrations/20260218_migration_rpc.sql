-- RPC for migrating legacy data insecurely (bypassing RLS)
-- This function runs as the database owner, so it can modify any data.

create or replace function migrate_legacy_data(target_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  legacy_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  -- 1. Migrate Attendance + Memories (cascade via fk or implicit ownership?)
  -- Memories don't have user_id, they rely on attendance_id.
  -- By changing attendance user_id, we transfer ownership effectively.
  update attendance
  set user_id = target_user_id
  where user_id = legacy_id;

  -- 2. Migrate Wishlist
  update wishlist
  set user_id = target_user_id
  where user_id = legacy_id;

  -- 3. Migrate Expenses
  update expenses
  set user_id = target_user_id
  where user_id = legacy_id;

  -- 4. Migrate Festival Attendance
  update festival_attendance
  set user_id = target_user_id
  where user_id = legacy_id;
  
end;
$$;

-- Grant execution permission to authenticated users so they can claim data.
grant execute on function migrate_legacy_data(uuid) to authenticated;
