# Phase 1: Roles Data Model & Foundation - Spec

## 1. Database Defaults & Functions
**Scenario: New profile creation defaults to 'usuario'**
* **Given** a new authenticated user signs up or a new record is inserted into `public.profiles`
* **When** no `role` value is provided
* **Then** the `role` column defaults to `'usuario'`

**Scenario: Role resolution bypasses RLS and does not recurse**
* **Given** a `get_user_role(uuid)` postgres function is defined as `SECURITY DEFINER`
* **When** it is called with an existing user's ID
* **Then** it correctly returns the user's `role` without triggering any infinite recursion (even if the caller is evaluating an RLS policy on the same table).

## 2. API Authorization (GraphQL Mutations)
**Scenario: Non-admin users cannot assign roles**
* **Given** a GraphQL request to `assignRole(userId: "...", role: "admin")`
* **When** the authenticated user making the request has the role `'usuario'` or `'moderador'`
* **Then** the resolver rejects the request and returns a clean business-error payload (e.g., `{ error: "No tenés permisos para realizar esta acción." }`), without crashing or throwing a raw exception.

**Scenario: Admin users can successfully change another user's role**
* **Given** a GraphQL request to `assignRole(userId: "target-uuid", role: "moderador")`
* **When** the authenticated user making the request has the role `'admin'`
* **Then** the target user's role is updated to `'moderador'` in the database
* **And** the mutation returns a success payload (e.g. `{ success: true }`).

**Scenario: Users cannot elevate or modify their own role via `modifyProfile`**
* **Given** a GraphQL request to `updateProfile` with valid fields (e.g. `fullName: "Test"`)
* **When** a malicious caller intercepts the request and injects a `role: "admin"` field into the payload
* **Then** the `modifyProfile` service function safely ignores the `role` input
* **And** the user's existing role in the database remains unchanged.

**Scenario: Role changes are only possible through the narrow `assign_user_role` RPC, never via a broad profile update**
* **Given** no RLS policy grants admins general `UPDATE` access to other users' rows in `profiles`
* **When** any caller (including an admin) attempts to change another user's `name`/`bio`/etc. directly via a `profiles` table update (e.g. hitting Supabase's REST/PostgREST layer directly, bypassing GraphQL)
* **Then** the update is rejected by RLS
* **And** the only sanctioned way to change another user's `role` is calling the `assign_user_role(target_user_id, new_role)` function, which touches only the `role` and `updated_at` columns and independently re-checks the caller is `'admin'` at the database level.

## 3. Data Exposure (GraphQL Queries)
**Scenario: The `me` and `profile` queries return the role field**
* **Given** an authenticated user with the role `'moderador'`
* **When** they query the `me` or `profile` endpoint requesting the `role` field
* **Then** the resolver correctly returns `'moderador'` for that field.
