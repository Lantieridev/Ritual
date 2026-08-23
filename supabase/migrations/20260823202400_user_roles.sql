-- 1. Create the role enum
CREATE TYPE public.user_role AS ENUM ('usuario', 'moderador', 'admin');

-- 2. Add the column to profiles
ALTER TABLE public.profiles 
  ADD COLUMN role public.user_role NOT NULL DEFAULT 'usuario';

-- 3. Create the role resolution function (bypasses RLS to prevent recursion)
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

-- 4. Narrow RPC: the ONLY sanctioned way to change another user's role.
-- Deliberately NOT a broad "admins can update any profile" RLS policy - an
-- admin hitting PostgREST directly must not be able to touch name/bio/etc.
-- on someone else's row. This function is SECURITY DEFINER (bypasses RLS
-- internally) but only ever writes the `role`/`updated_at` columns, and it
-- re-checks the caller's role itself rather than trusting the resolver.
CREATE OR REPLACE FUNCTION public.assign_user_role(target_user_id uuid, new_role public.user_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_user_role(auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'insufficient_privilege' USING HINT = 'Only admins can assign roles';
  END IF;

  UPDATE public.profiles
    SET role = new_role, updated_at = now()
    WHERE id = target_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_user_role(uuid, public.user_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, public.user_role) TO authenticated;

