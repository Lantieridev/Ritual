# Phase 1: Roles Data Model & Foundation - Design

## 1. Database Schema & Migration SQL
We will create a new migration file (e.g. `supabase/migrations/<timestamp>_roles_data_model.sql`) with the following exact SQL:

```sql
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
-- Deliberately NOT a broad "admins can update any profile" RLS policy — an
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
```
*Note: No RLS policy grants admins general `UPDATE` on other users' `profiles` rows — the existing "Users can update own profile" policy is untouched. `assign_user_role` is the sole path for changing someone else's role, it's column-scoped by construction (the `UPDATE` statement only sets `role`/`updated_at`), and its own privilege check makes it safe even if called directly via `supabase.rpc()` outside the GraphQL resolver.*

## 2. GraphQL Context (`src/graphql/context.ts`)
We will add `role` to the context so that any resolver can cheaply check the authenticated user's role without making its own DB queries.

```typescript
export interface GraphQLContext {
    supabase: SupabaseClient
    userId: string | null
    role: 'usuario' | 'moderador' | 'admin' | null
}

export async function createGraphQLContext(): Promise<GraphQLContext> {
    const supabase = await createClient()
    const userId = await getCurrentUserId()
    let role: GraphQLContext['role'] = null

    if (userId) {
        // Fetch the user's role bypassing RLS via our new function
        const { data, error } = await supabase.rpc('get_user_role', { user_id: userId })
        if (!error && data) {
            role = data as GraphQLContext['role']
        } else {
            role = 'usuario' // Safe fallback
        }
    }

    return { supabase, userId, role }
}
```

## 3. GraphQL Schema (`src/graphql/auth.ts`)
We expose the new column on `ProfileRef` and create the `assignRole` mutation. Following existing conventions (like `updateProfile`), we will reuse `MutationResultRef` since the client only needs to know if the assignment succeeded or failed with a business error.

```typescript
// 1. Add role field to ProfileRef
ProfileRef.implement({
    fields: (t) => ({
        // ... existing fields ...
        role: t.exposeString('role'),
    }),
})

// 2. Add the assignRole mutation
builder.mutationField('assignRole', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            userId: t.arg.id({ required: true }),
            role: t.arg.string({ required: true }),
        },
        resolve: async (_root, args, context) => {
            // Authorization Check Integration
            if (context.role !== 'admin') {
                return toMutationResult({ error: 'No tenés permisos para realizar esta acción.' })
            }
            
            return toMutationResult(
                await assignUserRole(String(args.userId), args.role)
            )
        },
    })
)
```
*Design Note on Authorization Pattern:* The `assignRole` resolver directly checks `context.role`. This is the cleanest pattern for `src/graphql/` because it gates access at the network boundary, returning a clean UI-friendly error payload (via `toMutationResult`) before the service layer is even invoked. This avoids throwing raw exceptions.

## 4. Service Layer (`src/domains/auth/service.ts`)
We will add a new `assignUserRole` function to handle the database write. We will also modify the existing `ProfileUpdateInput` in `service.ts` to explicitly prove it does not accept a `role` field. (It already doesn't, but we must ensure it stays that way).

```typescript
export async function assignUserRole(userId: string, role: string): Promise<ActionResult> {
    const supabase = await createClient()
    // Goes through the assign_user_role RPC, not a raw table update — it's the
    // only path with a DB-level admin check and column-scoped write. See 02-design.md.
    const { error } = await supabase.rpc('assign_user_role', {
        target_user_id: userId,
        new_role: role,
    })

    if (error) {
        console.error('Assign role error:', error)
        return { error: sanitizeError(error) }
    }

    return {}
}
```

## Open Questions
None outstanding. The original open question (an admin having broad DB-level UPDATE access to other users' profiles via direct PostgREST calls, not just `role`) was resolved: replaced the broad "admins can update any profile" RLS policy with the column-scoped `assign_user_role` RPC above, which is the only sanctioned path and re-checks admin privilege itself.
