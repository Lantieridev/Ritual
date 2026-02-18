/**
 * Obtiene el ID del usuario actual.
 * Sin auth: devuelve RITUAL_DEV_USER_ID (env) para desarrollo.
 * Con auth (futuro): leer de Supabase getSession() o createServerClient.
 */
export async function getCurrentUserId(): Promise<string | null> {
  // Cuando exista Supabase Auth en el servidor:
  // const { data: { user } } = await supabase.auth.getUser()
  // return user?.id ?? null
  return process.env.RITUAL_DEV_USER_ID ?? null
}
