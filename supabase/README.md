# Supabase CLI — ver cambios de la DB en tiempo real

Este proyecto usa el CLI de Supabase para dejar la estructura de la base en el repo (migraciones) y poder hacer **pull** cuando cambies algo en el dashboard.

## Primera vez: vincular el proyecto

1. **Project ref**  
   En [app.supabase.com](https://app.supabase.com) → tu proyecto → la URL es algo como  
   `https://app.supabase.com/project/abcdefghijk`  
   El **project ref** es la parte final: `abcdefghijk`.

2. **Login** (si hace falta):
   ```bash
   npx supabase login
   ```

3. **Vincular** (reemplazá `TU_PROJECT_REF` por tu ref):
   ```bash
   npx supabase link --project-ref TU_PROJECT_REF
   ```
   Te va a pedir la contraseña de la base (la que ves en Settings → Database).

## Traer la estructura actual desde Supabase

Cada vez que cambies tablas/columnas/RLS en el dashboard, ejecutá:

```bash
npm run supabase:db-pull
```

Eso genera una nueva migración en `supabase/migrations/` con el diff. Esos archivos son la “fuente de verdad” en el repo y los podemos usar para ver la estructura en tiempo real.

## Opcional: generar tipos TypeScript

Para tener tipos alineados con la DB:

```bash
npm run supabase:gen-types
```

Eso escribe `src/lib/database.types.ts`. Después podés usarlo en el código o para cruzar con `src/lib/types.ts`.
