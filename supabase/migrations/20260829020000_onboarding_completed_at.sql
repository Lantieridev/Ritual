-- Marca si el usuario ya vio el tour de onboarding (issue #20). Nullable: NULL
-- significa "todavía no lo vio", se completa una sola vez. Server-side y no
-- localStorage porque es el patrón que ya sigue todo el resto del estado de
-- usuario en esta app (rol, preferencias de modo recital, etc.) — sobrevive
-- a limpiar el navegador y a cambiar de dispositivo.
alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

-- Backfill: sin esto, todo perfil que ya existía al momento de esta
-- migración -alguien con archivo entero, no un usuario nuevo- vería aparecer
-- el tour de bienvenida la próxima vez que entre. Se marca como ya visto con
-- la fecha de creación del perfil, para que el tour sólo le toque a cuentas
-- creadas de acá en más.
update public.profiles
  set onboarding_completed_at = created_at
  where onboarding_completed_at is null;
