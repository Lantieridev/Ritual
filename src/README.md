# Estructura de `src/`

- **`core/`** – Lo que usa toda la app: tipos, Supabase, rutas, componentes UI y layout. No contiene lógica de un dominio concreto.
- **`domains/`** – Un folder por dominio. Hoy: `artists`, `auth`, `events`, `expenses`, `festivals`, `moderation`, `search`, `showmode`, `stats`, `venues`, `weather`. Cada uno tiene:
  - **`data.ts`** – Lectura de datos (getX, getXById).
  - **`service.ts`** – Casos de uso y escrituras. Es el seam que consumen las páginas y los resolvers.
  - **`components/`** – Componentes específicos del dominio (formularios, listas, etc.).
- **`graphql/`** – El schema de Pothos: un archivo por dominio, más el builder, el contexto (con los DataLoaders) y el cliente in-process.

Las páginas en **`app/`** solo importan de `core` y `domains`; no hay lógica de negocio en `app/`.

Para agregar un nuevo dominio: crear `domains/nuevo-dominio/` con data, service y components, sumar su archivo en `graphql/` si expone API, y las rutas en `app/`.

**Historia:** la capa `actions.ts` que describía este documento se eliminó (issue #23) y su contenido vive hoy en `service.ts`.

Todo dominio expone su lectura y escritura a través de `service.ts` — ningún archivo de `app/` o `src/graphql/` importa un `data.ts` directo, y ningún dominio importa el `data.ts` de otro. `moderation` es la única excepción a la forma habitual: no tiene `data.ts` propio porque no cachea nada, habla contra Supabase directo desde `service.ts`. Verificable con:

```bash
grep -rn "domains/[a-z]*/data'" src app --include="*.ts" --include="*.tsx" | grep -v "\.test\."
```

Sólo deberían aparecer líneas donde el dominio importa su propio `data.ts`.
