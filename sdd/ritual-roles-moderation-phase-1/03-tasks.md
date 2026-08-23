# Phase 1: Roles Data Model & Foundation - Tasks

- [x] 1. **Migration SQL:** Generate a new Supabase migration file with the `user_role` enum, the `role` column on `profiles` (defaulting to 'usuario'), the `get_user_role` SECURITY DEFINER function, and the column-scoped `assign_user_role(target_user_id, new_role)` SECURITY DEFINER RPC (with its own admin check and `REVOKE`/`GRANT EXECUTE`). Do NOT add a broad "admins can update any profile" RLS policy — none is needed.
- [x] 2. **Context Update:** Modify `src/graphql/context.ts` to include `role` on the `GraphQLContext` interface. Implement the logic in `createGraphQLContext()` to query `get_user_role` via RPC for the authenticated user.
- [x] 3. **Service Layer Updates:** In `src/domains/auth/service.ts`, implement `assignUserRole(userId, role)` calling the `assign_user_role` RPC (not a raw `.update()` on `profiles`). Ensure `ProfileUpdateInput` (and `modifyProfile`) remains oblivious to the `role` field.
- [x] 4. **Service Tests:** Update `src/domains/auth/service.test.ts` to add test cases proving:
    - `modifyProfile` explicitly ignores any injected `role` field.
    - `assignUserRole` calls the `assign_user_role` RPC (not a direct table update) and surfaces its error via `sanitizeError`.
    - A non-admin's direct call to the `assign_user_role` RPC is rejected at the database level (integration-style test, or documented as verified manually against the migration if the test setup doesn't support RPC-level assertions).
- [x] 5. **GraphQL Schema Updates:** In `src/graphql/auth.ts`, add the `role` field to `ProfileRef`. Add the `assignRole` mutation, guarding it with `if (context.role !== 'admin')`.
- [x] 6. **GraphQL Resolver Tests:** Update `src/graphql/auth.test.ts` to add test cases proving:
    - The `me` query returns the `role` field.
    - A non-admin calling the `assignRole` mutation receives the expected `{ error: "..." }` business payload.
    - An admin calling the `assignRole` mutation receives a `{ success: true }` payload.
